package devices

import (
	"context"
	"strings"
	"tatame/backend/internal/access"
	"tatame/backend/internal/core"
)

type Service struct {
	Repo   Repository
	Access access.Service
}

func (s Service) Create(ctx context.Context, a string, in Input, token string) (Credential, error) {
	if _, e := s.Access.Require(ctx, a, "admin"); e != nil {
		return Credential{}, e
	}
	in.Name = strings.TrimSpace(in.Name)
	if len(in.Name) < 2 || len(in.Name) > 80 {
		return Credential{}, core.E(422, "invalid_name", "Informe o nome do tablet.")
	}
	return s.Repo.Create(ctx, a, in.Name, token)
}
func (s Service) List(ctx context.Context, a string) ([]Device, error) {
	if _, e := s.Access.Require(ctx, a, "admin"); e != nil {
		return nil, e
	}
	return s.Repo.List(ctx, a)
}
func (s Service) Revoke(ctx context.Context, a, id string) error {
	if _, e := s.Access.Require(ctx, a, "admin"); e != nil {
		return e
	}
	if !core.ValidID(id) {
		return core.E(404, "not_found", "Tablet não encontrado.")
	}
	return s.Repo.Revoke(ctx, a, id)
}
