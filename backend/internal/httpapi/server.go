package httpapi

import (
	"context"
	_ "embed"
	"github.com/jackc/pgx/v5/pgxpool"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"sync"
	"tatame/backend/internal/academies"
	"tatame/backend/internal/access"
	"tatame/backend/internal/attendance"
	"tatame/backend/internal/auth"
	"tatame/backend/internal/classes"
	"tatame/backend/internal/core"
	"tatame/backend/internal/devices"
	"tatame/backend/internal/memberships"
	"tatame/backend/internal/participation"
	"tatame/backend/internal/payments"
	"tatame/backend/internal/students"
	"time"
)

type Server struct {
	db      *pgxpool.Pool
	access  access.Service
	origins map[string]bool
	limiter *limiter
}
type bucket struct {
	Count   int
	Expires time.Time
}
type limiter struct {
	mu    sync.Mutex
	items map[string]bucket
}

func (l *limiter) Allow(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	b := l.items[ip]
	if now.After(b.Expires) {
		b = bucket{Expires: now.Add(time.Minute)}
	}
	b.Count++
	if len(l.items) > 10000 {
		for k, v := range l.items {
			if now.After(v.Expires) {
				delete(l.items, k)
			}
		}
		if len(l.items) > 10000 {
			return false
		}
	}
	l.items[ip] = b
	return b.Count <= 20
}
func New(db *pgxpool.Pool, origins string) http.Handler {
	return NewWithPayments(db, origins, payments.New(db, nil))
}
func NewWithPayments(db *pgxpool.Pool, origins string, bank *payments.Manager) http.Handler {
	s := &Server{db: db, access: access.Service{DB: db}, origins: map[string]bool{}, limiter: &limiter{items: map[string]bucket{}}}
	for _, o := range strings.Split(origins, ",") {
		s.origins[strings.TrimSpace(o)] = true
	}
	a := auth.Handler{Service: auth.Service{Repo: auth.Repository{DB: db}}}
	ac := academies.Handler{Service: academies.Service{Repo: academies.Repository{DB: db}}}
	m := memberships.Handler{Service: memberships.Service{Repo: memberships.Repository{DB: db}, Access: s.access}}
	c := classes.Handler{Service: classes.Service{Repo: classes.Repository{DB: db}, Access: s.access}}
	p := attendance.Handler{Service: attendance.Service{Repo: attendance.Repository{DB: db}, Access: s.access}}
	d := devices.Handler{Service: devices.Service{Repo: devices.Repository{DB: db}, Access: s.access}}
	st := students.Handler{Service: students.Service{Repo: students.Repository{DB: db}, Access: s.access}}
	bankHandler := payments.Handler{Manager: bank}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if e := db.Ping(ctx); e != nil {
			core.Fail(w, core.E(503, "database_unavailable", "Banco indisponível."))
			return
		}
		core.Write(w, 200, map[string]string{"status": "ok", "service": "tatame-api"})
	})
	mux.HandleFunc("POST /v1/auth/register", s.rate(a.Register))
	mux.HandleFunc("POST /v1/auth/login", s.rate(a.Login))
	protected := func(path string, h http.HandlerFunc) { mux.Handle(path, a.Middleware(h)) }
	protected("POST /v1/auth/logout", a.Logout)
	protected("GET /v1/me", a.Me)
	protected("POST /v1/academies", ac.Create)
	protected("GET /v1/me/academies", ac.List)
	protected("POST /v1/membership-requests", m.Request)
	protected("GET /v1/me/membership-requests", m.OwnRequests)
	base := "/v1/academies/{academy}"
	protected("GET "+base+"/membership-requests", m.Requests)
	protected("PATCH "+base+"/membership-requests/{request}", m.Decide)
	protected("GET "+base+"/members", m.Members)
	protected("GET "+base+"/managers", m.Managers)
	protected("POST "+base+"/managers", m.CreateManager)
	protected("PATCH "+base+"/members/{member}", m.Update)
	protected("GET "+base+"/classes", c.List)
	protected("POST "+base+"/classes", c.Save)
	protected("PATCH "+base+"/classes/{class}", c.Save)
	protected("DELETE "+base+"/classes/{class}", c.Delete)
	protected("GET "+base+"/classes/{class}/schedules", c.Schedules)
	protected("POST "+base+"/classes/{class}/schedules", c.AddSchedule)
	protected("GET "+base+"/sessions", c.Sessions)
	protected("POST "+base+"/classes/{class}/sessions", c.Open)
	protected("PATCH "+base+"/sessions/{session}", c.Close)
	protected("POST "+base+"/sessions/{session}/check-ins", p.CheckIn)
	protected("GET "+base+"/attendance-options", p.Options)
	protected("POST "+base+"/check-ins", p.ScheduledCheckIn)
	protected("POST "+base+"/attendances", p.Manual)
	protected("GET "+base+"/sessions/{session}/attendances", p.List)
	protected("GET "+base+"/me/attendances", p.Own)
	part := participation.Handler{Repo: participation.Repository{DB: db}}
	protected("GET "+base+"/me/participation", part.Own)
	protected("PATCH "+base+"/me/participation", part.Own)
	protected("GET "+base+"/me/student-credential", p.Credential)
	protected("POST "+base+"/devices", d.Create)
	protected("GET "+base+"/devices", d.List)
	protected("DELETE "+base+"/devices/{device}", d.Revoke)
	protected("DELETE "+base+"/devices/current", d.Exit)
	protected("GET "+base+"/dashboard", s.dashboard)
	protected("GET "+base+"/students", st.List)
	protected("POST "+base+"/students", st.Save)
	protected("GET "+base+"/students/{student}", st.Get)
	protected("GET "+base+"/students/{student}/credential", p.Credential)
	protected("PATCH "+base+"/students/{student}", st.Save)
	protected("PATCH "+base+"/students/{student}/graduations/{modality}", st.Graduation)
	protected("GET "+base+"/students/{student}/progress", st.Progress)
	protected("PATCH "+base+"/students/{student}/start-date", st.StartDate)
	protected("POST "+base+"/students/{student}/archive", st.Archive)
	protected("POST "+base+"/students/{student}/restore", st.Restore)
	protected("POST "+base+"/students/{student}/invitations", st.Invitation)
	protected("DELETE "+base+"/students/{student}/invitations", st.Invitation)
	protected("GET /v1/invitations/{token}", st.PreviewInvitation)
	protected("POST /v1/invitations/{token}/accept", st.Accept)
	protected("GET "+base+"/me/student", st.Own)
	for _, catalog := range []string{"modalities", "plans"} {
		fn := st.Catalog(catalog == "plans")
		protected("GET "+base+"/"+catalog, fn)
		protected("POST "+base+"/"+catalog, fn)
		protected("PATCH "+base+"/"+catalog+"/{item}", fn)
	}
	protected("GET "+base+"/invoices", bankHandler.List)
	protected("GET "+base+"/me/invoices", bankHandler.List)
	protected("GET "+base+"/invoices/{invoice}", bankHandler.Get)
	protected("POST "+base+"/invoices/{invoice}/pix", bankHandler.Pix)
	protected("PATCH "+base+"/invoices/{invoice}/cancel", bankHandler.Cancel)
	protected("PATCH "+base+"/invoices/{invoice}/discount", bankHandler.Discount)
	protected("POST "+base+"/invoices/{invoice}/manual-payment", bankHandler.ManualPayment)
	protected("GET "+base+"/invoices/{invoice}/history", bankHandler.History)
	protected("GET "+base+"/payment-integration", bankHandler.Status)
	protected("GET "+base+"/attendances", p.All)
	mux.HandleFunc("POST /v1/webhooks/asaas/{connection}/pix", bankHandler.Webhook)
	mux.HandleFunc("GET /openapi.json", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(openAPI)
	})
	return s.middleware(mux)
}

//go:embed openapi.json
var openAPI []byte

func (s *Server) rate(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ip, _, _ := net.SplitHostPort(r.RemoteAddr)
		if !s.limiter.Allow(ip) {
			core.Fail(w, core.E(429, "rate_limit", "Muitas tentativas. Aguarde um minuto."))
			return
		}
		h(w, r)
	}
}
func (s *Server) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		path := r.URL.Path
		if strings.Contains(path, "/invitations/") {
			path = "/v1/invitations/[redacted]"
		}
		defer func() {
			if v := recover(); v != nil {
				slog.Error("request panic", "path", path, "error", v)
				core.Fail(w, core.E(500, "internal_error", "Não foi possível concluir a operação."))
			}
			slog.Info("request", "method", r.Method, "path", path, "duration_ms", time.Since(started).Milliseconds())
		}()
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-store")
		origin := r.Header.Get("Origin")
		if s.origins[origin] && origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization,Content-Type,Idempotency-Key")
			w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS")
		}
		if r.Method == "OPTIONS" {
			w.WriteHeader(204)
			return
		}
		next.ServeHTTP(w, r)
	})
}
