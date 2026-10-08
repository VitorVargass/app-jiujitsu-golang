package devices

import (
	"net/http"
	"strings"
	"tatame/backend/internal/core"
)

type Handler struct{ Service Service }

func (h Handler) Create(w http.ResponseWriter, r *http.Request) {
	var in Input
	if e := core.Decode(w, r, &in); e != nil {
		core.Fail(w, e)
		return
	}
	v, e := h.Service.Create(r.Context(), r.PathValue("academy"), in, strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 201, v)
}
func (h Handler) List(w http.ResponseWriter, r *http.Request) {
	v, e := h.Service.List(r.Context(), r.PathValue("academy"))
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) Revoke(w http.ResponseWriter, r *http.Request) {
	if e := h.Service.Revoke(r.Context(), r.PathValue("academy"), r.PathValue("device")); e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, map[string]bool{"ok": true})
}
