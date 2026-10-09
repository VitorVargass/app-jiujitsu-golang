package students

import (
	"context"
	"net/mail"
	"strings"
	"tatame/backend/internal/access"
	"tatame/backend/internal/billing"
	"tatame/backend/internal/core"
	"time"
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
	if b := in.Billing; b != nil {
		b.PayerName = strings.TrimSpace(b.PayerName)
		b.PayerDocument = strings.TrimSpace(b.PayerDocument)
		month, e := time.Parse("2006-01", b.FirstMonth)
		if e != nil || month.Year() < 2020 || month.Year() > 2100 || b.AmountCents < 1 || b.AmountCents > 100000000 || b.DueDay < 1 || b.DueDay > 31 || len(b.PayerName) < 2 || len(b.PayerName) > 100 || !billing.ValidDocument(b.PayerDocument) {
			return Student{}, core.E(422, "invalid_billing", "Informe valor positivo, vencimento de 1 a 31, competência YYYY-MM e nome/CPF ou CNPJ válido do pagador.")
		}
		if b.Enabled && in.Status == "inactive" {
			return Student{}, core.E(422, "inactive_billing", "Reative o aluno antes de ativar a cobrança.")
		}
		if b.Enabled {
			previousEnabled := false
			if id != "" {
				v, e := s.Repo.Get(ctx, a, id)
				if e != nil {
					return Student{}, e
				}
				previousEnabled = v.Billing != nil && v.Billing.Enabled
			}
			if !previousEnabled {
				var zone string
				if e := s.Repo.DB.QueryRow(ctx, "SELECT timezone FROM academies WHERE id=$1", a).Scan(&zone); e != nil {
					return Student{}, e
				}
				loc, e := time.LoadLocation(zone)
				if e != nil {
					return Student{}, e
				}
				now := time.Now().In(loc)
				if b.FirstMonth < now.Format("2006-01") {
					return Student{}, core.E(422, "past_start", "A ativação deve começar na competência atual ou futura.")
				}
			}
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
	return s.Repo.SaveCatalog(ctx, a, id, in, plans)
}
