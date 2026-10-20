package httpapi

import (
	"net/http"
	"tatame/backend/internal/access"
	"tatame/backend/internal/core"
	"time"
)

func (s *Server) dashboard(w http.ResponseWriter, r *http.Request) {
	a := r.PathValue("academy")
	m, e := s.access.Require(r.Context(), a)
	if e != nil {
		core.Fail(w, e)
		return
	}
	scope := "student"
	if access.Has(m.Roles, "admin") {
		scope = "admin"
	} else if access.Has(m.Roles, "teacher") {
		scope = "teacher"
	}
	requested := r.URL.Query().Get("role")
	if requested != "" {
		if !access.Has(m.Roles, requested) {
			core.Fail(w, core.E(403, "forbidden", "Este papel não está autorizado."))
			return
		}
		scope = requested
	}
	var zone string
	if e = s.db.QueryRow(r.Context(), "SELECT timezone FROM academies WHERE id=$1", a).Scan(&zone); e != nil {
		core.Fail(w, e)
		return
	}
	loc, e := time.LoadLocation(zone)
	if e != nil {
		core.Fail(w, e)
		return
	}
	now := time.Now().In(loc)
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	month := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, loc)
	mid := m.ID
	if scope == "student" {
		if e = s.db.QueryRow(r.Context(), "SELECT participant_id FROM students WHERE academy_id=$1 AND user_id=$2", a, m.UserID).Scan(&mid); e != nil {
			core.Fail(w, e)
			return
		}
	}
	var today, totalMonth, students int
	var received, open int64
	query := `SELECT count(*) FILTER(WHERE s.starts_at>=$4 AND s.starts_at<$4+interval '1 day'),count(*) FILTER(WHERE s.starts_at>=$5 AND s.starts_at<$5+interval '1 month') FROM attendances p JOIN class_sessions s ON s.id=p.session_id AND s.academy_id=p.academy_id JOIN classes c ON c.id=s.class_id AND c.academy_id=s.academy_id
 WHERE p.academy_id=$1 AND ($2='admin' OR ($2='teacher' AND c.teacher_membership_id=$3) OR ($2='student' AND p.participant_id=$3))`
	if e = s.db.QueryRow(r.Context(), query, a, scope, mid, start, month).Scan(&today, &totalMonth); e != nil {
		core.Fail(w, e)
		return
	}
	if scope == "admin" {
		if e = s.db.QueryRow(r.Context(), "SELECT count(*) FROM students WHERE academy_id=$1 AND status='active'", a).Scan(&students); e != nil {
			core.Fail(w, e)
			return
		}
		if e = s.db.QueryRow(r.Context(), "SELECT COALESCE(sum(amount_cents) FILTER(WHERE status='paid' AND paid_at>=$2),0),COALESCE(sum(amount_cents) FILTER(WHERE status='open'),0) FROM invoices WHERE academy_id=$1", a, month).Scan(&received, &open); e != nil {
			core.Fail(w, e)
			return
		}
	}
	type Day struct {
		Date  string `json:"date"`
		Count int    `json:"count"`
	}
	week := []Day{}
	for i := 6; i >= 0; i-- {
		d := start.AddDate(0, 0, -i)
		var n int
		e = s.db.QueryRow(r.Context(), `SELECT count(*) FROM attendances p JOIN class_sessions s ON s.id=p.session_id AND s.academy_id=p.academy_id JOIN classes c ON c.id=s.class_id AND c.academy_id=s.academy_id WHERE p.academy_id=$1 AND s.starts_at>=$4 AND s.starts_at<$5 AND ($2='admin' OR ($2='teacher' AND c.teacher_membership_id=$3) OR ($2='student' AND p.participant_id=$3))`, a, scope, mid, d, d.AddDate(0, 0, 1)).Scan(&n)
		if e != nil {
			core.Fail(w, e)
			return
		}
		week = append(week, Day{d.Format("2006-01-02"), n})
	}
	core.Write(w, 200, map[string]any{"scope": scope, "presences_today": today, "presences_month": totalMonth, "active_students": students, "received_month_cents": received, "open_cents": open, "week": week})
}
