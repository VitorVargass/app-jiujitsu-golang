package memberships

import (
	"context"
	"golang.org/x/crypto/bcrypt"
	"net/mail"
	"strings"
	"tatame/backend/internal/core"
)

func (s Service) Managers(ctx context.Context, academy string) ([]Manager, error) {
	if _, err := s.Access.Require(ctx, academy, "admin"); err != nil {
		return nil, err
	}
	return s.Repo.Managers(ctx, academy)
}
func (s Service) CreateManager(ctx context.Context, academy string, in CreateManagerInput) (Manager, error) {
	if _, err := s.Access.Require(ctx, academy, "admin"); err != nil {
		return Manager{}, err
	}
	in.Name = strings.TrimSpace(in.Name)
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	addr, err := mail.ParseAddress(in.Email)
	if err != nil || addr.Address != in.Email || len(in.Email) > 254 {
		return Manager{}, core.E(422, "invalid_email", "Informe um e-mail válido.")
	}
	var hash string
	if in.LinkExisting {
		if in.Password != "" {
			return Manager{}, core.E(422, "existing_password_not_allowed", "A senha de uma conta existente não pode ser alterada aqui.")
		}
	} else {
		if len(in.Name) < 2 || len(in.Name) > 100 || len(in.Password) < 8 || len(in.Password) > 72 {
			return Manager{}, core.E(422, "invalid_manager", "Informe nome de 2 a 100 caracteres e senha de 8 a 72 bytes.")
		}
		value, err := bcrypt.GenerateFromPassword([]byte(in.Password), 12)
		if err != nil {
			return Manager{}, err
		}
		hash = string(value)
	}
	return s.Repo.CreateManager(ctx, academy, core.P(ctx).UserID, in, hash)
}
