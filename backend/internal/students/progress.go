package students

import (
	"context"
	"net/http"
	"tatame/backend/internal/core"
	"time"
)

type GraduationEvent struct {
	ID              string     `json:"id"`
	ModalityID      string     `json:"modality_id"`
	ModalityName    string     `json:"modality_name"`
	Kind            string     `json:"kind"`
	PreviousBelt    *string    `json:"previous_belt"`
	PreviousDegrees *int       `json:"previous_degrees"`
	Belt            string     `json:"belt"`
	Degrees         int        `json:"degrees"`
	OccurredAt      *time.Time `json:"occurred_at"`
	RecordedAt      time.Time  `json:"recorded_at"`
	ActorName       string     `json:"actor_name"`
}
type Progress struct {
	StartedOn         string                     `json:"started_on"`
	TenureDays        int64                      `json:"tenure_days"`
	JoinedAt          time.Time                  `json:"joined_at"`
	TrackingStartedAt time.Time                  `json:"tracking_started_at"`
	ActiveSince       *time.Time                 `json:"active_since"`
	ActiveDays        int64                      `json:"active_days"`
	History           core.Page[GraduationEvent] `json:"history"`
}

func (r Repository) Progress(ctx context.Context, a, id, modality string, page, size int) (Progress, error) {
	out := Progress{History: core.Page[GraduationEvent]{Items: []GraduationEvent{}, Page: page, PageSize: size}}
	// Verify the student before reading any history, including archived students.
	if _, e := r.Get(ctx, a, id); e != nil {
		return out, e
	}
	e := r.DB.QueryRow(ctx, `SELECT s.created_at,s.activity_tracking_started_at,s.started_on::text,GREATEST((now() AT TIME ZONE a.timezone)::date-s.started_on,0),
 (SELECT started_at FROM student_active_periods WHERE academy_id=s.academy_id AND student_id=s.id AND ended_at IS NULL),
 COALESCE((SELECT floor(extract(epoch FROM sum(COALESCE(ended_at,now())-started_at))/86400)::bigint FROM student_active_periods WHERE academy_id=s.academy_id AND student_id=s.id),0)
 FROM students s JOIN academies a ON a.id=s.academy_id WHERE s.academy_id=$1 AND s.id=$2`, a, id).Scan(&out.JoinedAt, &out.TrackingStartedAt, &out.StartedOn, &out.TenureDays, &out.ActiveSince, &out.ActiveDays)
	if e != nil {
		return out, e
	}
	where := " WHERE h.academy_id=$1 AND h.student_id=$2 AND ($3::text='' OR h.modality_id::text=$3)"
	if e = r.DB.QueryRow(ctx, "SELECT count(*) FROM student_graduation_events h"+where, a, id, modality).Scan(&out.History.Total); e != nil {
		return out, e
	}
	rows, e := r.DB.Query(ctx, `SELECT h.id,h.modality_id,m.name,h.kind,h.previous_belt,h.previous_degrees,h.belt,h.degrees,h.occurred_at,h.recorded_at,COALESCE(u.name,'')
 FROM student_graduation_events h JOIN modalities m ON m.academy_id=h.academy_id AND m.id=h.modality_id LEFT JOIN users u ON u.id=h.actor_user_id`+where+" ORDER BY h.sequence DESC LIMIT $4 OFFSET $5", a, id, modality, size, (page-1)*size)
	if e != nil {
		return out, e
	}
	defer rows.Close()
	for rows.Next() {
		var h GraduationEvent
		if e = rows.Scan(&h.ID, &h.ModalityID, &h.ModalityName, &h.Kind, &h.PreviousBelt, &h.PreviousDegrees, &h.Belt, &h.Degrees, &h.OccurredAt, &h.RecordedAt, &h.ActorName); e != nil {
			return out, e
		}
		out.History.Items = append(out.History.Items, h)
	}
	return out, rows.Err()
}
func (h Handler) Progress(w http.ResponseWriter, r *http.Request) {
	a, id := r.PathValue("academy"), r.PathValue("student")
	if _, e := h.Service.Access.Require(r.Context(), a, "admin"); e != nil {
		core.Fail(w, e)
		return
	}
	mod := r.URL.Query().Get("modality_id")
	if !core.ValidID(id) || (mod != "" && !core.ValidID(mod)) {
		core.Fail(w, core.E(422, "invalid_filter", "Confira o aluno e a modalidade."))
		return
	}
	page, size, e := core.Pagination(r)
	if e != nil {
		core.Fail(w, e)
		return
	}
	v, e := h.Service.Repo.Progress(r.Context(), a, id, mod, page, size)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
