package students

import (
	"context"
	"net/mail"
	"strings"
	"tatame/backend/internal/access"

	"tatame/backend/internal/core"
)

type Service struct {
	Repo   Repository
	Access access.Service
}

func (s Service) Save(ctx context.Context, a, id string, in Input) (Student, error) {
	if _, e := s.Access.Require(ctx, a, "admin"); e != nil {
		return Student{}, e
	}
	if id != "" && !core.ValidID(id) {
		return Student{}, core.E(404, "not_found", "Aluno não encontrado.")
	}
	if e := normalizeEnrollments(&in); e != nil {
		return Student{}, e
	}
	if in.CPF == nil && id == "" {
		return Student{}, core.E(422, "invalid_cpf", "Informe o CPF do próprio aluno.")
	}
	if in.CPF != nil {
		cpf, ok := core.NormalizeCPF(*in.CPF)
		if !ok || id == "" && cpf == "" {
			return Student{}, core.E(422, "invalid_cpf", "Informe um CPF válido do próprio aluno.")
		}
		in.CPF = &cpf
	}
	in.Name = strings.TrimSpace(in.Name)
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	in.Phone = strings.TrimSpace(in.Phone)
	if len(in.Name) < 2 || len(in.Name) > 100 || len(in.Phone) > 30 {
		return Student{}, core.E(422, "invalid_student", "Informe nome e contato válidos.")
	}
	if in.Email != "" {
		if _, e := mail.ParseAddress(in.Email); e != nil {
			return Student{}, core.E(422, "invalid_email", "E-mail inválido.")
		}
	}
	if in.Status == "" {
		in.Status = "active"
	}
	if in.Status != "active" && in.Status != "inactive" {
		return Student{}, core.E(422, "invalid_status", "Situação inválida.")
	}
	if in.Belt == "" {
		in.Belt = "Faixa Branca"
	}
	if len(in.Belt) > 50 {
		return Student{}, core.E(422, "invalid_belt", "Faixa inválida.")
	}
	if in.PlanID != "" && !core.ValidID(in.PlanID) {
		return Student{}, core.E(422, "invalid_plan", "Plano inválido.")
	}
	if len(in.Modalities) > 30 {
		return Student{}, core.E(422, "invalid_modalities", "Selecione até 30 modalidades.")
	}
	for _, m := range in.Modalities {
		if !core.ValidID(m) {
			return Student{}, core.E(422, "invalid_modality", "Modalidade inválida.")
		}
	}
	return s.Repo.Save(ctx, a, id, in)
}
func (s Service) SaveCatalog(ctx context.Context, a, id string, in Catalog, plans bool) (Catalog, error) {
	if _, e := s.Access.Require(ctx, a, "admin"); e != nil {
		return in, e
	}
	in.Name = strings.TrimSpace(in.Name)
	if len(in.Name) < 2 || len(in.Name) > 100 || (id != "" && !core.ValidID(id)) || (plans && (in.AmountCents <= 0 || in.AmountCents > 100000000)) {
		return in, core.E(422, "invalid_catalog", "Informe nome e valor válidos.")
	}
	for _, m := range in.Modalities {
		if !core.ValidID(m) {
			return in, core.E(422, "invalid_modality", "Modalidade inválida.")
		}
	}
	if !plans {
		if in.AmountCents < 0 || in.AmountCents > 100000000 {
			return in, core.E(422, "invalid_amount", "Valor mensal inválido.")
		}
		if e := validateBeltOptions(in.BeltOptions); e != nil {
			return in, e
		}
	}
	if len(in.Modalities) > 30 {
		return in, core.E(422, "invalid_modalities", "Selecione até 30 modalidades.")
	}
	return s.Repo.SaveCatalog(ctx, a, id, in, plans)
}
