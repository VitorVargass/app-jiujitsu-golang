package students

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"tatame/backend/internal/core"
)

// Archive and restore lock the student before billing, matching the monthly generator.
func (r Repository) SetArchived(ctx context.Context, a, id string, archived bool) (Student, error) {
	tx, err := r.DB.Begin(ctx)
	if err != nil {
		return Student{}, err
	}
	defer tx.Rollback(ctx)
	var previous *time.Time
	if err = tx.QueryRow(ctx, "SELECT archived_at FROM students WHERE academy_id=$1 AND id=$2 FOR UPDATE", a, id).Scan(&previous); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Student{}, core.E(404, "not_found", "Aluno não encontrado.")
		}
		return Student{}, err
	}
	if archived {
		_, err = tx.Exec(ctx, "UPDATE students SET archived_at=COALESCE(archived_at,now()),status='inactive' WHERE academy_id=$1 AND id=$2", a, id)
	} else if previous != nil {
		_, err = tx.Exec(ctx, "UPDATE students SET archived_at=NULL,status='active' WHERE academy_id=$1 AND id=$2", a, id)
	}
	if err != nil {
		return Student{}, err
	}
	if archived || previous != nil {
		if _, err = tx.Exec(ctx, "UPDATE student_billing SET enabled=false WHERE academy_id=$1 AND student_id=$2", a, id); err != nil {
			return Student{}, err
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return Student{}, err
	}
	return r.Get(ctx, a, id)
}

func (h Handler) Archive(w http.ResponseWriter, r *http.Request) { h.setArchived(w, r, true) }
func (h Handler) Restore(w http.ResponseWriter, r *http.Request) { h.setArchived(w, r, false) }
func (h Handler) setArchived(w http.ResponseWriter, r *http.Request, archived bool) {
	a, id := r.PathValue("academy"), r.PathValue("student")
	if _, err := h.Service.Access.Require(r.Context(), a, "admin"); err != nil {
		core.Fail(w, err)
		return
	}
	if !core.ValidID(id) {
		core.Fail(w, core.E(404, "not_found", "Aluno não encontrado."))
		return
	}
	result, err := h.Service.Repo.SetArchived(r.Context(), a, id, archived)
	if err != nil {
		core.Fail(w, err)
		return
	}
	core.Write(w, 200, result)
}
