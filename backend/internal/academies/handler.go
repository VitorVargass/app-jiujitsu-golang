package academies

import (
	"net/http"
	"tatame/backend/internal/core"
)

type Handler struct{ Service Service }

func (h Handler) Create(w http.ResponseWriter, r *http.Request) {
	var in CreateInput
	if e := core.Decode(w, r, &in); e != nil {
		core.Fail(w, e)
		return
	}
	v, e := h.Service.Create(r.Context(), in)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 201, v)
}
func (h Handler) List(w http.ResponseWriter, r *http.Request) {
	if core.P(r.Context()).UserID == "" {
		core.Fail(w, core.E(403, "forbidden", "Uma conta pessoal é necessária."))
		return
	}
	v, e := h.Service.Repo.List(r.Context(), core.P(r.Context()).UserID)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
