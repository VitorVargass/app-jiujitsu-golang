package devices

import (
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"tatame/backend/internal/core"
)

type Repository struct{ DB *pgxpool.Pool }

func (r Repository) Create(ctx context.Context, a, name, userToken string) (Credential, error) {
	v := Credential{core.ID(), core.Token(), a, name}
	tx, e := r.DB.Begin(ctx)
	if e != nil {
		return v, e
	}
	defer tx.Rollback(ctx)
	if _, e = tx.Exec(ctx, "INSERT INTO devices(id,academy_id,name,token_hash) VALUES($1,$2,$3,$4)", v.ID, a, name, core.Hash(v.Token)); e != nil {
		return v, e
	}
	if _, e = tx.Exec(ctx, "DELETE FROM auth_sessions WHERE token_hash=$1", core.Hash(userToken)); e != nil {
		return v, e
	}
	return v, tx.Commit(ctx)
}
func (r Repository) List(ctx context.Context, a string) ([]Device, error) {
	rows, e := r.DB.Query(ctx, "SELECT id,name,active,created_at FROM devices WHERE academy_id=$1 ORDER BY created_at DESC", a)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []Device{}
	for rows.Next() {
		var d Device
		if e = rows.Scan(&d.ID, &d.Name, &d.Active, &d.CreatedAt); e != nil {
			return nil, e
		}
		out = append(out, d)
	}
	return out, rows.Err()
}
func (r Repository) Revoke(ctx context.Context, a, id string) error {
	tag, e := r.DB.Exec(ctx, "UPDATE devices SET active=false WHERE academy_id=$1 AND id=$2", a, id)
	if e != nil {
		return e
	}
	if tag.RowsAffected() == 0 {
		return core.E(404, "not_found", "Tablet não encontrado.")
	}
	return nil
}
