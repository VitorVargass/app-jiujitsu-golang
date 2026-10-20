package students

import (
	"net/http"
	"tatame/backend/internal/core"
)

type Handler struct{ Service Service }

func (h Handler) List(w http.ResponseWriter, r *http.Request) {
	a := r.PathValue("academy")
	if _, e := h.Service.Access.Require(r.Context(), a, "admin"); e != nil {
		core.Fail(w, e)
		return
	}
	p, n, e := core.Pagination(r)
	if e != nil {
		core.Fail(w, e)
		return
	}
	status, modality := r.URL.Query().Get("status"), r.URL.Query().Get("modality_id")
	if (status != "" && status != "active" && status != "inactive" && status != "archived") || (modality != "" && !core.ValidID(modality)) {
		core.Fail(w, core.E(422, "invalid_filter", "Filtro inválido."))
		return
	}
	v, e := h.Service.Repo.List(r.Context(), a, r.URL.Query().Get("search"), status, modality, p, n)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) Get(w http.ResponseWriter, r *http.Request) {
	a := r.PathValue("academy")
	if _, e := h.Service.Access.Require(r.Context(), a, "admin"); e != nil {
		core.Fail(w, e)
		return
	}
	if !core.ValidID(r.PathValue("student")) {
		core.Fail(w, core.E(404, "not_found", "Aluno não encontrado."))
		return
	}
	v, e := h.Service.Repo.Get(r.Context(), a, r.PathValue("student"))
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) Save(w http.ResponseWriter, r *http.Request) {
	var in Input
	if e := core.Decode(w, r, &in); e != nil {
		core.Fail(w, e)
		return
	}
	v, e := h.Service.Save(r.Context(), r.PathValue("academy"), r.PathValue("student"), in)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) Catalog(plans bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a := r.PathValue("academy")
		if _, e := h.Service.Access.Require(r.Context(), a, "admin"); e != nil {
			core.Fail(w, e)
			return
		}
		if r.Method == "GET" {
			v, e := h.Service.Repo.Catalog(r.Context(), a, plans)
			if e != nil {
				core.Fail(w, e)
				return
			}
			core.Write(w, 200, v)
			return
		}
		var in Catalog
		if e := core.Decode(w, r, &in); e != nil {
			core.Fail(w, e)
			return
		}
		v, e := h.Service.SaveCatalog(r.Context(), a, r.PathValue("item"), in, plans)
		if e != nil {
			core.Fail(w, e)
			return
		}
		core.Write(w, 200, v)
	}
}
func (h Handler) Invitation(w http.ResponseWriter, r *http.Request) {
	a, id := r.PathValue("academy"), r.PathValue("student")
	if _, e := h.Service.Access.Require(r.Context(), a, "admin"); e != nil {
		core.Fail(w, e)
		return
	}
	if !core.ValidID(id) {
		core.Fail(w, core.E(404, "not_found", "Aluno não encontrado."))
		return
	}
	if r.Method == "DELETE" {
		if e := h.Service.Repo.Revoke(r.Context(), a, id); e != nil {
			core.Fail(w, e)
			return
		}
		core.Write(w, 200, map[string]bool{"ok": true})
		return
	}
	token, e := h.Service.Repo.Invite(r.Context(), a, id)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 201, map[string]any{"token": token, "expires_in_days": 7})
}
func (h Handler) Accept(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	u := core.P(r.Context()).UserID
	t := r.PathValue("token")
	if u == "" {
		core.Fail(w, core.E(403, "forbidden", "Entre com uma conta pessoal."))
		return
	}
	if len(t) != 64 {
		core.Fail(w, core.E(410, "invalid_invitation", "Convite inválido."))
		return
	}
	var in AcceptInvitationInput
	if r.ContentLength != 0 {
		if e := core.Decode(w, r, &in); e != nil {
			core.Fail(w, e)
			return
		}
	}
	v, e := h.Service.Repo.Accept(r.Context(), t, u, in)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) Own(w http.ResponseWriter, r *http.Request) {
	a := r.PathValue("academy")
	u := core.P(r.Context()).UserID
	if u == "" {
		core.Fail(w, core.E(403, "forbidden", "Conta pessoal necessária."))
		return
	}
	id, e := h.Service.Repo.OwnID(r.Context(), a, u)
	if e != nil {
		core.Fail(w, e)
		return
	}
	v, e := h.Service.Repo.Get(r.Context(), a, id)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
