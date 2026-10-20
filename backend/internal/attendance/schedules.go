package attendance

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"tatame/backend/internal/core"
)

const earlyArrival = 15 * time.Minute

type LessonOption struct {
	Phase           string    `json:"phase"`
	ScheduleID      string    `json:"schedule_id"`
	Date            string    `json:"date"`
	ClassID         string    `json:"class_id"`
	ClassName       string    `json:"class_name"`
	ModalityName    string    `json:"modality_name"`
	StartsAt        time.Time `json:"starts_at"`
	EndsAt          time.Time `json:"ends_at"`
	SessionID       string    `json:"session_id,omitempty"`
	AttendanceCount int       `json:"attendance_count"`
	Status          string    `json:"status"`
	CanRecord       bool      `json:"can_record"`
}
type Options struct {
	Timezone string         `json:"timezone"`
	Date     string         `json:"date"`
	Options  []LessonOption `json:"options"`
}
type ScheduledInput struct {
	Input
	ScheduleID string `json:"schedule_id,omitempty"`
	Date       string `json:"date,omitempty"`
}
type ManualInput struct {
	StudentID  string `json:"student_id"`
	ScheduleID string `json:"schedule_id"`
	Date       string `json:"date"`
}
type scheduleQuery interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}

func withinLesson(now, start, end time.Time) bool {
	return !now.Before(start.Add(-earlyArrival)) && now.Before(end)
}
func readDay(ctx context.Context, db scheduleQuery, a, date string) ([]LessonOption, error) {
	rows, err := db.Query(ctx, `WITH slots AS (
 SELECT sc.id,c.id AS class_id,c.name,COALESCE(m.name,'') AS modality_name,
 ($2::date+sc.start_time) AT TIME ZONE ac.timezone AS starts_at,sc.duration_minutes
 FROM class_schedules sc JOIN classes c ON c.academy_id=sc.academy_id AND c.id=sc.class_id
 JOIN academies ac ON ac.id=sc.academy_id
 LEFT JOIN modalities m ON m.academy_id=c.academy_id AND m.id=c.modality_id
 WHERE sc.academy_id=$1 AND c.active AND c.deleted_at IS NULL AND sc.deleted_at IS NULL
 AND sc.weekday=EXTRACT(DOW FROM $2::date)::int)
 SELECT p.id,p.class_id,p.name,p.modality_name,p.starts_at,p.starts_at+make_interval(mins=>p.duration_minutes),
 COALESCE(s.id::text,''),COALESCE(s.status,'scheduled'),
 (SELECT count(*) FROM attendances att WHERE att.academy_id=$1 AND att.session_id=s.id)
 FROM slots p LEFT JOIN class_sessions s ON s.academy_id=$1 AND s.class_id=p.class_id AND s.starts_at=p.starts_at
 ORDER BY p.starts_at,p.name,p.id`, a, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []LessonOption{}
	for rows.Next() {
		var v LessonOption
		v.Date = date
		if err = rows.Scan(&v.ScheduleID, &v.ClassID, &v.ClassName, &v.ModalityName, &v.StartsAt, &v.EndsAt, &v.SessionID, &v.Status, &v.AttendanceCount); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
func (r Repository) Options(ctx context.Context, a, date string, tablet bool, now time.Time) (Options, error) {
	out := Options{Options: []LessonOption{}}
	if err := r.DB.QueryRow(ctx, "SELECT timezone FROM academies WHERE id=$1", a).Scan(&out.Timezone); err != nil {
		return out, err
	}
	loc, err := time.LoadLocation(out.Timezone)
	if err != nil {
		return out, err
	}
	local := now.In(loc)
	out.Date = local.Format("2006-01-02")
	dates := []string{date}
	if tablet {
		if date != "" {
			return out, core.E(422, "invalid_date", "O tablet usa o dia e horário atuais da academia.")
		}
		dates = []string{local.AddDate(0, 0, -1).Format("2006-01-02"), out.Date, local.AddDate(0, 0, 1).Format("2006-01-02")}
	} else {
		if date == "" {
			dates[0] = out.Date
		} else {
			out.Date = date
		}
		if _, err = time.Parse("2006-01-02", out.Date); err != nil {
			return out, core.E(422, "invalid_date", "Informe a data no formato AAAA-MM-DD.")
		}
	}
	for _, day := range dates {
		options, e := readDay(ctx, r.DB, a, day)
		if e != nil {
			return out, e
		}
		for _, v := range options {
			if v.Status == "cancelled" {
				continue
			}
			if tablet && (v.Status == "closed" || !withinLesson(now, v.StartsAt, v.EndsAt)) {
				continue
			}
			v.CanRecord = !now.Before(v.StartsAt.Add(-earlyArrival))
			v.Phase = "upcoming"
			if !now.Before(v.EndsAt) {
				v.Phase = "ended"
			} else if withinLesson(now, v.StartsAt, v.EndsAt) {
				v.Phase = "live"
			}
			if v.Status == "open" && !now.Before(v.EndsAt) {
				v.Status = "closed"
			}
			out.Options = append(out.Options, v)
		}
	}
	return out, nil
}

// resolveScheduled is called after locking the event key. Creation of the
// occurrence, attendance and event result all commit together.
func resolveScheduled(ctx context.Context, tx pgx.Tx, a string, in ScheduledInput, manual bool, now time.Time) (LessonOption, error) {
	var zone string
	if err := tx.QueryRow(ctx, "SELECT timezone FROM academies WHERE id=$1", a).Scan(&zone); err != nil {
		return LessonOption{}, err
	}
	loc, err := time.LoadLocation(zone)
	if err != nil {
		return LessonOption{}, err
	}
	local := now.In(loc)
	dates := []string{in.Date}
	if !manual {
		dates = []string{local.AddDate(0, 0, -1).Format("2006-01-02"), local.Format("2006-01-02"), local.AddDate(0, 0, 1).Format("2006-01-02")}
	}
	matches := []LessonOption{}
	for _, day := range dates {
		options, e := readDay(ctx, tx, a, day)
		if e != nil {
			return LessonOption{}, e
		}
		for _, v := range options {
			if !manual && in.ScheduleID == "" && (v.Status == "closed" || v.Status == "cancelled") {
				continue
			}
			if in.ScheduleID != "" && v.ScheduleID != in.ScheduleID {
				continue
			}
			if in.Date != "" && v.Date != in.Date {
				continue
			}
			if !manual && !withinLesson(now, v.StartsAt, v.EndsAt) {
				continue
			}
			matches = append(matches, v)
		}
	}
	if len(matches) == 0 {
		return LessonOption{}, core.E(409, "no_scheduled_class", "Não há aula prevista neste horário. Confira a agenda da academia.")
	}
	if len(matches) > 1 {
		return LessonOption{}, core.E(409, "class_choice_required", "Há mais de uma aula neste horário. Escolha a aula para confirmar.")
	}
	v := matches[0]
	// Weekly edits/deletion also lock the class before schedules/sessions.
	var modality string
	err = tx.QueryRow(ctx, "SELECT COALESCE(modality_id::text,'') FROM classes WHERE academy_id=$1 AND id=$2 AND active AND deleted_at IS NULL FOR SHARE", a, v.ClassID).Scan(&modality)
	if errors.Is(err, pgx.ErrNoRows) {
		return v, core.E(409, "schedule_changed", "A turma mudou. Atualize os horários.")
	}
	if err != nil {
		return v, err
	}
	// Re-read while the class lock prevents weekly edits from racing this record.
	options, err := readDay(ctx, tx, a, v.Date)
	if err != nil {
		return v, err
	}
	found := false
	for _, candidate := range options {
		if candidate.ScheduleID == v.ScheduleID {
			v = candidate
			found = true
			break
		}
	}
	if !found {
		return v, core.E(409, "schedule_changed", "O horário mudou. Atualize a agenda.")
	}
	if manual && now.Before(v.StartsAt.Add(-earlyArrival)) {
		return v, core.E(422, "future_attendance", "Não é possível registrar presença em uma aula futura.")
	}
	if !manual && !withinLesson(now, v.StartsAt, v.EndsAt) {
		return v, core.E(409, "outside_class_time", "O horário desta aula terminou. Atualize o tablet.")
	}
	status := "open"
	if !now.Before(v.EndsAt) {
		status = "closed"
	}
	if _, err = tx.Exec(ctx, "INSERT INTO class_sessions(id,academy_id,class_id,schedule_id,starts_at,status) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(academy_id,class_id,starts_at) DO NOTHING", core.ID(), a, v.ClassID, v.ScheduleID, v.StartsAt, status); err != nil {
		return v, err
	}
	err = tx.QueryRow(ctx, "SELECT id,status FROM class_sessions WHERE academy_id=$1 AND class_id=$2 AND starts_at=$3 FOR SHARE", a, v.ClassID, v.StartsAt).Scan(&v.SessionID, &v.Status)
	return v, err
}
