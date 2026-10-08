package auth

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"
	"net/mail"
	"strings"
	"tatame/backend/internal/core"
)

type Service struct{ Repo Repository }

func (s Service) Register(ctx context.Context, c Credentials) (LoginResult, error) {
	c.Name = strings.TrimSpace(c.Name)
	c.Email = strings.ToLower(strings.TrimSpace(c.Email))
	addr, e := mail.ParseAddress(c.Email)
	if e != nil || addr.Address != c.Email || len(c.Email) > 254 || len(c.Name) < 2 || len(c.Name) > 100 || len(c.Password) < 8 || len(c.Password) > 72 {
		return LoginResult{}, core.E(422, "invalid_credentials", "Informe nome, e-mail válido e senha de 8 a 72 bytes.")
	}
	hash, e := bcrypt.GenerateFromPassword([]byte(c.Password), 12)
	if e != nil {
		return LoginResult{}, e
	}
	u := User{core.ID(), c.Name, c.Email}
	e = s.Repo.CreateUser(ctx, u, string(hash))
	if e != nil {
		var pe *pgconn.PgError
		if errors.As(e, &pe) && pe.Code == "23505" {
			return LoginResult{}, core.E(409, "email_in_use", "Este e-mail já está cadastrado.")
		}
		return LoginResult{}, e
	}
	token, e := s.Repo.Session(ctx, u.ID)
	return LoginResult{token, u}, e
}
func (s Service) Login(ctx context.Context, c Credentials) (LoginResult, error) {
	u, hash, e := s.Repo.UserByEmail(ctx, strings.ToLower(strings.TrimSpace(c.Email)))
	if e != nil {
		hash = "$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW"
	}
	compare := bcrypt.CompareHashAndPassword([]byte(hash), []byte(c.Password))
	if e != nil || compare != nil {
		return LoginResult{}, core.E(401, "invalid_credentials", "E-mail ou senha incorretos.")
	}
	token, e := s.Repo.Session(ctx, u.ID)
	return LoginResult{token, u}, e
}

func (s Service) Me(ctx context.Context) (User, error) {
	if core.P(ctx).UserID == "" {
		return User{}, core.E(403, "forbidden", "Acesso pessoal necessário.")
	}
	return s.Repo.User(ctx, core.P(ctx).UserID)
}
func (s Service) Logout(ctx context.Context, token string) error {
	if core.P(ctx).UserID == "" {
		return core.E(403, "forbidden", "Dispositivos não possuem sessão de usuário.")
	}
	return s.Repo.Logout(ctx, token)
}
