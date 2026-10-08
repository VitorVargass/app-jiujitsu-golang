package memberships

import (
	"net/http"
	"tatame/backend/internal/core"
)

type Handler struct{ Service Service }

func (h Handler) Request(w http.ResponseWriter, r *http.Request) {
	var in RequestInput
	if e := core.Decode(w, r, &in); e != nil {
		core.Fail(w, e)
		return
	}
	v, e := h.Service.Request(r.Context(), in)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 201, v)
}
func (h Handler) OwnRequests(w http.ResponseWriter, r *http.Request) {
	u := core.P(r.Context()).UserID
	if u == "" {
		core.Fail(w, core.E(403, "forbidden", "Conta pessoal necessária."))
		return
	}
	v, e := h.Service.Repo.Requests(r.Context(), "", u)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) Requests(w http.ResponseWriter, r *http.Request) {
	a := r.PathValue("academy")
	if _, e := h.Service.Access.Require(r.Context(), a, "admin"); e != nil {
		core.Fail(w, e)
		return
	}
	v, e := h.Service.Repo.Requests(r.Context(), a, "")
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) Decide(w http.ResponseWriter, r *http.Request) {
	a := r.PathValue("academy")
	if _, e := h.Service.Access.Require(r.Context(), a, "admin"); e != nil {
		core.Fail(w, e)
		return
	}
	var in Decision
	if e := core.Decode(w, r, &in); e != nil {
		core.Fail(w, e)
		return
	}
	if in.Status != "approved" && in.Status != "rejected" {
		core.Fail(w, core.E(422, "invalid_decision", "Aprove ou recuse a solicitação."))
		return
	}
	if !core.ValidID(r.PathValue("request")) {
		core.Fail(w, core.E(404, "not_found", "Solicitação não encontrada."))
		return
	}
	if e := h.Service.Repo.Decide(r.Context(), a, r.PathValue("request"), in.Status); e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, map[string]bool{"ok": true})
}
func (h Handler) Members(w http.ResponseWriter, r *http.Request) {
	a := r.PathValue("academy")
	if _, e := h.Service.Access.Require(r.Context(), a, "admin", "teacher"); e != nil {
		core.Fail(w, e)
		return
	}
	v, e := h.Service.Repo.Members(r.Context(), a)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) Update(w http.ResponseWriter, r *http.Request) {
	var in Update
	if e := core.Decode(w, r, &in); e != nil {
		core.Fail(w, e)
		return
	}
	if e := h.Service.Update(r.Context(), r.PathValue("academy"), r.PathValue("member"), in); e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, map[string]bool{"ok": true})
}
