package payments

import (
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"io"
	"net/http"
	"tatame/backend/internal/core"
)

func (h Handler) SaveIntegration(w http.ResponseWriter, r *http.Request) {
	a := r.PathValue("academy")
	if _, e := h.Manager.Access.Require(r.Context(), a, "admin"); e != nil {
		core.Fail(w, e)
		return
	}
	var in IntegrationInput
	if e := core.Decode(w, r, &in); e != nil {
		core.Fail(w, e)
		return
	}
	if e := h.Manager.saveIntegration(r.Context(), a, in); e != nil {
		core.Fail(w, e)
		return
	}
	h.Status(w, r)
}
func (h Handler) ToggleIntegration(w http.ResponseWriter, r *http.Request) {
	a := r.PathValue("academy")
	if _, e := h.Manager.Access.Require(r.Context(), a, "admin"); e != nil {
		core.Fail(w, e)
		return
	}
	var in struct {
		Enabled *bool `json:"enabled"`
	}
	if e := core.Decode(w, r, &in); e != nil {
		core.Fail(w, e)
		return
	}
	if in.Enabled == nil {
		core.Fail(w, core.E(422, "invalid_enabled", "Informe se a emissão deve estar ativa."))
		return
	}
	if e := h.Manager.enableIntegration(r.Context(), a, *in.Enabled); e != nil {
		core.Fail(w, e)
		return
	}
	h.Status(w, r)
}
func (h Handler) Checkout(w http.ResponseWriter, r *http.Request) {
	result, e := h.Manager.checkout(r.Context(), r.PathValue("academy"), r.PathValue("invoice"))
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, result)
}
func (h Handler) PaymentCheck(w http.ResponseWriter, r *http.Request) {
	m := h.Manager
	a, id := r.PathValue("academy"), r.PathValue("invoice")
	invoice, e := m.Authorize(r.Context(), a, id)
	if e != nil {
		core.Fail(w, e)
		return
	}
	p := m.Infinite
	if p == nil || !p.Enabled {
		core.Fail(w, core.E(503, "payments_disabled", "Confirmação bancária temporariamente indisponível."))
		return
	}
	var event InfiniteEvent
	if e = core.Decode(w, r, &event); e != nil {
		core.Fail(w, e)
		return
	}
	c, e := p.attempt(r.Context(), a, id)
	if errors.Is(e, pgx.ErrNoRows) {
		core.Write(w, 200, CheckoutResult{Status: "waiting", Amount: invoice.AmountCents})
		return
	}
	if e != nil {
		core.Fail(w, e)
		return
	}
	if event.Order == "" && event.Transaction == "" && event.Slug == "" && event.RedirectSlug == "" {
		event = InfiniteEvent{Order: c.Reference, Transaction: c.Transaction, Slug: c.Slug}
	}
	event.Event = "" // A browser cannot report a bank event or authorize an accounting adjustment.
	if !event.normalize() {
		core.Write(w, 200, c.result())
		return
	}
	if event.Order != c.Reference {
		core.Fail(w, core.E(422, "invalid_payment_reference", "Este retorno não pertence à mensalidade."))
		return
	}
	// Durable first: a browser closing or a lost response does not lose the verification.
	if e = p.enqueue(r.Context(), c.Connection, event); e != nil {
		core.Fail(w, e)
		return
	}
	release, e := m.lockOperation(r.Context(), a, id)
	if e != nil {
		core.Fail(w, e)
		return
	}
	defer release()
	if e = m.checkInfinite(r.Context(), c, event); e != nil {
		core.Fail(w, e)
		return
	}
	c, e = p.attempt(r.Context(), a, id)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, c.result())
}
func (h Handler) InfiniteWebhook(w http.ResponseWriter, r *http.Request) {
	p := h.Manager.Infinite
	if p == nil {
		core.Fail(w, core.E(503, "payments_disabled", "Notificação temporariamente indisponível."))
		return
	}
	connection := r.PathValue("connection")
	if !core.ValidID(connection) {
		core.Fail(w, core.E(404, "not_found", "Conexão não encontrada."))
		return
	}
	// No signature is invented: untrusted events are persisted, never used as proof of payment.
	r.Body = http.MaxBytesReader(w, r.Body, 65536)
	var event InfiniteEvent
	dec := json.NewDecoder(r.Body)
	if e := dec.Decode(&event); e != nil {
		core.Fail(w, core.E(400, "invalid_event", "Notificação inválida."))
		return
	}
	if e := dec.Decode(new(any)); e != io.EOF || !event.normalize() {
		core.Fail(w, core.E(400, "invalid_event", "Notificação inválida."))
		return
	}
	var known bool
	e := p.DB.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM checkout_attempts WHERE connection_id=$1 AND reference=$2)`, connection, event.Order).Scan(&known)
	if e != nil {
		core.Fail(w, e)
		return
	}
	if !known {
		core.Write(w, 200, map[string]bool{"ok": true})
		return
	}
	if e = p.enqueue(r.Context(), connection, event); e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, map[string]bool{"ok": true})
}
