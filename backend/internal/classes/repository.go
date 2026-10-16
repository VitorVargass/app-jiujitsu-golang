package classes

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"tatame/backend/internal/core"
	"time"
)

type Repository struct{ DB *pgxpool.Pool }

func (r Repository) Classes(ctx context.Context, a string) ([]Class, error) {
	rows, e := r.DB.Query(ctx, `SELECT c.id,c.name,COALESCE(c.teacher_membership_id::text,''),COALESCE(u.name,''),c.active,COALESCE(c.modality_id::text,''),COALESCE(md.name,''),COALESCE((SELECT jsonb_agg(jsonb_build_object('id',sc.id,'class_id',sc.class_id,'weekday',sc.weekday,'start_time',sc.start_time::text,'duration_minutes',sc.duration_minutes) ORDER BY sc.weekday,sc.start_time) FROM class_schedules sc WHERE sc.academy_id=c.academy_id AND sc.class_id=c.id AND sc.deleted_at IS NULL),'[]'::jsonb) FROM classes c LEFT JOIN memberships m ON m.id=c.teacher_membership_id LEFT JOIN users u ON u.id=m.user_id LEFT JOIN modalities md ON md.id=c.modality_id AND md.academy_id=c.academy_id WHERE c.academy_id=$1 AND c.deleted_at IS NULL ORDER BY c.name`, a)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []Class{}
	for rows.Next() {
		var v Class
		if e = rows.Scan(&v.ID, &v.Name, &v.TeacherID, &v.TeacherName, &v.Active, &v.ModalityID, &v.ModalityName, &v.Schedules); e != nil {
			return nil, e
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
func (r Repository) Schedules(ctx context.Context, a, c string) ([]Schedule, error) {
	rows, e := r.DB.Query(ctx, "SELECT id,class_id,weekday,start_time::text,duration_minutes FROM class_schedules WHERE academy_id=$1 AND class_id=$2 AND deleted_at IS NULL AND EXISTS(SELECT 1 FROM classes c WHERE c.academy_id=$1 AND c.id=$2 AND c.deleted_at IS NULL) ORDER BY weekday,start_time", a, c)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []Schedule{}
	for rows.Next() {
		var v Schedule
		if e = rows.Scan(&v.ID, &v.ClassID, &v.Weekday, &v.StartTime, &v.Duration); e != nil {
			return nil, e
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
func (r Repository) Sessions(ctx context.Context, a, date string, onlyOpen bool) ([]Session, error) {
	rows, e := r.DB.Query(ctx, `SELECT s.id,s.class_id,c.name,COALESCE(c.teacher_membership_id::text,''),COALESCE(u.name,''),s.starts_at,s.status,
 (SELECT count(*) FROM attendances p WHERE p.academy_id=s.academy_id AND p.session_id=s.id)
 FROM class_sessions s JOIN classes c ON c.academy_id=s.academy_id AND c.id=s.class_id
 JOIN academies a ON a.id=s.academy_id LEFT JOIN memberships m ON m.id=c.teacher_membership_id LEFT JOIN users u ON u.id=m.user_id
 WHERE s.academy_id=$1 AND ($2::text='' OR (s.starts_at AT TIME ZONE a.timezone)::date::text=$2)
 AND (NOT $3::boolean OR (s.status='open' AND c.deleted_at IS NULL)) ORDER BY s.starts_at DESC LIMIT 100`, a, date, onlyOpen)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []Session{}
	for rows.Next() {
		var v Session
		if e = rows.Scan(&v.ID, &v.ClassID, &v.ClassName, &v.TeacherID, &v.TeacherName, &v.StartsAt, &v.Status, &v.AttendanceCount); e != nil {
			return nil, e
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// Mutating methods keep SQL and database error handling in this layer.
func (r Repository) TeacherActive(ctx context.Context, a, id string) (bool, error) {
	var ok bool
	err := r.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM memberships m JOIN membership_roles r ON r.membership_id=m.id WHERE m.academy_id=$1 AND m.id=$2 AND m.status='active' AND r.role='teacher')`, a, id).Scan(&ok)
	return ok, err
}
func (r Repository) CreateClass(ctx context.Context, a string, in ClassInput) (Class, error) {
	return r.saveClass(ctx, a, "", in)
}
func (r Repository) UpdateClass(ctx context.Context, a, id string, in ClassInput) (Class, error) {
	return r.saveClass(ctx, a, id, in)
}
func (r Repository) saveClass(ctx context.Context, a, id string, in ClassInput) (Class, error) {
	var v Class
	tx, err := r.DB.Begin(ctx)
	if err != nil {
		return v, err
	}
	defer tx.Rollback(ctx)
	if id == "" {
		v = Class{ID: core.ID(), Name: in.Name, TeacherID: in.TeacherID, ModalityID: in.ModalityID, Active: true}
		_, err = tx.Exec(ctx, "INSERT INTO classes(id,academy_id,name,teacher_membership_id,modality_id) VALUES($1,$2,$3,NULLIF($4,'')::uuid,$5)", v.ID, a, v.Name, v.TeacherID, v.ModalityID)
	} else {
		if _, err = lockClass(ctx, tx, a, id); err != nil {
			return v, err
		}
		err = tx.QueryRow(ctx, `UPDATE classes SET name=COALESCE(NULLIF($1,''),name),teacher_membership_id=CASE WHEN $7 THEN NULL ELSE COALESCE(NULLIF($2,'')::uuid,teacher_membership_id) END,active=COALESCE($3,active),modality_id=COALESCE(NULLIF($6,'')::uuid,modality_id) WHERE academy_id=$4 AND id=$5 AND deleted_at IS NULL RETURNING id,name,COALESCE(teacher_membership_id::text,''),active,COALESCE(modality_id::text,'')`, in.Name, in.TeacherID, in.Active, a, id, in.ModalityID, in.ClearTeacher).Scan(&v.ID, &v.Name, &v.TeacherID, &v.Active, &v.ModalityID)
	}
	if err != nil {
		return v, err
	}
	if in.Schedules != nil {
		if err = saveWeekly(ctx, tx, a, v.ID, *in.Schedules); err != nil {
			return v, err
		}
	}
	v.Schedules, err = readWeekly(ctx, tx, a, v.ID)
	if err != nil {
		return v, err
	}
	return v, tx.Commit(ctx)
}

func (r Repository) AddSchedule(ctx context.Context, a, c string, in ScheduleInput) (Schedule, error) {
	v := Schedule{core.ID(), c, in.Weekday, in.StartTime, in.Duration}
	tx, err := r.DB.Begin(ctx)
	if err != nil {
		return v, err
	}
	defer tx.Rollback(ctx)
	if _, err = lockClass(ctx, tx, a, c); err != nil {
		return v, err
	}
	if err = tx.QueryRow(ctx, "INSERT INTO class_schedules(id,academy_id,class_id,weekday,start_time,duration_minutes) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(academy_id,class_id,weekday,start_time) DO UPDATE SET deleted_at=NULL,duration_minutes=EXCLUDED.duration_minutes WHERE class_schedules.deleted_at IS NOT NULL RETURNING id", v.ID, a, c, in.Weekday, in.StartTime, in.Duration).Scan(&v.ID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return v, core.E(409, "duplicate_schedule", "Este dia e horário já estão na agenda.")
		}
		return v, err
	}
	return v, tx.Commit(ctx)
}
func (r Repository) ScheduleForOpen(ctx context.Context, a, c, id string) (string, string, int, bool, error) {
	var zone, start string
	var weekday int
	var active bool
	err := r.DB.QueryRow(ctx, `SELECT a.timezone,sc.start_time::text,sc.weekday,c.active FROM class_schedules sc JOIN academies a ON a.id=sc.academy_id JOIN classes c ON c.id=sc.class_id AND c.academy_id=sc.academy_id WHERE sc.academy_id=$1 AND sc.class_id=$2 AND sc.id=$3 AND sc.deleted_at IS NULL AND c.deleted_at IS NULL`, a, c, id).Scan(&zone, &start, &weekday, &active)
	if errors.Is(err, pgx.ErrNoRows) {
		err = core.E(404, "not_found", "Horário ou turma não disponível.")
	}
	return zone, start, weekday, active, err
}
func (r Repository) Open(ctx context.Context, a, c, schedule string, at time.Time) (Session, error) {
	var v Session
	tx, err := r.DB.Begin(ctx)
	if err != nil {
		return v, err
	}
	defer tx.Rollback(ctx)
	active, err := lockClass(ctx, tx, a, c)
	if err != nil {
		return v, err
	}
	if !active {
		return v, core.E(404, "not_found", "Esta turma não está disponível.")
	}
	var available bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM class_schedules sc JOIN academies ac ON ac.id=sc.academy_id WHERE sc.academy_id=$1 AND sc.class_id=$2 AND sc.id=$3 AND sc.deleted_at IS NULL AND sc.weekday=EXTRACT(DOW FROM $4::timestamptz AT TIME ZONE ac.timezone)::int AND sc.start_time=($4::timestamptz AT TIME ZONE ac.timezone)::time)`, a, c, schedule, at).Scan(&available); err != nil {
		return v, err
	}
	if !available {
		return v, core.E(409, "schedule_changed", "Este horário foi alterado. Atualize a agenda antes de abrir a aula.")
	}
	err = tx.QueryRow(ctx, `INSERT INTO class_sessions(id,academy_id,class_id,schedule_id,starts_at,status) VALUES($1,$2,$3,$4,$5,'open') ON CONFLICT(academy_id,class_id,starts_at) DO UPDATE SET starts_at=class_sessions.starts_at RETURNING id,class_id,starts_at,status`, core.ID(), a, c, schedule, at).Scan(&v.ID, &v.ClassID, &v.StartsAt, &v.Status)
	if err != nil {
		return v, err
	}
	return v, tx.Commit(ctx)
}
func (r Repository) SessionClass(ctx context.Context, a, id string) (string, error) {
	var c string
	err := r.DB.QueryRow(ctx, "SELECT class_id FROM class_sessions WHERE academy_id=$1 AND id=$2", a, id).Scan(&c)
	if errors.Is(err, pgx.ErrNoRows) {
		err = core.E(404, "not_found", "Aula não encontrada.")
	}
	return c, err
}
func (r Repository) SetStatus(ctx context.Context, a, id, status string) error {
	_, err := r.DB.Exec(ctx, "UPDATE class_sessions SET status=$1 WHERE academy_id=$2 AND id=$3", status, a, id)
	return err
}
