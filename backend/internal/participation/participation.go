package participation

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"net/http"
	"tatame/backend/internal/core"
)

type Profile struct {
	ID                     string `json:"participant_id"`
	PersonID               string `json:"person_id"`
	AcademyID              string `json:"academy_id"`
	StudentID              string `json:"student_id,omitempty"`
	Name                   string `json:"name"`
	Email                  string `json:"email"`
	CPF                    string `json:"cpf"`
	StudentCode            string `json:"student_code"`
	QRToken                string `json:"qr_token"`
	CanCheckIn             bool   `json:"can_check_in"`
	HasStudentRegistration bool   `json:"has_student_registration"`
}

// p is the common participation row; s is its optional financial enrollment.
const EligibleSQL = `((s.id IS NOT NULL AND s.status='active' AND s.archived_at IS NULL)
 OR EXISTS(SELECT 1 FROM memberships em JOIN users eu ON eu.id=em.user_id JOIN membership_roles er ON er.membership_id=em.id
 WHERE em.academy_id=p.academy_id AND eu.person_id=p.person_id AND em.status='active' AND er.role IN('admin','teacher')))`

type Repository struct{ DB *pgxpool.Pool }

func (r Repository) Own(ctx context.Context, a, u string) (Profile, error) {
	var v Profile
	if !core.ValidID(a) || !core.ValidID(u) {
		return v, core.E(403, "forbidden", "Entre em uma academia para continuar.")
	}
	err := r.DB.QueryRow(ctx, `SELECT p.id,p.person_id,p.academy_id,COALESCE(s.id::text,''),COALESCE(s.name,u.name),i.email,p.cpf,p.student_code,'tatame:'||p.qr_token,`+EligibleSQL+`,s.id IS NOT NULL
 FROM academy_participants p JOIN users u ON u.person_id=p.person_id JOIN people i ON i.id=p.person_id
 LEFT JOIN students s ON s.academy_id=p.academy_id AND s.participant_id=p.id
 WHERE p.academy_id=$1 AND u.id=$2 AND EXISTS(SELECT 1 FROM memberships m WHERE m.academy_id=p.academy_id AND m.user_id=u.id)`,
		a, u).Scan(&v.ID, &v.PersonID, &v.AcademyID, &v.StudentID, &v.Name, &v.Email, &v.CPF, &v.StudentCode, &v.QRToken, &v.CanCheckIn, &v.HasStudentRegistration)
	if errors.Is(err, pgx.ErrNoRows) {
		return v, core.E(403, "forbidden", "Você não tem participação vinculada a esta academia.")
	}
	return v, err
}

type Handler struct{ Repo Repository }

func (h Handler) Own(w http.ResponseWriter, r *http.Request) {
	a, u := r.PathValue("academy"), core.P(r.Context()).UserID
	if u == "" {
		core.Fail(w, core.E(403, "forbidden", "Conta pessoal necessária."))
		return
	}
	v, err := h.Repo.Own(r.Context(), a, u)
	if err != nil {
		core.Fail(w, err)
		return
	}
	if r.Method == "PATCH" {
		var in struct {
			CPF string `json:"cpf"`
		}
		if err = core.Decode(w, r, &in); err != nil {
			core.Fail(w, err)
			return
		}
		cpf, valid := core.NormalizeCPF(in.CPF)
		if !valid || cpf == "" {
			core.Fail(w, core.E(422, "invalid_cpf", "Informe o CPF da própria pessoa."))
			return
		}
		_, err = h.Repo.DB.Exec(r.Context(), "UPDATE academy_participants SET cpf=$3 WHERE academy_id=$1 AND id=$2", a, v.ID, cpf)
		var pe *pgconn.PgError
		if errors.As(err, &pe) && pe.Code == "23505" {
			err = core.E(409, "cpf_already_registered", "Este CPF já pertence a outra participação nesta academia.")
		}
		if err != nil {
			core.Fail(w, err)
			return
		}
		v, err = h.Repo.Own(r.Context(), a, u)
		if err != nil {
			core.Fail(w, err)
			return
		}
	}
	core.Write(w, 200, v)
}
