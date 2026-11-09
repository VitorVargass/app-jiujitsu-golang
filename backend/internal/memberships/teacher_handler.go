package memberships

import (
	"net/http"
	"tatame/backend/internal/core"
)

func (h Handler) Teachers(w http.ResponseWriter, r *http.Request) {
	value, err := h.Service.Teachers(r.Context(), r.PathValue("academy"))
	if err != nil {
		core.Fail(w, err)
		return
	}
	core.Write(w, 200, value)
}
func (h Handler) CreateTeacher(w http.ResponseWriter, r *http.Request) {
	// Authorization precedes body validation and account lookup.
	if _, err := h.Service.Access.Require(r.Context(), r.PathValue("academy"), "admin"); err != nil {
		core.Fail(w, err)
		return
	}
	var in CreateManagerInput
	if err := core.Decode(w, r, &in); err != nil {
		core.Fail(w, err)
		return
	}
	value, err := h.Service.CreateTeacher(r.Context(), r.PathValue("academy"), in)
	if err != nil {
		core.Fail(w, err)
		return
	}
	core.Write(w, 201, value)
}

func (h Handler) RemoveTeacher(w http.ResponseWriter, r *http.Request) {
	if err := h.Service.RemoveTeacher(r.Context(), r.PathValue("academy"), r.PathValue("member")); err != nil {
		core.Fail(w, err)
		return
	}
	core.Write(w, 200, map[string]bool{"ok": true})
}
