package attendance

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"tatame/backend/internal/core"
)

func (r Repository) record(ctx context.Context, a, session, key string, in Input, plan *ScheduledInput, manual bool) (Result, error) {
	p := core.P(ctx)
	principal := p.UserID
	if p.DeviceID != "" {
		principal = p.DeviceID
	}
	var raw []byte
	if plan == nil {
		raw, _ = json.Marshal(struct {
			Session string
			Input   Input
		}{session, in})
	} else {
		mode := "scheduled"
		if manual {
			mode = "manual"
		}
		raw, _ = json.Marshal(struct {
			Mode  string
			Input ScheduledInput
		}{mode, *plan})
	}
	hash := core.Hash(string(raw))
	tx, err := r.DB.Begin(ctx)
	if err != nil {
		return Result{}, err
	}
	defer tx.Rollback(ctx)
	if p.DeviceID != "" {
		var active bool
		if err = tx.QueryRow(ctx, "SELECT active FROM devices WHERE academy_id=$1 AND id=$2 FOR SHARE", a, p.DeviceID).Scan(&active); err != nil || !active {
			return Result{}, core.E(401, "device_revoked", "Este tablet foi desautorizado.")
		}
	} else if manual {
		var membership string
		err = tx.QueryRow(ctx, `SELECT m.id FROM memberships m JOIN membership_roles r ON r.membership_id=m.id
 WHERE m.academy_id=$1 AND m.user_id=$2 AND m.status='active' AND r.role='admin' FOR SHARE OF m,r`, a, p.UserID).Scan(&membership)
		if errors.Is(err, pgx.ErrNoRows) {
			return Result{}, core.E(403, "forbidden", "Somente o gestor desta academia pode lançar presença.")
		}
		if err != nil {
			return Result{}, err
		}
	}
	if _, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1,0))", a+principal+key); err != nil {
		return Result{}, err
	}
	var oldHash string
	var oldResult []byte
	err = tx.QueryRow(ctx, "SELECT payload_hash,result FROM checkin_events WHERE academy_id=$1 AND principal_id=$2 AND event_key=$3", a, principal, key).Scan(&oldHash, &oldResult)
	if err == nil {
		if hash != oldHash {
			return Result{}, core.E(409, "idempotency_conflict", "Esta tentativa já foi usada para outros dados.")
		}
		var result Result
		if err = json.Unmarshal(oldResult, &result); err != nil {
			return result, err
		}
		return result, tx.Commit(ctx)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return Result{}, err
	}
	var status, modality, className string
	var starts time.Time
	if plan != nil {
		lesson, e := resolveScheduled(ctx, tx, a, *plan, manual, time.Now())
		if e != nil {
			return Result{}, e
		}
		session, status, className, starts = lesson.SessionID, lesson.Status, lesson.ClassName, lesson.StartsAt
		if err = tx.QueryRow(ctx, "SELECT COALESCE(modality_id::text,'') FROM classes WHERE academy_id=$1 AND id=$2", a, lesson.ClassID).Scan(&modality); err != nil {
			return Result{}, err
		}
	} else {
		err = tx.QueryRow(ctx, "SELECT COALESCE(c.modality_id::text,''),c.name,s.starts_at FROM classes c JOIN class_sessions s ON s.academy_id=c.academy_id AND s.class_id=c.id WHERE s.academy_id=$1 AND s.id=$2 AND c.deleted_at IS NULL FOR SHARE OF c", a, session).Scan(&modality, &className, &starts)
		if err != nil {
			return Result{}, core.E(404, "not_found", "Aula não encontrada.")
		}
		if err = tx.QueryRow(ctx, "SELECT status FROM class_sessions WHERE academy_id=$1 AND id=$2 FOR SHARE", a, session).Scan(&status); err != nil {
			return Result{}, core.E(404, "not_found", "Aula não encontrada.")
		}
	}
	if status == "cancelled" {
		return Result{}, core.E(409, "session_cancelled", "Esta aula foi cancelada.")
	}
	if status != "open" && !(manual && status == "closed") {
		return Result{}, core.E(409, "session_closed", "Esta aula está encerrada.")
	}
	part, student, name, belt, err := identify(ctx, tx, a, in, modality)
	if err != nil {
		return Result{}, err
	}
	source := "tablet"
	if manual {
		source = "manager"
	}
	result := Result{ID: core.ID(), MembershipID: part, ParticipantID: part, StudentID: student, StudentName: name, Belt: belt, SessionID: session, ClassName: className, StartsAt: &starts, Source: source}
	if student != "" {
		result.MembershipID = student
	}
	err = tx.QueryRow(ctx, `INSERT INTO attendances(id,academy_id,session_id,participant_id,recorded_by_user_id,device_id)
 VALUES($1,$2,$3,$4,NULLIF($5,'')::uuid,NULLIF($6,'')::uuid)
 ON CONFLICT(academy_id,session_id,participant_id) DO NOTHING RETURNING checked_in_at`, result.ID, a, session, part, p.UserID, p.DeviceID).Scan(&result.CheckedInAt)
	if errors.Is(err, pgx.ErrNoRows) {
		result.Duplicate = true
		err = tx.QueryRow(ctx, "SELECT id,checked_in_at,CASE WHEN recorded_by_user_id IS NOT NULL THEN 'manager' ELSE 'tablet' END FROM attendances WHERE academy_id=$1 AND session_id=$2 AND participant_id=$3", a, session, part).Scan(&result.ID, &result.CheckedInAt, &result.Source)
	}
	if err != nil {
		return Result{}, err
	}
	data, _ := json.Marshal(result)
	if _, err = tx.Exec(ctx, "INSERT INTO checkin_events(academy_id,principal_id,event_key,payload_hash,result) VALUES($1,$2,$3,$4,$5::jsonb)", a, principal, key, hash, string(data)); err != nil {
		return Result{}, err
	}
	return result, tx.Commit(ctx)
}
