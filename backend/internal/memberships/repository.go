package memberships

import (
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"strings"
	"tatame/backend/internal/access"
	"tatame/backend/internal/core"
)

type Repository struct{ DB *pgxpool.Pool }

func (r Repository) Requests(ctx context.Context, a, u string) ([]Request, error) {
	rows, e := r.DB.Query(ctx, `SELECT q.id,q.academy_id,a.name,q.user_id,u.name,q.role,q.status FROM membership_requests q JOIN users u ON u.id=q.user_id JOIN academies a ON a.id=q.academy_id
 WHERE ($1::text='' OR q.academy_id::text=$1) AND ($2::text='' OR q.user_id::text=$2) ORDER BY q.created_at DESC`, a, u)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []Request{}
	for rows.Next() {
		var q Request
		if e = rows.Scan(&q.ID, &q.AcademyID, &q.AcademyName, &q.UserID, &q.Name, &q.Role, &q.Status); e != nil {
			return nil, e
		}
		out = append(out, q)
	}
	return out, rows.Err()
}
func (r Repository) Members(ctx context.Context, a string) ([]access.Membership, error) {
	rows, e := r.DB.Query(ctx, `SELECT m.id,m.academy_id,m.user_id,u.name,m.status,m.belt,
 COALESCE((SELECT array_agg(role ORDER BY role) FROM membership_roles r WHERE r.membership_id=m.id),'{}'::text[])
 FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.academy_id=$1 ORDER BY u.name`, a)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []access.Membership{}
	for rows.Next() {
		var m access.Membership
		if e = rows.Scan(&m.ID, &m.AcademyID, &m.UserID, &m.Name, &m.Status, &m.Belt, &m.Roles); e != nil {
			return nil, e
		}
		out = append(out, m)
	}
	return out, rows.Err()
}
func (r Repository) Decide(ctx context.Context, a, id, status string) error {
	tx, e := r.DB.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	var lock string
	if e = tx.QueryRow(ctx, "SELECT id FROM academies WHERE id=$1 FOR UPDATE", a).Scan(&lock); e != nil {
		return e
	}
	var u, role, previous string
	if e = tx.QueryRow(ctx, "SELECT user_id,role,status FROM membership_requests WHERE academy_id=$1 AND id=$2 FOR UPDATE", a, id).Scan(&u, &role, &previous); e != nil {
		return core.E(404, "not_found", "Solicitação não encontrada.")
	}
	if previous != "pending" {
		return core.E(409, "already_decided", "Esta solicitação já foi analisada.")
	}
	if status == "approved" {
		var mid string
		e = tx.QueryRow(ctx, `INSERT INTO memberships(id,academy_id,user_id,status,student_code,qr_token) VALUES($1,$2,$3,'active',$4,$5)
  ON CONFLICT(academy_id,user_id) DO UPDATE SET status='active' RETURNING id`, core.ID(), a, u, core.Digits(), core.Token()).Scan(&mid)
		if e != nil {
			return e
		}
		if _, e = tx.Exec(ctx, "INSERT INTO membership_roles VALUES($1,$2) ON CONFLICT DO NOTHING", mid, role); e != nil {
			return e
		}
	}
	if _, e = tx.Exec(ctx, "UPDATE membership_requests SET status=$1 WHERE academy_id=$2 AND id=$3", status, a, id); e != nil {
		return e
	}
	return tx.Commit(ctx)
}

func (r Repository) Request(ctx context.Context, userID string, in RequestInput) (Request, error) {
	var a string
	if e := r.DB.QueryRow(ctx, "SELECT id FROM academies WHERE code=$1", strings.ToLower(strings.TrimSpace(in.AcademyCode))).Scan(&a); e != nil {
		return Request{}, core.E(404, "invalid_code", "Código da academia não encontrado.")
	}
	var granted bool
	_ = r.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM memberships m JOIN membership_roles r ON r.membership_id=m.id WHERE m.academy_id=$1 AND m.user_id=$2 AND r.role=$3)`, a, userID, in.Role).Scan(&granted)
	if granted {
		return Request{}, core.E(409, "already_member", "Você já possui este papel na academia.")
	}
	var id string
	e := r.DB.QueryRow(ctx, `INSERT INTO membership_requests(id,academy_id,user_id,role) VALUES($1,$2,$3,$4)
 ON CONFLICT(academy_id,user_id,role) DO UPDATE SET status=CASE WHEN membership_requests.status='rejected' THEN 'pending' ELSE membership_requests.status END RETURNING id`, core.ID(), a, userID, in.Role).Scan(&id)
	return Request{ID: id, AcademyID: a, UserID: userID, Role: in.Role, Status: "pending"}, e
}

func (r Repository) Update(ctx context.Context, a, id string, in Update) error {
	tx, e := r.DB.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	var lock string
	if e = tx.QueryRow(ctx, "SELECT id FROM academies WHERE id=$1 FOR UPDATE", a).Scan(&lock); e != nil {
		return e
	}
	var oldStatus string
	if e = tx.QueryRow(ctx, "SELECT status FROM memberships WHERE academy_id=$1 AND id=$2 FOR UPDATE", a, id).Scan(&oldStatus); e != nil {
		return core.E(404, "not_found", "Vínculo não encontrado.")
	}
	var isAdmin bool
	if e = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM membership_roles WHERE membership_id=$1 AND role='admin')", id).Scan(&isAdmin); e != nil {
		return e
	}
	removesAdmin := in.Status == "blocked" || (in.Roles != nil && !access.Has(in.Roles, "admin"))
	if isAdmin && oldStatus == "active" && removesAdmin {
		var n int
		if e = tx.QueryRow(ctx, `SELECT count(*) FROM memberships m JOIN membership_roles r ON r.membership_id=m.id WHERE m.academy_id=$1 AND m.status='active' AND r.role='admin'`, a).Scan(&n); e != nil {
			return e
		}
		if n <= 1 {
			return core.E(409, "last_admin", "A academia precisa manter pelo menos um gestor ativo.")
		}
	}
	if _, e = tx.Exec(ctx, `UPDATE memberships SET status=COALESCE(NULLIF($1,''),status),belt=COALESCE(NULLIF($2,''),belt) WHERE academy_id=$3 AND id=$4`, in.Status, in.Belt, a, id); e != nil {
		return e
	}
	if in.Roles != nil {
		if _, e = tx.Exec(ctx, "DELETE FROM membership_roles WHERE membership_id=$1", id); e != nil {
			return e
		}
		for _, role := range in.Roles {
			if _, e = tx.Exec(ctx, "INSERT INTO membership_roles VALUES($1,$2) ON CONFLICT DO NOTHING", id, role); e != nil {
				return e
			}
		}
	}
	return tx.Commit(ctx)
}
