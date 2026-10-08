package attendance

import (
	"net/http"
	"tatame/backend/internal/core"
)

type Handler struct{ Service Service }

func (h Handler) CheckIn(w http.ResponseWriter, r *http.Request) {
	var in Input
	if e := core.Decode(w, r, &in); e != nil {
		core.Fail(w, e)
		return
	}
	v, e := h.Service.CheckIn(r.Context(), r.PathValue("academy"), r.PathValue("session"), r.Header.Get("Idempotency-Key"), in)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) List(w http.ResponseWriter, r *http.Request) {
	a, id := r.PathValue("academy"), r.PathValue("session")
	if !core.ValidID(id) {
		core.Fail(w, core.E(404, "not_found", "Aula não encontrada."))
		return
	}
	var c string
	err := h.Service.Repo.SessionClass(r.Context(), a, id, &c)
	if err != nil {
		core.Fail(w, err)
		return
	}
	if _, e := h.Service.Access.Class(r.Context(), a, c); e != nil {
		core.Fail(w, e)
		return
	}
	v, e := h.Service.Repo.History(r.Context(), a, id, "")
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) Own(w http.ResponseWriter, r *http.Request) {
	a := r.PathValue("academy")
	m, e := h.Service.Access.Require(r.Context(), a, "student")
	if e != nil {
		core.Fail(w, e)
		return
	}
	v, e := h.Service.Repo.History(r.Context(), a, "", m.ID)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) Credential(w http.ResponseWriter, r *http.Request) {
	a := r.PathValue("academy")
	m, e := h.Service.Access.Require(r.Context(), a, "student")
	if e != nil {
		core.Fail(w, e)
		return
	}
	code, qr, e := h.Service.Repo.Credential(r.Context(), a, m.ID)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, map[string]string{"student_code": code, "qr_token": "tatame:" + qr, "student_name": m.Name, "belt": m.Belt})
}
