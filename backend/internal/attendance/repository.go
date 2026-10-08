package attendance

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"strings"
	"tatame/backend/internal/core"
)

type Repository struct{ DB *pgxpool.Pool }

func (r Repository) History(ctx context.Context, a, session, member string) ([]History, error) {
	rows, e := r.DB.Query(ctx, `SELECT p.id,p.session_id,c.name,u.name,m.belt,p.checked_in_at FROM attendances p JOIN class_sessions s ON s.id=p.session_id AND s.academy_id=p.academy_id JOIN classes c ON c.id=s.class_id AND c.academy_id=s.academy_id JOIN memberships m ON m.id=p.membership_id AND m.academy_id=p.academy_id JOIN users u ON u.id=m.user_id
 WHERE p.academy_id=$1 AND ($2::text='' OR p.session_id::text=$2) AND ($3::text='' OR p.membership_id::text=$3) ORDER BY p.checked_in_at DESC LIMIT 200`, a, session, member)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []History{}
	for rows.Next() {
		var v History
		if e = rows.Scan(&v.ID, &v.SessionID, &v.ClassName, &v.StudentName, &v.Belt, &v.CheckedInAt); e != nil {
			return nil, e
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func (r Repository) SessionClass(ctx context.Context, a, session string, class *string) error {
	return r.DB.QueryRow(ctx, "SELECT class_id FROM class_sessions WHERE academy_id=$1 AND id=$2", a, session).Scan(class)
}

// Record keeps the state-dependent guards and both writes in one transaction.
func (r Repository) Record(ctx context.Context, a, session, key string, in Input) (Result, error) {
	p := core.P(ctx)
	principal := p.UserID
	if p.DeviceID != "" {
		principal = p.DeviceID
	}
	raw, _ := json.Marshal(struct {
		Session string
		Input   Input
	}{session, in})
	hash := core.Hash(string(raw))
	tx, e := r.DB.Begin(ctx)
	if e != nil {
		return Result{}, e
	}
	defer tx.Rollback(ctx)
	if p.DeviceID != "" {
		var active bool
		if e = tx.QueryRow(ctx, "SELECT active FROM devices WHERE academy_id=$1 AND id=$2 FOR SHARE", a, p.DeviceID).Scan(&active); e != nil || !active {
			return Result{}, core.E(401, "device_revoked", "Este tablet foi desautorizado.")
		}
	}
	// Serialize only retries of the same event; unrelated students remain concurrent.
	if _, e = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1,0))", a+principal+key); e != nil {
		return Result{}, e
	}
	var previousHash string
	var previous []byte
	e = tx.QueryRow(ctx, "SELECT payload_hash,result FROM checkin_events WHERE academy_id=$1 AND principal_id=$2 AND event_key=$3", a, principal, key).Scan(&previousHash, &previous)
	if e == nil {
		if hash != previousHash {
			return Result{}, core.E(409, "idempotency_conflict", "Esta tentativa já foi usada para outros dados.")
		}
		var v Result
		if e = json.Unmarshal(previous, &v); e != nil {
			return v, e
		}
		return v, tx.Commit(ctx)
	}
	if !errors.Is(e, pgx.ErrNoRows) {
		return Result{}, e
	}
	var status string
	if e = tx.QueryRow(ctx, "SELECT status FROM class_sessions WHERE academy_id=$1 AND id=$2 FOR SHARE", a, session).Scan(&status); e != nil {
		return Result{}, core.E(404, "not_found", "Aula não encontrada.")
	}
	if status != "open" {
		return Result{}, core.E(409, "session_closed", "Esta aula não está aberta.")
	}
	var mid, name, belt, memberStatus string
	var student bool
	e = tx.QueryRow(ctx, `SELECT m.id,u.name,m.belt,m.status,EXISTS(SELECT 1 FROM membership_roles r WHERE r.membership_id=m.id AND r.role='student')
 FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.academy_id=$1 AND
 (($2::text<>'' AND m.qr_token=$2) OR ($3::text<>'' AND m.student_code=$3) OR ($4::text<>'' AND m.id::text=$4)) FOR SHARE OF m`, a, strings.TrimPrefix(in.QRToken, "tatame:"), in.StudentCode, in.MembershipID).Scan(&mid, &name, &belt, &memberStatus, &student)
	if e != nil || !student {
		return Result{}, core.E(404, "student_not_found", "Aluno não encontrado nesta academia.")
	}
	if memberStatus != "active" {
		return Result{}, core.E(403, "student_blocked", "O vínculo deste aluno está bloqueado.")
	}
	v := Result{ID: core.ID(), MembershipID: mid, StudentName: name, Belt: belt}
	e = tx.QueryRow(ctx, `INSERT INTO attendances(id,academy_id,session_id,membership_id,recorded_by_user_id,device_id) VALUES($1,$2,$3,$4,NULLIF($5,'')::uuid,NULLIF($6,'')::uuid) ON CONFLICT(academy_id,session_id,membership_id) DO NOTHING RETURNING checked_in_at`, v.ID, a, session, mid, p.UserID, p.DeviceID).Scan(&v.CheckedInAt)
	if errors.Is(e, pgx.ErrNoRows) {
		v.Duplicate = true
		e = tx.QueryRow(ctx, "SELECT id,checked_in_at FROM attendances WHERE academy_id=$1 AND session_id=$2 AND membership_id=$3", a, session, mid).Scan(&v.ID, &v.CheckedInAt)
	}
	if e != nil {
		return Result{}, e
	}
	resultJSON, _ := json.Marshal(v)
	if _, e = tx.Exec(ctx, "INSERT INTO checkin_events(academy_id,principal_id,event_key,payload_hash,result) VALUES($1,$2,$3,$4,$5::jsonb)", a, principal, key, hash, string(resultJSON)); e != nil {
		return Result{}, e
	}
	return v, tx.Commit(ctx)
}

func (r Repository) Credential(ctx context.Context, a, id string) (string, string, error) {
	var code, qr string
	err := r.DB.QueryRow(ctx, "SELECT student_code,qr_token FROM memberships WHERE academy_id=$1 AND id=$2", a, id).Scan(&code, &qr)
	return code, qr, err
}
