package students

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"tatame/backend/internal/billing"
	"tatame/backend/internal/core"
	"time"
)

type Repository struct{ DB *pgxpool.Pool }

const studentJSON = `jsonb_build_object('id',s.id,'academy_id',s.academy_id,'user_id',COALESCE(s.user_id::text,''),'name',s.name,'email',s.email,'phone',s.phone,'status',s.status,'belt',s.belt,'plan_id',COALESCE(s.plan_id::text,''),'student_code',s.student_code,
 'modality_ids',COALESCE((SELECT jsonb_agg(modality_id) FROM student_modalities WHERE academy_id=s.academy_id AND student_id=s.id),'[]'::jsonb),
 'billing',(SELECT jsonb_build_object('enabled',b.enabled,'amount_cents',b.amount_cents,'due_day',b.due_day,'first_month',to_char(b.next_month,'YYYY-MM'),'payer_name',b.payer_name,'payer_document',b.payer_document) FROM student_billing b WHERE b.academy_id=s.academy_id AND b.student_id=s.id))`

func (r Repository) Get(ctx context.Context, a, id string) (Student, error) {
	var v Student
	var raw []byte
	e := r.DB.QueryRow(ctx, "SELECT "+studentJSON+" FROM students s WHERE academy_id=$1 AND id=$2", a, id).Scan(&raw)
	if errors.Is(e, pgx.ErrNoRows) {
		return v, core.E(404, "not_found", "Aluno não encontrado.")
	}
	if e != nil {
		return v, e
	}
	e = json.Unmarshal(raw, &v)
	return v, e
}
func (r Repository) OwnID(ctx context.Context, a, u string) (string, error) {
	var id string
	e := r.DB.QueryRow(ctx, "SELECT id FROM students WHERE academy_id=$1 AND user_id=$2", a, u).Scan(&id)
	if e != nil {
		return "", core.E(403, "forbidden", "Você não tem acesso ao cadastro de aluno desta academia.")
	}
	return id, nil
}
func (r Repository) List(ctx context.Context, a, search, status, modality string, page, size int) (core.Page[Student], error) {
	out := core.Page[Student]{Items: []Student{}, Page: page, PageSize: size}
	if e := r.DB.QueryRow(ctx, "SELECT count(*) FROM students s WHERE academy_id=$1 AND name ILIKE '%'||$2||'%' AND ($3::text='' OR status=$3) AND ($4::text='' OR EXISTS(SELECT 1 FROM student_modalities sm WHERE sm.academy_id=s.academy_id AND sm.student_id=s.id AND sm.modality_id::text=$4))", a, search, status, modality).Scan(&out.Total); e != nil {
		return out, e
	}
	rows, e := r.DB.Query(ctx, "SELECT "+studentJSON+" FROM students s WHERE academy_id=$1 AND name ILIKE '%'||$2||'%' AND ($3::text='' OR status=$3) AND ($4::text='' OR EXISTS(SELECT 1 FROM student_modalities sm WHERE sm.academy_id=s.academy_id AND sm.student_id=s.id AND sm.modality_id::text=$4)) ORDER BY name,id LIMIT $5 OFFSET $6", a, search, status, modality, size, (page-1)*size)
	if e != nil {
		return out, e
	}
	defer rows.Close()
	for rows.Next() {
		var raw []byte
		var v Student
		if e = rows.Scan(&raw); e != nil {
			return out, e
		}
		if e = json.Unmarshal(raw, &v); e != nil {
			return out, e
		}
		out.Items = append(out.Items, v)
	}
	return out, rows.Err()
}
func (r Repository) Save(ctx context.Context, a, id string, in Input) (Student, error) {
	tx, e := r.DB.Begin(ctx)
	if e != nil {
		return Student{}, e
	}
	defer tx.Rollback(ctx)
	if id == "" {
		id = core.ID()
		_, e = tx.Exec(ctx, `INSERT INTO students(id,academy_id,name,email,phone,status,belt,student_code,qr_token,plan_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,NULLIF($10,'')::uuid)`, id, a, in.Name, in.Email, in.Phone, in.Status, in.Belt, core.Digits(), core.Token(), in.PlanID)
	} else {
		if e = billing.GenerateTx(ctx, tx, a, id, time.Now()); e != nil {
			return Student{}, e
		}
		result, err := tx.Exec(ctx, `UPDATE students SET name=$3,email=$4,phone=$5,status=$6,belt=$7,plan_id=NULLIF($8,'')::uuid WHERE academy_id=$1 AND id=$2`, a, id, in.Name, in.Email, in.Phone, in.Status, in.Belt, in.PlanID)
		e = err
		if e == nil && result.RowsAffected() == 0 {
			e = core.E(404, "not_found", "Aluno não encontrado.")
		}
	}
	if e != nil {
		return Student{}, e
	}
	if _, e = tx.Exec(ctx, "DELETE FROM student_modalities WHERE academy_id=$1 AND student_id=$2", a, id); e != nil {
		return Student{}, e
	}
	for _, mid := range in.Modalities {
		if _, e = tx.Exec(ctx, "INSERT INTO student_modalities VALUES($1,$2,$3) ON CONFLICT DO NOTHING", a, id, mid); e != nil {
			return Student{}, e
		}
	}
	if in.Billing != nil {
		b := in.Billing
		_, e = tx.Exec(ctx, `INSERT INTO student_billing(academy_id,student_id,enabled,amount_cents,due_day,next_month,payer_name,payer_document)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(academy_id,student_id) DO UPDATE SET
  enabled=EXCLUDED.enabled,amount_cents=EXCLUDED.amount_cents,due_day=EXCLUDED.due_day,
  next_month=CASE WHEN NOT student_billing.enabled AND EXCLUDED.enabled THEN EXCLUDED.next_month ELSE student_billing.next_month END,
  payer_name=EXCLUDED.payer_name,payer_document=EXCLUDED.payer_document`, a, id, b.Enabled && in.Status == "active", b.AmountCents, b.DueDay, b.FirstMonth+"-01", b.PayerName, b.PayerDocument)
		if e != nil {
			return Student{}, e
		}
	}
	if in.Status == "inactive" {
		if _, e = tx.Exec(ctx, "UPDATE student_billing SET enabled=false WHERE academy_id=$1 AND student_id=$2", a, id); e != nil {
			return Student{}, e
		}
	}
	if e = billing.GenerateTx(ctx, tx, a, id, time.Now()); e != nil {
		return Student{}, e
	}
	if e = tx.Commit(ctx); e != nil {
		return Student{}, e
	}
	return r.Get(ctx, a, id)
}
func (r Repository) Catalog(ctx context.Context, a string, plans bool) ([]Catalog, error) {
	query := "SELECT id,name,active FROM modalities WHERE academy_id=$1 ORDER BY name"
	if plans {
		query = `SELECT p.id,p.name,p.active,p.amount_cents,COALESCE((SELECT array_agg(modality_id::text ORDER BY modality_id) FROM plan_modalities WHERE academy_id=p.academy_id AND plan_id=p.id),'{}'::text[]) FROM plans p WHERE academy_id=$1 ORDER BY name`
	}
	rows, e := r.DB.Query(ctx, query, a)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []Catalog{}
	for rows.Next() {
		var v Catalog
		v.Modalities = []string{}
		if plans {
			e = rows.Scan(&v.ID, &v.Name, &v.Active, &v.AmountCents, &v.Modalities)
		} else {
			e = rows.Scan(&v.ID, &v.Name, &v.Active)
		}
		if e != nil {
			return nil, e
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
func (r Repository) SaveCatalog(ctx context.Context, a, id string, in Catalog, plans bool) (Catalog, error) {
	tx, e := r.DB.Begin(ctx)
	if e != nil {
		return in, e
	}
	defer tx.Rollback(ctx)
	table := "modalities"
	if plans {
		table = "plans"
	}
	if id == "" {
		id = core.ID()
		if plans {
			_, e = tx.Exec(ctx, "INSERT INTO plans(id,academy_id,name,active,amount_cents) VALUES($1,$2,$3,$4,$5)", id, a, in.Name, in.Active, in.AmountCents)
		} else {
			_, e = tx.Exec(ctx, "INSERT INTO modalities(id,academy_id,name,active) VALUES($1,$2,$3,$4)", id, a, in.Name, in.Active)
		}
	} else {
		var n int64
		if plans {
			v, err := tx.Exec(ctx, "UPDATE plans SET name=$3,active=$4,amount_cents=$5 WHERE academy_id=$1 AND id=$2", a, id, in.Name, in.Active, in.AmountCents)
			e = err
			n = v.RowsAffected()
		} else {
			v, err := tx.Exec(ctx, "UPDATE "+table+" SET name=$3,active=$4 WHERE academy_id=$1 AND id=$2", a, id, in.Name, in.Active)
			e = err
			n = v.RowsAffected()
		}
		if e == nil && n == 0 {
			e = core.E(404, "not_found", "Cadastro não encontrado.")
		}
	}
	if e != nil {
		return in, e
	}
	if plans {
		if _, e = tx.Exec(ctx, "DELETE FROM plan_modalities WHERE academy_id=$1 AND plan_id=$2", a, id); e != nil {
			return in, e
		}
		for _, m := range in.Modalities {
			if _, e = tx.Exec(ctx, "INSERT INTO plan_modalities VALUES($1,$2,$3) ON CONFLICT DO NOTHING", a, id, m); e != nil {
				return in, e
			}
		}
	}
	in.ID = id
	return in, tx.Commit(ctx)
}
func (r Repository) Invite(ctx context.Context, a, id string) (string, error) {
	tx, e := r.DB.Begin(ctx)
	if e != nil {
		return "", e
	}
	defer tx.Rollback(ctx)
	var linked bool
	e = tx.QueryRow(ctx, "SELECT user_id IS NOT NULL FROM students WHERE academy_id=$1 AND id=$2 FOR UPDATE", a, id).Scan(&linked)
	if e != nil {
		return "", core.E(404, "not_found", "Aluno não encontrado.")
	}
	if linked {
		return "", core.E(409, "already_linked", "Este aluno já possui uma conta vinculada.")
	}
	_, e = tx.Exec(ctx, "UPDATE student_invitations SET revoked_at=now() WHERE academy_id=$1 AND student_id=$2 AND accepted_at IS NULL AND revoked_at IS NULL", a, id)
	if e != nil {
		return "", e
	}
	token := core.Token()
	_, e = tx.Exec(ctx, "INSERT INTO student_invitations(token_hash,academy_id,student_id,expires_at) VALUES($1,$2,$3,now()+interval '7 days')", core.Hash(token), a, id)
	if e != nil {
		return "", e
	}
	return token, tx.Commit(ctx)
}
func (r Repository) Revoke(ctx context.Context, a, id string) error {
	_, e := r.DB.Exec(ctx, "UPDATE student_invitations SET revoked_at=now() WHERE academy_id=$1 AND student_id=$2 AND accepted_at IS NULL", a, id)
	return e
}
func (r Repository) Accept(ctx context.Context, token, u string) (Student, error) {
	tx, e := r.DB.Begin(ctx)
	if e != nil {
		return Student{}, e
	}
	defer tx.Rollback(ctx)
	var a, id string
	e = tx.QueryRow(ctx, `SELECT academy_id,student_id FROM student_invitations WHERE token_hash=$1 AND expires_at>now() AND revoked_at IS NULL AND accepted_at IS NULL FOR UPDATE`, core.Hash(token)).Scan(&a, &id)
	if e != nil {
		return Student{}, core.E(410, "invalid_invitation", "Convite inválido, expirado ou já utilizado.")
	}
	var linked, code, qr string
	e = tx.QueryRow(ctx, "SELECT COALESCE(user_id::text,''),student_code,qr_token FROM students WHERE academy_id=$1 AND id=$2 FOR UPDATE", a, id).Scan(&linked, &code, &qr)
	if e != nil {
		return Student{}, e
	}
	if linked != "" {
		return Student{}, core.E(409, "already_linked", "Este aluno já possui uma conta.")
	}
	_, e = tx.Exec(ctx, "UPDATE students SET user_id=$1 WHERE academy_id=$2 AND id=$3", u, a, id)
	if e != nil {
		return Student{}, e
	}
	var mid string
	e = tx.QueryRow(ctx, `INSERT INTO memberships(id,academy_id,user_id,status,student_code,qr_token) VALUES($1,$2,$3,'active',$4,$5) ON CONFLICT(academy_id,user_id) DO UPDATE SET status=memberships.status RETURNING id`, core.ID(), a, u, code, core.Token()).Scan(&mid)
	if e != nil {
		return Student{}, e
	}
	if _, e = tx.Exec(ctx, "INSERT INTO membership_roles VALUES($1,'student') ON CONFLICT DO NOTHING", mid); e != nil {
		return Student{}, e
	}
	if _, e = tx.Exec(ctx, "UPDATE student_invitations SET accepted_at=now(),accepted_by=$1 WHERE token_hash=$2", u, core.Hash(token)); e != nil {
		return Student{}, e
	}
	if e = tx.Commit(ctx); e != nil {
		return Student{}, e
	}
	return r.Get(ctx, a, id)
}
