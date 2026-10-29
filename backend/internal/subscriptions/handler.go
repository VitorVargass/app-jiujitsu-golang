package subscriptions

import (
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"io"
	"net/http"
	"strings"
	"tatame/backend/internal/access"
	"tatame/backend/internal/core"
)

type Handler struct{ Manager *Manager }

func (h Handler) Status(w http.ResponseWriter, r *http.Request) {
	v, e := h.Manager.Status(r.Context(), r.PathValue("academy"))
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) History(w http.ResponseWriter, r *http.Request) {
	page, size, e := core.Pagination(r)
	if e != nil {
		core.Fail(w, e)
		return
	}
	v, e := h.Manager.History(r.Context(), r.PathValue("academy"), page, size)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) Renewal(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Enabled *bool `json:"enabled"`
	}
	if e := core.Decode(w, r, &in); e != nil {
		core.Fail(w, e)
		return
	}
	if in.Enabled == nil {
		core.Fail(w, core.E(422, "invalid_renewal", "Informe se deseja manter a assinatura."))
		return
	}
	if e := h.Manager.Renewal(r.Context(), r.PathValue("academy"), *in.Enabled); e != nil {
		core.Fail(w, e)
		return
	}
	h.Status(w, r)
}
func (h Handler) Checkout(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Cycle string `json:"cycle_id"`
	}
	if e := core.Decode(w, r, &in); e != nil {
		core.Fail(w, e)
		return
	}
	v, e := h.Manager.Checkout(r.Context(), r.PathValue("academy"), in.Cycle)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) Check(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Attempt string `json:"attempt_id"`
		Event   Event  `json:"event"`
	}
	if e := core.Decode(w, r, &in); e != nil {
		core.Fail(w, e)
		return
	}
	v, e := h.Manager.Check(r.Context(), r.PathValue("academy"), in.Attempt, in.Event)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) Webhook(w http.ResponseWriter, r *http.Request) {
	if !h.Manager.Config.Enabled {
		core.Fail(w, disabled())
		return
	}
	var in Event
	r.Body = http.MaxBytesReader(w, r.Body, 65536)
	decoder := json.NewDecoder(r.Body)
	if e := decoder.Decode(&in); e != nil {
		core.Fail(w, core.E(400, "invalid_event", "Notificação inválida."))
		return
	}
	if e := decoder.Decode(new(any)); e != io.EOF {
		core.Fail(w, core.E(400, "invalid_event", "Notificação inválida."))
		return
	}
	if !in.valid() {
		core.Fail(w, core.E(400, "invalid_event", "Notificação inválida."))
		return
	}
	if e := h.Manager.enqueue(r.Context(), in); e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, map[string]bool{"accepted": true})
}

// Gate keeps all reads and payment recovery available. Writes are guarded on the server.
func (m *Manager) Gate(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !m.Config.Enabled || r.Method == "GET" || r.Method == "HEAD" {
			next(w, r)
			return
		}
		a := r.PathValue("academy")
		if strings.Contains(r.URL.Path, "/subscription") {
			next(w, r)
			return
		}
		if a == "" && strings.HasPrefix(r.URL.Path, "/v1/enrollment-links/") {
			e := m.DB.QueryRow(r.Context(), "SELECT academy_id FROM enrollment_links WHERE token=$1 AND enabled", r.PathValue("token")).Scan(&a)
			if errors.Is(e, pgx.ErrNoRows) {
				next(w, r)
				return
			}
			if e != nil {
				core.Fail(w, e)
				return
			}
		}
		if a == "" {
			next(w, r)
			return
		}
		// Student payments and financial confirmations are never held hostage.
		if strings.Contains(r.URL.Path, "/invoices/") && (strings.HasSuffix(r.URL.Path, "/checkout") || strings.HasSuffix(r.URL.Path, "/payment-check") || strings.HasSuffix(r.URL.Path, "/pix")) {
			next(w, r)
			return
		}
		p := core.P(r.Context())
		if r.PathValue("academy") != "" {
			if p.DeviceID != "" {
				if p.AcademyID != a {
					core.Fail(w, core.E(403, "forbidden", "Academia não autorizada."))
					return
				}
			} else {
				if _, e := (access.Service{DB: m.DB}).Require(r.Context(), a); e != nil {
					core.Fail(w, e)
					return
				}
			}
		}
		v, e := m.snapshot(r.Context(), a, false)
		if e != nil {
			core.Fail(w, e)
			return
		}
		if v.Restricted {
			core.Fail(w, core.E(402, "subscription_required", "Assinatura TatameMix pendente. O gestor pode regularizar em Mais → Assinatura TatameMix. Consultas continuam disponíveis."))
			return
		}
		next(w, r)
	}
}
