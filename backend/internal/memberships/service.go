package memberships

import (
	"context"

	"tatame/backend/internal/access"
	"tatame/backend/internal/core"
)

type Service struct {
	Repo   Repository
	Access access.Service
}

func (s Service) Request(ctx context.Context, in RequestInput) (Request, error) {
	p := core.P(ctx)
	if p.UserID == "" {
		return Request{}, core.E(403, "forbidden", "Entre com uma conta pessoal.")
	}
	if in.Role != "student" && in.Role != "teacher" {
		return Request{}, core.E(422, "invalid_role", "Escolha aluno ou professor.")
	}
	return s.Repo.Request(ctx, p.UserID, in)
}
func (s Service) Update(ctx context.Context, a, id string, in Update) error {
	if _, e := s.Access.Require(ctx, a, "admin"); e != nil {
		return e
	}
	if !core.ValidID(id) {
		return core.E(404, "not_found", "Vínculo não encontrado.")
	}
	if in.Status != "" && in.Status != "active" && in.Status != "blocked" {
		return core.E(422, "invalid_status", "Status inválido.")
	}
	for _, role := range in.Roles {
		if role != "student" && role != "teacher" && role != "admin" {
			return core.E(422, "invalid_role", "Papel inválido.")
		}
	}
	if in.Roles != nil && len(in.Roles) == 0 {
		return core.E(422, "invalid_roles", "Informe pelo menos um papel.")
	}
	if len(in.Belt) > 40 {
		return core.E(422, "invalid_belt", "Faixa inválida.")
	}
	return s.Repo.Update(ctx, a, id, in)
}
