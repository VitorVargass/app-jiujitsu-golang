package students

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"tatame/backend/internal/core"
)

func identityError(err error) error {
	var pe *pgconn.PgError
	if errors.As(err, &pe) && pe.Code == "23505" {
		switch pe.ConstraintName {
		case "people_email_key":
			return core.E(409, "identity_exists", "Este e-mail já está cadastrado no sistema. Use a conta atual ou peça ao gestor para corrigir os dados.")
		case "participants_global_cpf_identity", "participants_academy_cpf_unique":
			return core.E(409, "cpf_already_registered", "Este CPF já está cadastrado no sistema. Use o cadastro atual ou peça ao gestor para corrigir os dados.")
		case "students_academy_id_participant_id_key":
			return core.E(409, "already_enrolled", "Esta pessoa já possui matrícula nesta academia. Abra ou restaure o cadastro existente.")
		}
	}
	return err
}

// Email is an identity reference, never an authorization grant.
func resolvePerson(ctx context.Context, tx pgx.Tx, a, id, person string, in Input) (string, string, error) {
	actor := core.P(ctx).UserID
	if id != "" {
		var previous string
		if err := tx.QueryRow(ctx, "SELECT COALESCE(email,'') FROM people WHERE id=$1 FOR UPDATE", person).Scan(&previous); err != nil {
			return "", "", err
		}
		if previous != in.Email {
			var locked bool
			if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE person_id=$1) OR (SELECT count(*) FROM academy_participants WHERE person_id=$1)>1`, person).Scan(&locked); err != nil {
				return "", "", err
			}
			if locked {
				return "", "", core.E(422, "email_managed_by_account", "O e-mail desta identidade não pode ser alterado pelo cadastro do aluno.")
			}
			if _, err := tx.Exec(ctx, "UPDATE people SET email=NULLIF($2,'') WHERE id=$1", person, in.Email); err != nil {
				return "", "", identityError(err)
			}
		}
		return person, "", nil
	}
	var selfPerson, selfEmail string
	if in.UseMyAccount {
		if err := tx.QueryRow(ctx, "SELECT u.person_id,p.email FROM users u JOIN people p ON p.id=u.person_id WHERE u.id=$1", actor).Scan(&selfPerson, &selfEmail); err != nil {
			return "", "", err
		}
		if in.Email != selfEmail {
			return "", "", core.E(422, "identity_mismatch", "Use o e-mail da sua conta para vincular sua própria matrícula.")
		}
	}
	if in.Email != "" {
		err := tx.QueryRow(ctx, "SELECT id FROM people WHERE email=$1 FOR UPDATE", in.Email).Scan(&person)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return "", "", err
		}
		if errors.Is(err, pgx.ErrNoRows) {
			person = ""
		}
	}
	if person != "" && (in.RejectExistingIdentity || (!in.ReuseIdentity && !in.UseMyAccount)) {
		return "", "", core.E(409, "identity_exists", "Este e-mail já está cadastrado no sistema. Use a conta atual ou peça ao gestor para corrigir os dados.")
	}
	if person == "" {
		person = core.ID()
		if _, err := tx.Exec(ctx, "INSERT INTO people(id,email) VALUES($1,NULLIF($2,''))", person, in.Email); err != nil {
			return "", "", identityError(err)
		}
	}
	if in.UseMyAccount && person != selfPerson {
		return "", "", core.E(409, "identity_mismatch", "A identidade selecionada não pertence à sua conta.")
	}
	link := ""
	if in.UseMyAccount {
		link = actor
	}
	return person, link, nil
}
