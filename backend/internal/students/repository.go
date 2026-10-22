package students

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

const studentJSON = `jsonb_build_object('id',s.id,'academy_id',s.academy_id,'user_id',COALESCE(s.user_id::text,''),'name',s.name,'email',COALESCE(i.email,''),'cpf',p.cpf,'person_id',s.person_id,'participant_id',s.participant_id,'email_locked',(EXISTS(SELECT 1 FROM users WHERE person_id=s.person_id) OR (SELECT count(*) FROM academy_participants WHERE person_id=s.person_id)>1),'birth_date',COALESCE(to_char(s.birth_date,'YYYY-MM-DD'),''),'started_on',to_char(s.started_on,'YYYY-MM-DD'),'archived_at',s.archived_at,'phone',s.phone,'alternate_phone',s.alternate_phone,'charge_mode',s.charge_mode,'status',s.status,'belt',s.belt,'plan_id',COALESCE(s.plan_id::text,''),'student_code',p.student_code,
 'modality_details',COALESCE((SELECT jsonb_agg(jsonb_build_object('modality_id',sm.modality_id,'belt',sm.belt,'degrees',sm.degrees,'amount_cents',sm.amount_cents) ORDER BY sm.modality_id) FROM student_modalities sm WHERE sm.academy_id=s.academy_id AND sm.student_id=s.id),'[]'::jsonb),
 'modality_ids',COALESCE((SELECT jsonb_agg(modality_id ORDER BY modality_id) FROM student_modalities WHERE academy_id=s.academy_id AND student_id=s.id),'[]'::jsonb),
 'billing',(SELECT jsonb_build_object('enabled',b.enabled,'amount_cents',b.amount_cents,'due_day',b.due_day,'first_month',to_char(b.next_month,'YYYY-MM'),'payer_name',b.payer_name,'payer_document',b.payer_document) FROM student_billing b WHERE b.academy_id=s.academy_id AND b.student_id=s.id))`

func (r Repository) Get(ctx context.Context, a, id string) (Student, error) {
	var v Student
	var raw []byte
	e := r.DB.QueryRow(ctx, "SELECT "+studentJSON+" FROM students s JOIN academy_participants p ON p.academy_id=s.academy_id AND p.id=s.participant_id JOIN people i ON i.id=s.person_id WHERE s.academy_id=$1 AND s.id=$2", a, id).Scan(&raw)
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
	search = strings.TrimSpace(search)
	cpf, valid := core.NormalizeCPF(search)
	if !valid {
		cpf = ""
	}
	where := ` FROM students s JOIN academy_participants p ON p.academy_id=s.academy_id AND p.id=s.participant_id JOIN people i ON i.id=s.person_id WHERE s.academy_id=$1
 AND (s.name ILIKE '%'||$2||'%' OR ($5::text<>'' AND p.cpf=$5) OR p.student_code=$2)
 AND (($3::text='' AND (s.archived_at IS NULL OR $5::text<>'' OR p.student_code=$2))
   OR ($3='archived' AND s.archived_at IS NOT NULL)
   OR ($3 IN ('active','inactive') AND s.archived_at IS NULL AND s.status=$3))
 AND ($4::text='' OR EXISTS(SELECT 1 FROM student_modalities sm WHERE sm.academy_id=s.academy_id AND sm.student_id=s.id AND sm.modality_id::text=$4))`
	args := []any{a, search, status, modality, cpf}
	if err := r.DB.QueryRow(ctx, "SELECT count(*)"+where, args...).Scan(&out.Total); err != nil {
		return out, err
	}
	rows, err := r.DB.Query(ctx, "SELECT "+studentJSON+where+" ORDER BY s.name,s.id LIMIT $6 OFFSET $7", append(args, size, (page-1)*size)...)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var raw []byte
		var student Student
		if err = rows.Scan(&raw); err != nil {
			return out, err
		}
		if err = json.Unmarshal(raw, &student); err != nil {
			return out, err
		}
		out.Items = append(out.Items, student)
	}
	return out, rows.Err()
}
func (r Repository) Catalog(ctx context.Context, a string, plans bool) ([]Catalog, error) {
	query := "SELECT id,name,active,amount_cents,belt_options FROM modalities WHERE academy_id=$1 ORDER BY name"
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
			var raw []byte
			e = rows.Scan(&v.ID, &v.Name, &v.Active, &v.AmountCents, &raw)
			if e == nil {
				e = json.Unmarshal(raw, &v.BeltOptions)
			}
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
	if plans {
		for _, mid := range in.Modalities {
			var active, existing bool
			err := tx.QueryRow(ctx, `SELECT active,EXISTS(SELECT 1 FROM plan_modalities WHERE academy_id=$1 AND plan_id=NULLIF($3,'')::uuid AND modality_id=$2) FROM modalities WHERE academy_id=$1 AND id=$2`, a, mid, id).Scan(&active, &existing)
			if errors.Is(err, pgx.ErrNoRows) || err == nil && !active && !existing {
				return in, core.E(422, "invalid_modality", "Selecione modalidades ativas desta academia.")
			}
			if err != nil {
				return in, err
			}
		}
	}
	var raw any
	if in.BeltOptions != nil {
		v, err := json.Marshal(in.BeltOptions)
		if err != nil {
			return in, err
		}
		raw = string(v)
	}
	if id == "" {
		id = core.ID()
		if plans {
			_, e = tx.Exec(ctx, "INSERT INTO plans(id,academy_id,name,active,amount_cents) VALUES($1,$2,$3,$4,$5)", id, a, in.Name, in.Active, in.AmountCents)
		} else {
			var saved []byte
			e = tx.QueryRow(ctx, "INSERT INTO modalities(id,academy_id,name,active,amount_cents,belt_options) VALUES($1,$2,$3,$4,$5,COALESCE($6::jsonb,default_belt_options($3))) RETURNING belt_options", id, a, in.Name, in.Active, in.AmountCents, raw).Scan(&saved)
			if e == nil {
				e = json.Unmarshal(saved, &in.BeltOptions)
			}
		}
	} else if plans {
		result, err := tx.Exec(ctx, "UPDATE plans SET name=$3,active=$4,amount_cents=$5 WHERE academy_id=$1 AND id=$2", a, id, in.Name, in.Active, in.AmountCents)
		e = err
		if e == nil && result.RowsAffected() == 0 {
			e = core.E(404, "not_found", "Plano não encontrado.")
		}
	} else {
		var saved []byte
		e = tx.QueryRow(ctx, "UPDATE modalities SET name=$3,active=$4,amount_cents=$5,belt_options=COALESCE($6::jsonb,belt_options) WHERE academy_id=$1 AND id=$2 RETURNING belt_options", a, id, in.Name, in.Active, in.AmountCents, raw).Scan(&saved)
		if errors.Is(e, pgx.ErrNoRows) {
			e = core.E(404, "not_found", "Modalidade não encontrada.")
		}
		if e == nil {
			e = json.Unmarshal(saved, &in.BeltOptions)
		}
	}
	if e != nil {
		return in, e
	}
	if plans {
		if _, e = tx.Exec(ctx, "DELETE FROM plan_modalities WHERE academy_id=$1 AND plan_id=$2", a, id); e != nil {
			return in, e
		}
		for _, mid := range in.Modalities {
			if _, e = tx.Exec(ctx, "INSERT INTO plan_modalities(academy_id,plan_id,modality_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", a, id, mid); e != nil {
				return in, e
			}
		}
	}
	in.ID = id
	return in, tx.Commit(ctx)
}
