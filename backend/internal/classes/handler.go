package classes

import (
	"net/http"
	"tatame/backend/internal/core"
	"time"
)

type Handler struct{ Service Service }

func (h Handler) Allowed(r *http.Request) error {
	p := core.P(r.Context())
	a := r.PathValue("academy")
	if p.DeviceID != "" {
		if p.AcademyID != a {
			return core.E(403, "forbidden", "Dispositivo de outra academia.")
		}
		return nil
	}
	_, e := h.Service.Access.Require(r.Context(), a)
	return e
}
func (h Handler) List(w http.ResponseWriter, r *http.Request) {
	if _, e := h.Service.Access.Require(r.Context(), r.PathValue("academy")); e != nil {
		core.Fail(w, e)
		return
	}
	v, e := h.Service.Repo.Classes(r.Context(), r.PathValue("academy"))
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) Save(w http.ResponseWriter, r *http.Request) {
	var in ClassInput
	if e := core.Decode(w, r, &in); e != nil {
		core.Fail(w, e)
		return
	}
	v, e := h.Service.Save(r.Context(), r.PathValue("academy"), r.PathValue("class"), in)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) Schedules(w http.ResponseWriter, r *http.Request) {
	if _, e := h.Service.Access.Require(r.Context(), r.PathValue("academy")); e != nil {
		core.Fail(w, e)
		return
	}
	c := r.PathValue("class")
	if !core.ValidID(c) {
		core.Fail(w, core.E(404, "not_found", "Turma não encontrada."))
		return
	}
	v, e := h.Service.Repo.Schedules(r.Context(), r.PathValue("academy"), c)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) AddSchedule(w http.ResponseWriter, r *http.Request) {
	var in ScheduleInput
	if e := core.Decode(w, r, &in); e != nil {
		core.Fail(w, e)
		return
	}
	v, e := h.Service.AddSchedule(r.Context(), r.PathValue("academy"), r.PathValue("class"), in)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 201, v)
}
func (h Handler) Sessions(w http.ResponseWriter, r *http.Request) {
	if e := h.Allowed(r); e != nil {
		core.Fail(w, e)
		return
	}
	date := r.URL.Query().Get("date")
	if date != "" {
		if _, e := time.Parse("2006-01-02", date); e != nil {
			core.Fail(w, core.E(422, "invalid_date", "Data inválida."))
			return
		}
	}
	v, e := h.Service.Repo.Sessions(r.Context(), r.PathValue("academy"), date, core.P(r.Context()).DeviceID != "")
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) Open(w http.ResponseWriter, r *http.Request) {
	var in OpenInput
	if e := core.Decode(w, r, &in); e != nil {
		core.Fail(w, e)
		return
	}
	v, e := h.Service.Open(r.Context(), r.PathValue("academy"), r.PathValue("class"), in)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) Close(w http.ResponseWriter, r *http.Request) {
	var in StatusInput
	if e := core.Decode(w, r, &in); e != nil {
		core.Fail(w, e)
		return
	}
	if e := h.Service.Close(r.Context(), r.PathValue("academy"), r.PathValue("session"), in.Status); e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, map[string]bool{"ok": true})
}
