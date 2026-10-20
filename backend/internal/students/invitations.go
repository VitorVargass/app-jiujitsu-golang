package students

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"tatame/backend/internal/core"
)

func (r Repository) Invite(ctx context.Context, a, id string) (string, error) {
	tx, err := r.DB.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)
	var linked, archived bool
	var email string
	err = tx.QueryRow(ctx, `SELECT s.user_id IS NOT NULL,s.archived_at IS NOT NULL,COALESCE(p.email,'') FROM students s JOIN people p ON p.id=s.person_id WHERE s.academy_id=$1 AND s.id=$2 FOR UPDATE OF s`, a, id).Scan(&linked, &archived, &email)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", core.E(404, "not_found", "Aluno não encontrado.")
	}
	if err != nil {
		return "", err
	}
	if archived {
		return "", core.E(409, "student_archived", "Restaure o cadastro antes de gerar um novo convite.")
	}
	if linked {
		return "", core.E(409, "already_linked", "Este aluno já possui uma conta vinculada.")
	}
	if email == "" {
		return "", core.E(422, "email_required", "Informe o e-mail próprio do aluno antes de gerar o convite.")
	}
	if _, err = tx.Exec(ctx, "UPDATE student_invitations SET revoked_at=now() WHERE academy_id=$1 AND student_id=$2 AND accepted_at IS NULL AND revoked_at IS NULL", a, id); err != nil {
		return "", err
	}
	token := core.Token()
	if _, err = tx.Exec(ctx, "INSERT INTO student_invitations(token_hash,academy_id,student_id,expires_at) VALUES($1,$2,$3,now()+interval '7 days')", core.Hash(token), a, id); err != nil {
		return "", err
	}
	return token, tx.Commit(ctx)
}
func (r Repository) Revoke(ctx context.Context, a, id string) error {
	_, err := r.DB.Exec(ctx, "UPDATE student_invitations SET revoked_at=now() WHERE academy_id=$1 AND student_id=$2 AND accepted_at IS NULL", a, id)
	return err
}
func (r Repository) Accept(ctx context.Context, token, u string, in AcceptInvitationInput) (Student, error) {
	var suppliedCPF string
	if in.CPF != nil {
		var valid bool
		suppliedCPF, valid = core.NormalizeCPF(*in.CPF)
		if !valid || suppliedCPF == "" {
			return Student{}, core.E(422, "invalid_cpf", "Informe um CPF válido do próprio aluno.")
		}
	}
	tx, err := r.DB.Begin(ctx)
	if err != nil {
		return Student{}, err
	}
	defer tx.Rollback(ctx)
	var a, id, person, actorPerson, linked, participant, previousCPF string
	var archived bool
	err = tx.QueryRow(ctx, "SELECT academy_id,student_id FROM student_invitations WHERE token_hash=$1 AND expires_at>clock_timestamp() AND revoked_at IS NULL AND accepted_at IS NULL", core.Hash(token)).Scan(&a, &id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Student{}, core.E(410, "invalid_invitation", "Convite inválido, expirado ou já utilizado.")
	}
	if err != nil {
		return Student{}, err
	}
	// Match creation, editing and invitation issuance: student/participant before invitation.
	err = tx.QueryRow(ctx, `SELECT s.person_id,COALESCE(s.user_id::text,''),s.archived_at IS NOT NULL,p.id,p.cpf
 FROM students s JOIN academy_participants p ON p.academy_id=s.academy_id AND p.id=s.participant_id
 WHERE s.academy_id=$1 AND s.id=$2 FOR UPDATE OF s,p`, a, id).Scan(&person, &linked, &archived, &participant, &previousCPF)
	if err != nil {
		return Student{}, err
	}
	// Revalidate after the student lock, including simultaneous acceptance or a replacement link.
	var valid bool
	err = tx.QueryRow(ctx, "SELECT expires_at>clock_timestamp() AND revoked_at IS NULL AND accepted_at IS NULL FROM student_invitations WHERE token_hash=$1 AND academy_id=$2 AND student_id=$3 FOR UPDATE", core.Hash(token), a, id).Scan(&valid)
	if err != nil {
		return Student{}, err
	}
	if !valid {
		return Student{}, core.E(410, "invalid_invitation", "Convite inválido, expirado ou já utilizado.")
	}
	if archived {
		return Student{}, core.E(410, "student_archived", "Este cadastro está arquivado. Peça ao gestor para restaurá-lo.")
	}
	if linked != "" {
		return Student{}, core.E(409, "already_linked", "Este aluno já possui uma conta.")
	}
	if err = tx.QueryRow(ctx, "SELECT person_id FROM users WHERE id=$1", u).Scan(&actorPerson); err != nil {
		return Student{}, err
	}
	if person != actorPerson {
		return Student{}, core.E(403, "invitation_identity_mismatch", "Entre com a conta do e-mail indicado neste convite.")
	}
	if in.CPF != nil && previousCPF != "" && previousCPF != suppliedCPF {
		return Student{}, core.E(409, "cpf_already_set", "O CPF já foi informado pela academia. Peça ao gestor para corrigir o cadastro.")
	}
	if in.CPF != nil && previousCPF == "" {
		if _, err = tx.Exec(ctx, "UPDATE academy_participants SET cpf=$3 WHERE academy_id=$1 AND id=$2", a, participant, suppliedCPF); err != nil {
			return Student{}, identityError(err)
		}
	}
	if _, err = tx.Exec(ctx, "UPDATE students SET user_id=$1 WHERE academy_id=$2 AND id=$3", u, a, id); err != nil {
		return Student{}, identityError(err)
	}
	var mid string
	err = tx.QueryRow(ctx, `INSERT INTO memberships(id,academy_id,user_id,status,student_code,qr_token) VALUES($1,$2,$3,'active',$4,$5)
 ON CONFLICT(academy_id,user_id) DO UPDATE SET status=memberships.status RETURNING id`, core.ID(), a, u, core.Digits(), core.Token()).Scan(&mid)
	if err != nil {
		return Student{}, err
	}
	if _, err = tx.Exec(ctx, "INSERT INTO membership_roles(membership_id,role) VALUES($1,'student') ON CONFLICT DO NOTHING", mid); err != nil {
		return Student{}, err
	}
	result, err := tx.Exec(ctx, "UPDATE student_invitations SET accepted_at=clock_timestamp(),accepted_by=$1 WHERE token_hash=$2 AND expires_at>clock_timestamp() AND revoked_at IS NULL AND accepted_at IS NULL", u, core.Hash(token))
	if err != nil {
		return Student{}, err
	}
	if result.RowsAffected() != 1 {
		return Student{}, core.E(410, "invalid_invitation", "Convite inválido, expirado ou já utilizado.")
	}
	if err = tx.Commit(ctx); err != nil {
		return Student{}, err
	}
	return r.Get(ctx, a, id)
}
