package auth

import (
	"net/http"
	"strings"
	"tatame/backend/internal/core"
)

type Handler struct{ Service Service }

func (h Handler) Register(w http.ResponseWriter, r *http.Request) {
	var c Credentials
	if e := core.Decode(w, r, &c); e != nil {
		core.Fail(w, e)
		return
	}
	v, e := h.Service.Register(r.Context(), c)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 201, v)
}
func (h Handler) Login(w http.ResponseWriter, r *http.Request) {
	var c Credentials
	if e := core.Decode(w, r, &c); e != nil {
		core.Fail(w, e)
		return
	}
	v, e := h.Service.Login(r.Context(), c)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) Logout(w http.ResponseWriter, r *http.Request) {
	e := h.Service.Logout(r.Context(), strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, map[string]bool{"ok": true})
}
func (h Handler) Me(w http.ResponseWriter, r *http.Request) {
	u, e := h.Service.Me(r.Context())
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, u)
}
func (h Handler) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") || len(header) > 200 {
			core.Fail(w, core.E(401, "unauthorized", "Entre para continuar."))
			return
		}
		p, e := h.Service.Repo.Principal(r.Context(), strings.TrimPrefix(header, "Bearer "))
		if e != nil {
			core.Fail(w, e)
			return
		}
		next.ServeHTTP(w, r.WithContext(core.WithPrincipal(r.Context(), p)))
	})
}
