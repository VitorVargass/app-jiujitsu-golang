package students

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"tatame/backend/internal/billing"
	"tatame/backend/internal/core"
	"time"
)

func (r Repository) Save(ctx context.Context, a, id string, in Input) (Student, error) {
	tx, err := r.DB.Begin(ctx)
	if err != nil {
		return Student{}, err
	}
	defer tx.Rollback(ctx)
	id, err = r.saveStudentTx(ctx, tx, a, id, in)
	if err != nil {
		return Student{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return Student{}, identityError(err)
	}
	return r.Get(ctx, a, id)
}

// Shared by administrative edits and public enrollment, within one transaction.
func (r Repository) saveStudentTx(ctx context.Context, tx pgx.Tx, a, id string, in Input) (string, error) {
	var err error
	if _, err = tx.Exec(ctx, "SELECT set_config('tatame.actor_user_id',$1,true)", core.P(ctx).UserID); err != nil {
		return "", err
	}
	wasEnabled := false
	oldBirth, person, part, oldCPF, oldStarted := "", "", "", "", ""
	if id != "" {
		var archived *time.Time
		err = tx.QueryRow(ctx, `SELECT s.person_id,s.participant_id,p.cpf,s.archived_at,COALESCE(to_char(s.birth_date,'YYYY-MM-DD'),''),s.started_on::text
  FROM students s JOIN academy_participants p ON p.academy_id=s.academy_id AND p.id=s.participant_id
  WHERE s.academy_id=$1 AND s.id=$2 FOR UPDATE OF s,p`, a, id).Scan(&person, &part, &oldCPF, &archived, &oldBirth, &oldStarted)
		if errors.Is(err, pgx.ErrNoRows) {
			return "", core.E(404, "not_found", "Aluno não encontrado.")
		}
		if err != nil {
			return "", err
		}
		if archived != nil {
			return "", core.E(409, "student_archived", "Restaure o cadastro antes de editá-lo.")
		}
		if in.CPF == nil {
			in.CPF = &oldCPF
		} else if oldCPF != "" && *in.CPF == "" {
			return "", core.E(422, "invalid_cpf", "O CPF cadastrado não pode ficar vazio.")
		}
	}
	if id != "" {
		if err = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM student_billing WHERE academy_id=$1 AND student_id=$2 AND enabled)", a, id).Scan(&wasEnabled); err != nil {
			return "", err
		}
	}
	adult, err := resolveIdentity(ctx, tx, a, id, &in, oldBirth)
	if err != nil {
		return "", err
	}
	if id != "" && in.StartedOn != nil && in.ExpectedStartedOn != nil && *in.ExpectedStartedOn != oldStarted && *in.StartedOn != oldStarted {
		return "", core.E(409, "start_date_changed", "A data de início foi atualizada. Reabra o cadastro para editar os dados atuais.")
	}
	started, err := resolveStartDate(ctx, tx, a, in.StartedOn, oldStarted, *in.BirthDate)
	if err != nil {
		return "", err
	}
	if err = resolveEnrollments(ctx, tx, a, id, &in); err != nil {
		return "", err
	}
	person, link, err := resolvePerson(ctx, tx, a, id, person, in)
	if err != nil {
		return "", err
	}
	if id == "" {
		var exists bool
		if err = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM students WHERE academy_id=$1 AND person_id=$2)", a, person).Scan(&exists); err != nil {
			return "", err
		}
		if exists {
			return "", core.E(409, "already_enrolled", "Esta pessoa já tem matrícula nesta academia. Abra ou restaure o cadastro existente.")
		}
		err = tx.QueryRow(ctx, "SELECT id,cpf FROM academy_participants WHERE academy_id=$1 AND person_id=$2 FOR UPDATE", a, person).Scan(&part, &oldCPF)
		if errors.Is(err, pgx.ErrNoRows) {
			part = core.ID()
			_, err = tx.Exec(ctx, "INSERT INTO academy_participants(id,academy_id,person_id,cpf,student_code,qr_token) VALUES($1,$2,$3,$4,$5,$6)", part, a, person, *in.CPF, core.Digits(), core.Token())
		} else if err == nil && oldCPF != "" && oldCPF != *in.CPF {
			return "", core.E(409, "identity_cpf_conflict", "A identidade já possui outro CPF nesta academia. Confira os dados antes de vincular.")
		}
		if err != nil {
			return "", identityError(err)
		}
		if _, err = tx.Exec(ctx, "UPDATE academy_participants SET cpf=$3 WHERE academy_id=$1 AND id=$2", a, part, *in.CPF); err != nil {
			return "", identityError(err)
		}
		id = core.ID()
		_, err = tx.Exec(ctx, `INSERT INTO students(id,academy_id,user_id,person_id,participant_id,name,phone,status,belt,plan_id,alternate_phone,charge_mode,birth_date,started_on)
  VALUES($1,$2,NULLIF($3,'')::uuid,$4,$5,$6,$7,$8,$9,NULLIF($10,'')::uuid,$11,$12,NULLIF($13,'')::date,$14::date)`,
			id, a, link, person, part, in.Name, in.Phone, in.Status, in.Belt, in.PlanID, in.AlternatePhone, in.ChargeMode, *in.BirthDate, started)
		if err != nil {
			return "", identityError(err)
		}
		if link != "" {
			var mid string
			err = tx.QueryRow(ctx, `INSERT INTO memberships(id,academy_id,user_id,status,student_code,qr_token) VALUES($1,$2,$3,'active',$4,$5)
   ON CONFLICT(academy_id,user_id) DO UPDATE SET status=memberships.status RETURNING id`, core.ID(), a, link, core.Digits(), core.Token()).Scan(&mid)
			if err != nil {
				return "", err
			}
			if _, err = tx.Exec(ctx, "INSERT INTO membership_roles(membership_id,role) VALUES($1,'student') ON CONFLICT DO NOTHING", mid); err != nil {
				return "", err
			}
		}
	} else {
		if err = billing.GenerateTx(ctx, tx, a, id, time.Now()); err != nil {
			return "", err
		}
		if _, err = tx.Exec(ctx, `UPDATE students SET name=$3,phone=$4,status=$5,belt=$6,plan_id=NULLIF($7,'')::uuid,alternate_phone=$8,charge_mode=$9,birth_date=NULLIF($10,'')::date,started_on=$11::date WHERE academy_id=$1 AND id=$2`,
			a, id, in.Name, in.Phone, in.Status, in.Belt, in.PlanID, in.AlternatePhone, in.ChargeMode, *in.BirthDate, started); err != nil {
			return "", err
		}
		if _, err = tx.Exec(ctx, "UPDATE academy_participants SET cpf=$3 WHERE academy_id=$1 AND id=$2", a, part, *in.CPF); err != nil {
			return "", identityError(err)
		}
	}
	for _, d := range in.ModalityDetails {
		if _, err = tx.Exec(ctx, "INSERT INTO student_modalities(academy_id,student_id,modality_id,belt,amount_cents,degrees) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(academy_id,student_id,modality_id) DO UPDATE SET belt=EXCLUDED.belt,amount_cents=EXCLUDED.amount_cents,degrees=EXCLUDED.degrees", a, id, d.ModalityID, d.Belt, d.AmountCents, *d.Degrees); err != nil {
			return "", err
		}
	}
	if _, err = tx.Exec(ctx, "DELETE FROM student_modalities WHERE academy_id=$1 AND student_id=$2 AND NOT(modality_id=ANY($3::uuid[]))", a, id, in.Modalities); err != nil {
		return "", err
	}
	if b := in.Billing; b != nil {
		_, err = tx.Exec(ctx, `INSERT INTO student_billing(academy_id,student_id,enabled,amount_cents,due_day,next_month,payer_name,payer_document)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(academy_id,student_id) DO UPDATE SET enabled=EXCLUDED.enabled,
   amount_cents=EXCLUDED.amount_cents,due_day=EXCLUDED.due_day,
   next_month=CASE WHEN NOT student_billing.enabled AND EXCLUDED.enabled THEN EXCLUDED.next_month ELSE student_billing.next_month END,
   payer_name=EXCLUDED.payer_name,payer_document=EXCLUDED.payer_document`,
			a, id, b.Enabled && in.Status == "active", b.AmountCents, b.DueDay, b.FirstMonth+"-01", b.PayerName, b.PayerDocument)
		if err != nil {
			return "", err
		}
	}
	if adult {
		if _, err = tx.Exec(ctx, "UPDATE student_billing SET payer_name=$3,payer_document=$4 WHERE academy_id=$1 AND student_id=$2", a, id, in.Name, *in.CPF); err != nil {
			return "", err
		}
	}
	if in.Status == "inactive" {
		if _, err = tx.Exec(ctx, "UPDATE student_billing SET enabled=false WHERE academy_id=$1 AND student_id=$2", a, id); err != nil {
			return "", err
		}
	}
	generate := billing.GenerateTx
	if in.Billing != nil && in.Billing.Enabled && !wasEnabled {
		generate = billing.GenerateFirstTx
	}
	if err = generate(ctx, tx, a, id, time.Now()); err != nil {
		return "", err
	}
	return id, nil
}
