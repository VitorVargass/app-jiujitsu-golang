package classes

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"tatame/backend/internal/core"
)

func lockClass(ctx context.Context, tx pgx.Tx, a, id string) (bool, error) {
	var active bool
	var deleted *time.Time
	if err := tx.QueryRow(ctx, "SELECT active,deleted_at FROM classes WHERE academy_id=$1 AND id=$2 FOR UPDATE", a, id).Scan(&active, &deleted); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, core.E(404, "not_found", "Turma não encontrada.")
		}
		return false, err
	}
	if deleted != nil {
		return false, core.E(404, "not_found", "Esta turma foi excluída.")
	}
	return active, nil
}

func (r Repository) Delete(ctx context.Context, a, id string) error {
	tx, err := r.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var deleted *time.Time
	if err = tx.QueryRow(ctx, "SELECT deleted_at FROM classes WHERE academy_id=$1 AND id=$2 FOR UPDATE", a, id).Scan(&deleted); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return core.E(404, "not_found", "Turma não encontrada.")
		}
		return err
	}
	if deleted != nil {
		return tx.Commit(ctx)
	}
	if _, err = tx.Exec(ctx, "UPDATE class_sessions SET status='cancelled' WHERE academy_id=$1 AND class_id=$2 AND status='open'", a, id); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, "UPDATE classes SET deleted_at=now(),active=false WHERE academy_id=$1 AND id=$2", a, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func (h Handler) Delete(w http.ResponseWriter, r *http.Request) {
	a, id := r.PathValue("academy"), r.PathValue("class")
	if _, err := h.Service.Access.Require(r.Context(), a, "admin"); err != nil {
		core.Fail(w, err)
		return
	}
	if !core.ValidID(id) {
		core.Fail(w, core.E(404, "not_found", "Turma não encontrada."))
		return
	}
	if err := h.Service.Repo.Delete(r.Context(), a, id); err != nil {
		core.Fail(w, err)
		return
	}
	core.Write(w, 200, map[string]bool{"ok": true})
}
