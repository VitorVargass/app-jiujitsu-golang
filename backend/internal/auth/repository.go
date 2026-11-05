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
	result, e := r.DB.Exec(ctx, "INSERT INTO auth_sessions(token_hash,user_id,expires_at) SELECT $1,id,$3 FROM users WHERE id=$2 AND deleted_at IS NULL FOR SHARE", core.Hash(token), id, time.Now().Add(30*24*time.Hour))
	if e == nil && result.RowsAffected() != 1 {
		return "", core.E(401, "unauthorized", "Entre novamente para continuar.")
	}
	return token, e
}
func (r Repository) Principal(ctx context.Context, token string) (core.Principal, error) {
	var p core.Principal
	e := r.DB.QueryRow(ctx, "SELECT s.user_id FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.deleted_at IS NULL", core.Hash(token)).Scan(&p.UserID)
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

func (r Repository) CreateUser(ctx context.Context, u *User, hash string, c Credentials) error {
	tx, err := r.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	err = tx.QueryRow(ctx, "INSERT INTO people(id,email) VALUES($1,$2) ON CONFLICT(email) DO UPDATE SET email=EXCLUDED.email RETURNING id", core.ID(), u.Email).Scan(&u.PersonID)
	if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, "INSERT INTO users(id,person_id,name,password_hash) VALUES($1,$2,$3,$4)", u.ID, u.PersonID, u.Name, hash); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, "INSERT INTO account_legal_acceptances(user_id,terms_version,privacy_version) VALUES($1,$2,$3)", u.ID, c.TermsVersion, c.PrivacyVersion); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func (r Repository) UserByEmail(ctx context.Context, email string) (User, string, error) {
	var u User
	var hash string
	err := r.DB.QueryRow(ctx, "SELECT u.id,u.name,p.email,u.password_hash,u.person_id FROM users u JOIN people p ON p.id=u.person_id WHERE p.email=$1 AND u.deleted_at IS NULL", email).Scan(&u.ID, &u.Name, &u.Email, &hash, &u.PersonID)
	return u, hash, err
}
func (r Repository) User(ctx context.Context, id string) (User, error) {
	var u User
	err := r.DB.QueryRow(ctx, "SELECT u.id,u.name,p.email,u.person_id FROM users u JOIN people p ON p.id=u.person_id WHERE u.id=$1", id).Scan(&u.ID, &u.Name, &u.Email, &u.PersonID)
	return u, err
}
func (r Repository) Logout(ctx context.Context, token string) error {
	_, err := r.DB.Exec(ctx, "DELETE FROM auth_sessions WHERE token_hash=$1", core.Hash(token))
	return err
}
