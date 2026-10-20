package students

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"net/http"
	"strings"
	"tatame/backend/internal/core"
	"time"
)

type GraduationInput struct {
	Belt    string `json:"belt"`
	Degrees int    `json:"degrees"`
}

// A rank edit does not rewrite the student's contract or generate invoices.
func (r Repository) UpdateGraduation(ctx context.Context, a, id, modality string, in GraduationInput) (Student, error) {
	tx, err := r.DB.Begin(ctx)
	if err != nil {
		return Student{}, err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, "SELECT set_config('tatame.actor_user_id',$1,true)", core.P(ctx).UserID); err != nil {
		return Student{}, err
	}
	var archived *time.Time
	if err = tx.QueryRow(ctx, "SELECT archived_at FROM students WHERE academy_id=$1 AND id=$2 FOR UPDATE", a, id).Scan(&archived); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Student{}, core.E(404, "not_found", "Aluno não encontrado.")
		}
		return Student{}, err
	}
	if archived != nil {
		return Student{}, core.E(409, "student_archived", "Restaure o aluno antes de alterar a graduação.")
	}
	var old string
	var raw []byte
	err = tx.QueryRow(ctx, `SELECT sm.belt,m.belt_options FROM student_modalities sm JOIN modalities m ON m.academy_id=sm.academy_id AND m.id=sm.modality_id WHERE sm.academy_id=$1 AND sm.student_id=$2 AND sm.modality_id=$3 FOR UPDATE OF sm`, a, id, modality).Scan(&old, &raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return Student{}, core.E(404, "not_found", "O aluno não está nesta modalidade.")
	}
	if err != nil {
		return Student{}, err
	}
	var options []BeltOption
	if err = json.Unmarshal(raw, &options); err != nil {
		return Student{}, err
	}
	valid := in.Belt == old || len(options) == 0 && in.Belt == ""
	for _, option := range options {
		if option.Label == in.Belt {
			valid = true
		}
	}
	if !valid {
		return Student{}, core.E(422, "invalid_belt", "Selecione uma faixa válida desta modalidade.")
	}
	if in.Belt == "" && in.Degrees != 0 {
		return Student{}, core.E(422, "invalid_degrees", "Esta modalidade não utiliza graus sem faixa.")
	}
	if _, err = tx.Exec(ctx, "UPDATE student_modalities SET belt=$4,degrees=$5 WHERE academy_id=$1 AND student_id=$2 AND modality_id=$3", a, id, modality, in.Belt, in.Degrees); err != nil {
		return Student{}, err
	}
	// Keep the legacy fallback in the same stable order as the enrollment response.
	if _, err = tx.Exec(ctx, "UPDATE students SET belt=COALESCE((SELECT belt FROM student_modalities WHERE academy_id=$1 AND student_id=$2 AND belt<>'' ORDER BY modality_id LIMIT 1),'Sem graduação') WHERE academy_id=$1 AND id=$2", a, id); err != nil {
		return Student{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return Student{}, err
	}
	return r.Get(ctx, a, id)
}
func (h Handler) Graduation(w http.ResponseWriter, r *http.Request) {
	a, id, modality := r.PathValue("academy"), r.PathValue("student"), r.PathValue("modality")
	if _, err := h.Service.Access.Require(r.Context(), a, "admin"); err != nil {
		core.Fail(w, err)
		return
	}
	if !core.ValidID(id) || !core.ValidID(modality) {
		core.Fail(w, core.E(404, "not_found", "Aluno ou modalidade não encontrado."))
		return
	}
	var in GraduationInput
	if err := core.Decode(w, r, &in); err != nil {
		core.Fail(w, err)
		return
	}
	in.Belt = strings.TrimSpace(in.Belt)
	if len(in.Belt) > 50 || in.Degrees < 0 || in.Degrees > 4 {
		core.Fail(w, core.E(422, "invalid_graduation", "Selecione uma faixa e de zero a quatro graus."))
		return
	}
	result, err := h.Service.Repo.UpdateGraduation(r.Context(), a, id, modality, in)
	if err != nil {
		core.Fail(w, err)
		return
	}
	core.Write(w, 200, result)
}
