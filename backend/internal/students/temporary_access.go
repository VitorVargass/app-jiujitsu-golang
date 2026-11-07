package students

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
	"net/http"
	"net/mail"
	"tatame/backend/internal/core"
	"time"
)

type TemporaryAccess struct {
	Email     string    `json:"email"`
	Password  string    `json:"temporary_password"`
	ExpiresAt time.Time `json:"expires_at"`
}

func (h Handler) TemporaryAccess(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	a, id := r.PathValue("academy"), r.PathValue("student")
	if _, err := h.Service.Access.Require(r.Context(), a, "admin"); err != nil {
		core.Fail(w, err)
		return
	}
	if !core.ValidID(id) {
		core.Fail(w, core.E(404, "not_found", "Aluno não encontrado."))
		return
	}
	value, err := h.Service.Repo.CreateTemporaryAccess(r.Context(), a, id)
	if err != nil {
		core.Fail(w, err)
		return
	}
	core.Write(w, http.StatusCreated, value)
}

func (r Repository) CreateTemporaryAccess(ctx context.Context, academyID, studentID string) (TemporaryAccess, error) {
	out := TemporaryAccess{Password: core.Token()[:16]}
	hash, err := bcrypt.GenerateFromPassword([]byte(out.Password), 12)
	if err != nil {
		return TemporaryAccess{}, err
	}
	tx, err := r.DB.Begin(ctx)
	if err != nil {
		return TemporaryAccess{}, err
	}
	defer tx.Rollback(ctx)
	var personID, name, linked, status, birth, zone string
	var archived bool
	err = tx.QueryRow(ctx, `SELECT s.person_id,s.name,COALESCE(s.user_id::text,''),s.status,
 s.archived_at IS NOT NULL,COALESCE(s.birth_date::text,''),a.timezone
 FROM students s JOIN academies a ON a.id=s.academy_id
 JOIN academy_participants ap ON ap.id=s.participant_id AND ap.academy_id=s.academy_id
 WHERE s.academy_id=$1 AND s.id=$2 FOR UPDATE OF s,ap`, academyID, studentID).
		Scan(&personID, &name, &linked, &status, &archived, &birth, &zone)
	if errors.Is(err, pgx.ErrNoRows) {
		return TemporaryAccess{}, core.E(404, "not_found", "Aluno não encontrado.")
	}
	if err != nil {
		return TemporaryAccess{}, err
	}
	if archived || status != "active" {
		return TemporaryAccess{}, core.E(409, "student_inactive", "Ative o aluno antes de criar o acesso.")
	}
	if linked != "" {
		return TemporaryAccess{}, core.E(409, "already_linked", "Este aluno já possui uma conta vinculada.")
	}
	date, err := time.Parse("2006-01-02", birth)
	if err != nil {
		return TemporaryAccess{}, core.E(422, "birth_date_required", "Complete a data de nascimento do aluno.")
	}
	location, err := time.LoadLocation(zone)
	if err != nil {
		return TemporaryAccess{}, err
	}
	if core.AgeOn(date, time.Now().In(location)) < 18 {
		return TemporaryAccess{}, core.E(422, "guardian_access_required", "Para menores, use a conta do responsável pela matrícula pelo link.")
	}
	err = tx.QueryRow(ctx, "SELECT COALESCE(email,'') FROM people WHERE id=$1 FOR UPDATE", personID).Scan(&out.Email)
	if err != nil {
		return TemporaryAccess{}, err
	}
	address, err := mail.ParseAddress(out.Email)
	if err != nil || address.Address != out.Email {
		return TemporaryAccess{}, core.E(422, "email_required", "Informe o e-mail próprio do aluno para criar o acesso.")
	}
	var exists bool
	err = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM users WHERE person_id=$1)", personID).Scan(&exists)
	if err != nil {
		return TemporaryAccess{}, err
	}
	if exists {
		return TemporaryAccess{}, core.E(409, "account_exists", "Este e-mail já possui uma conta. Envie o convite para o aluno vincular o cadastro usando sua senha atual.")
	}
	userID := core.ID()
	out.ExpiresAt = time.Now().Add(7 * 24 * time.Hour)
	result, err := tx.Exec(ctx, `INSERT INTO users(id,person_id,name,password_hash,password_change_required,temporary_password_expires_at)
 VALUES($1,$2,$3,$4,true,$5) ON CONFLICT(person_id) DO NOTHING`, userID, personID, name, string(hash), out.ExpiresAt)
	if err != nil {
		return TemporaryAccess{}, err
	}
	if result.RowsAffected() != 1 {
		return TemporaryAccess{}, core.E(409, "account_exists", "Este e-mail já possui uma conta. Envie o convite para vincular o cadastro.")
	}
	if _, err = tx.Exec(ctx, "UPDATE students SET user_id=$1 WHERE academy_id=$2 AND id=$3", userID, academyID, studentID); err != nil {
		return TemporaryAccess{}, err
	}
	membershipID := core.ID()
	if _, err = tx.Exec(ctx, `INSERT INTO memberships(id,academy_id,user_id,status,student_code,qr_token) VALUES($1,$2,$3,'active',$4,$5)`, membershipID, academyID, userID, core.Digits(), core.Token()); err != nil {
		return TemporaryAccess{}, err
	}
	if _, err = tx.Exec(ctx, "INSERT INTO membership_roles(membership_id,role) VALUES($1,'student')", membershipID); err != nil {
		return TemporaryAccess{}, err
	}
	if _, err = tx.Exec(ctx, "UPDATE student_invitations SET revoked_at=now() WHERE academy_id=$1 AND student_id=$2 AND accepted_at IS NULL AND revoked_at IS NULL", academyID, studentID); err != nil {
		return TemporaryAccess{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return TemporaryAccess{}, err
	}
	return out, nil
}
