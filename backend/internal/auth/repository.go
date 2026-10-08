package auth

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"tatame/backend/internal/core"
	"time"
)

type Repository struct{ DB *pgxpool.Pool }

func (r Repository) Session(ctx context.Context, id string) (string, error) {
	token := core.Token()
	_, e := r.DB.Exec(ctx, "INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)", core.Hash(token), id, time.Now().Add(30*24*time.Hour))
	return token, e
}
func (r Repository) Principal(ctx context.Context, token string) (core.Principal, error) {
	var p core.Principal
	e := r.DB.QueryRow(ctx, "SELECT user_id FROM auth_sessions WHERE token_hash=$1 AND expires_at>now()", core.Hash(token)).Scan(&p.UserID)
	if e == nil {
		return p, nil
	}
	if !errors.Is(e, pgx.ErrNoRows) {
		return p, core.E(503, "database_unavailable", "A academia está temporariamente indisponível.")
	}
	e = r.DB.QueryRow(ctx, "SELECT id,academy_id FROM devices WHERE token_hash=$1 AND active=true", core.Hash(token)).Scan(&p.DeviceID, &p.AcademyID)
	if errors.Is(e, pgx.ErrNoRows) {
		return p, core.E(401, "unauthorized", "Entre novamente para continuar.")
	}
	if e != nil {
		return p, core.E(503, "database_unavailable", "A academia está temporariamente indisponível.")
	}
	return p, nil
}

func (r Repository) CreateUser(ctx context.Context, u User, hash string) error {
	_, err := r.DB.Exec(ctx, "INSERT INTO users(id,name,email,password_hash) VALUES($1,$2,$3,$4)", u.ID, u.Name, u.Email, hash)
	return err
}
func (r Repository) UserByEmail(ctx context.Context, email string) (User, string, error) {
	var u User
	var hash string
	err := r.DB.QueryRow(ctx, "SELECT id,name,email,password_hash FROM users WHERE email=$1", email).Scan(&u.ID, &u.Name, &u.Email, &hash)
	return u, hash, err
}
func (r Repository) User(ctx context.Context, id string) (User, error) {
	var u User
	err := r.DB.QueryRow(ctx, "SELECT id,name,email FROM users WHERE id=$1", id).Scan(&u.ID, &u.Name, &u.Email)
	return u, err
}
func (r Repository) Logout(ctx context.Context, token string) error {
	_, err := r.DB.Exec(ctx, "DELETE FROM auth_sessions WHERE token_hash=$1", core.Hash(token))
	return err
}
