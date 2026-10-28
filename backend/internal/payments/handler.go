package payments

import (
	"crypto/subtle"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"io"
	"net/http"
	"strings"
	"tatame/backend/internal/billing"
	"tatame/backend/internal/core"
	"time"
)

type Handler struct{ Manager *Manager }

func (h Handler) List(w http.ResponseWriter, r *http.Request) {
	a := r.PathValue("academy")
	sid := r.URL.Query().Get("student_id")
	if strings.Contains(r.URL.Path, "/me/invoices") {
		u := core.P(r.Context()).UserID
		if u == "" {
			core.Fail(w, core.E(403, "forbidden", "Conta pessoal necessária."))
			return
		}
		if e := h.Manager.Repo.DB.QueryRow(r.Context(), "SELECT id FROM students WHERE academy_id=$1 AND user_id=$2", a, u).Scan(&sid); e != nil {
			core.Fail(w, core.E(403, "forbidden", "Aluno não vinculado."))
			return
		}
	} else {
		if _, e := h.Manager.Access.Require(r.Context(), a, "admin"); e != nil {
			core.Fail(w, e)
			return
		}
	}
	p, n, e := core.Pagination(r)
	if e != nil {
		core.Fail(w, e)
		return
	}
	month, status := r.URL.Query().Get("month"), r.URL.Query().Get("status")
	if sid != "" && !core.ValidID(sid) {
		core.Fail(w, core.E(422, "invalid_student", "Aluno inválido."))
		return
	}
	if month != "" {
		if _, e = time.Parse("2006-01", month); e != nil {
			core.Fail(w, core.E(422, "invalid_month", "Use competência YYYY-MM."))
			return
		}
	}
	if status != "" && status != "open" && status != "paid" && status != "overdue" && status != "cancelled" {
		core.Fail(w, core.E(422, "invalid_status", "Situação inválida."))
		return
	}
	v, e := (billing.Repository{DB: h.Manager.Repo.DB}).List(r.Context(), a, sid, month, status, p, n)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) Get(w http.ResponseWriter, r *http.Request) {
	v, e := h.Manager.Authorize(r.Context(), r.PathValue("academy"), r.PathValue("invoice"))
	if e != nil {
		core.Fail(w, e)
		return
	}
	provider := "infinitepay"
	if _, ok := h.Manager.Clients[r.PathValue("academy")]; ok {
		provider = "asaas"
	}
	if h.Manager.Infinite != nil {
		var configured bool
		err := h.Manager.Repo.DB.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM payment_connections WHERE academy_id=$1 AND current)", r.PathValue("academy")).Scan(&configured)
		if err != nil {
			core.Fail(w, err)
			return
		}
		if configured {
			provider = "infinitepay"
		}
	}
	var legacy bool
	if err := h.Manager.Repo.DB.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM pix_charges WHERE academy_id=$1 AND invoice_id=$2 AND state<>'retired')", r.PathValue("academy"), r.PathValue("invoice")).Scan(&legacy); err != nil {
		core.Fail(w, err)
		return
	}
	if legacy || v.PaymentMethod == "asaas_pix" {
		provider = "asaas"
	}
	var checkout *CheckoutResult
	if h.Manager.Infinite != nil {
		c, err := h.Manager.Infinite.attempt(r.Context(), r.PathValue("academy"), r.PathValue("invoice"))
		if err == nil {
			result := c.result()
			checkout = &result
			provider = "infinitepay"
		} else if !errors.Is(err, pgx.ErrNoRows) {
			core.Fail(w, err)
			return
		}
	}
	core.Write(w, 200, struct {
		billing.Invoice
		Checkout *CheckoutResult `json:"payment_checkout,omitempty"`
		Provider string          `json:"payment_provider"`
	}{v, checkout, provider})
}
func (h Handler) Pix(w http.ResponseWriter, r *http.Request) {
	v, e := h.Manager.Pix(r.Context(), r.PathValue("academy"), r.PathValue("invoice"))
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) Cancel(w http.ResponseWriter, r *http.Request) {
	if e := h.Manager.Cancel(r.Context(), r.PathValue("academy"), r.PathValue("invoice")); e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, map[string]bool{"ok": true})
}
func (h Handler) Status(w http.ResponseWriter, r *http.Request) {
	a := r.PathValue("academy")
	if _, e := h.Manager.Access.Require(r.Context(), a, "admin"); e != nil {
		core.Fail(w, e)
		return
	}
	if h.Manager.Infinite != nil {
		status, e := h.Manager.integration(r.Context(), a)
		if e != nil {
			core.Fail(w, e)
			return
		}
		if status.Connected || h.Manager.Clients[a].Connection.ID == "" {
			core.Write(w, 200, status)
			return
		}
	}
	c, ok := h.Manager.Clients[a]
	env := "disabled"
	if ok {
		env = c.Connection.Environment
	}
	core.Write(w, 200, map[string]any{"connected": ok, "provider": "asaas", "environment": env})
}
func (h Handler) Webhook(w http.ResponseWriter, r *http.Request) {
	conn, ok := h.Manager.Connections[r.PathValue("connection")]
	if !ok || subtle.ConstantTimeCompare([]byte(r.Header.Get("asaas-access-token")), []byte(conn.WebhookToken)) != 1 {
		core.Fail(w, core.E(401, "invalid_webhook", "Notificação não autorizada."))
		return
	}
	var event struct {
		ID      string  `json:"id"`
		Event   string  `json:"event"`
		Payment Payment `json:"payment"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	dec := json.NewDecoder(r.Body)
	if e := dec.Decode(&event); e != nil {
		core.Fail(w, core.E(400, "invalid_json", "Notificação inválida."))
		return
	}
	var extra any
	if e := dec.Decode(&extra); e != io.EOF {
		core.Fail(w, core.E(400, "invalid_json", "Notificação inválida."))
		return
	}
	if event.ID == "" || len(event.ID) > 200 || event.Payment.ID == "" {
		core.Fail(w, core.E(400, "invalid_event", "Notificação inválida."))
		return
	}
	c, e := h.Manager.Repo.Find(r.Context(), conn.AcademyID, event.Payment.ID, event.Payment.ExternalReference)
	if errors.Is(e, pgx.ErrNoRows) {
		core.Write(w, 200, map[string]bool{"ok": true})
		return
	}
	if e != nil {
		core.Fail(w, e)
		return
	}
	release, e := h.Manager.lockOperation(r.Context(), conn.AcademyID, c.InvoiceID)
	if e != nil {
		core.Fail(w, e)
		return
	}
	defer release()
	c, e = h.Manager.Repo.Find(r.Context(), conn.AcademyID, event.Payment.ID, event.Payment.ExternalReference)
	if e != nil {
		core.Fail(w, e)
		return
	}
	p, e := h.Manager.Clients[conn.AcademyID].get(r.Context(), event.Payment.ID)
	if e != nil {
		core.Fail(w, bankUnavailable())
		return
	}
	if e = h.Manager.Repo.Apply(r.Context(), c, p); e != nil {
		core.Fail(w, e)
		return
	}
	_, e = h.Manager.Repo.DB.Exec(r.Context(), "INSERT INTO payment_events(connection_id,event_id) VALUES($1,$2) ON CONFLICT DO NOTHING", conn.ID, event.ID)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, map[string]bool{"ok": true})
}
