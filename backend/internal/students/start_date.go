package students

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"tatame/backend/internal/core"
)

// Enrollment dates do not change invoices, attendance or recorded active periods.
func resolveStartDate(ctx context.Context, tx pgx.Tx, academy string, input *string, previous, birth string) (string, error) {
	var zone string
	if err := tx.QueryRow(ctx, "SELECT timezone FROM academies WHERE id=$1", academy).Scan(&zone); err != nil {
		return "", err
	}
	loc, err := time.LoadLocation(zone)
	if err != nil {
		return "", err
	}
	today := time.Now().In(loc).Format("2006-01-02")
	value := previous
	if input != nil {
		value = strings.TrimSpace(*input)
	} else if value == "" {
		value = today
	}
	parsed, err := time.Parse("2006-01-02", value)
	if err != nil || parsed.Year() < 1900 || value > today {
		return "", core.E(422, "invalid_start_date", "Informe uma data de início válida, até hoje.")
	}
	if birth != "" && value < birth {
		return "", core.E(422, "invalid_start_date", "O início na academia deve ser a partir da data de nascimento.")
	}
	return value, nil
}

type StartDateInput struct {
	StartedOn         string `json:"started_on"`
	ExpectedStartedOn string `json:"expected_started_on"`
}

func (r Repository) UpdateStartDate(ctx context.Context, academy, id string, input StartDateInput) (Student, error) {
	tx, err := r.DB.Begin(ctx)
	if err != nil {
		return Student{}, err
	}
	defer tx.Rollback(ctx)
	var previous, birth string
	var archived *time.Time
	err = tx.QueryRow(ctx, "SELECT started_on::text,COALESCE(birth_date::text,''),archived_at FROM students WHERE academy_id=$1 AND id=$2 FOR UPDATE", academy, id).Scan(&previous, &birth, &archived)
	if errors.Is(err, pgx.ErrNoRows) {
		return Student{}, core.E(404, "not_found", "Aluno não encontrado.")
	}
	if err != nil {
		return Student{}, err
	}
	if archived != nil {
		return Student{}, core.E(409, "student_archived", "Restaure o cadastro antes de editá-lo.")
	}
	if previous != input.ExpectedStartedOn && previous != input.StartedOn {
		return Student{}, core.E(409, "start_date_changed", "A data de início foi atualizada. Feche esta janela e tente novamente.")
	}
	value, err := resolveStartDate(ctx, tx, academy, &input.StartedOn, previous, birth)
	if err != nil {
		return Student{}, err
	}
	if _, err = tx.Exec(ctx, "UPDATE students SET started_on=$3::date WHERE academy_id=$1 AND id=$2", academy, id, value); err != nil {
		return Student{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return Student{}, err
	}
	return r.Get(ctx, academy, id)
}
func (h Handler) StartDate(w http.ResponseWriter, r *http.Request) {
	academy, id := r.PathValue("academy"), r.PathValue("student")
	if _, err := h.Service.Access.Require(r.Context(), academy, "admin"); err != nil {
		core.Fail(w, err)
		return
	}
	if !core.ValidID(id) {
		core.Fail(w, core.E(404, "not_found", "Aluno não encontrado."))
		return
	}
	var input StartDateInput
	if err := core.Decode(w, r, &input); err != nil {
		core.Fail(w, err)
		return
	}
	if _, err := time.Parse("2006-01-02", input.ExpectedStartedOn); err != nil {
		core.Fail(w, core.E(422, "invalid_start_date", "Atualize o cadastro antes de editar a data de início."))
		return
	}
	value, err := h.Service.Repo.UpdateStartDate(r.Context(), academy, id, input)
	if err != nil {
		core.Fail(w, err)
		return
	}
	core.Write(w, 200, value)
}
