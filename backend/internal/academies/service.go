package academies

import (
	"context"
	"strings"
	"tatame/backend/internal/core"
	"time"
)

type Service struct{ Repo Repository }

func (s Service) Create(ctx context.Context, in CreateInput) (Academy, error) {
	if core.P(ctx).UserID == "" {
		return Academy{}, core.E(403, "forbidden", "Uma conta pessoal é necessária.")
	}
	in.Name = strings.TrimSpace(in.Name)
	if in.PlanID != "essential" && in.PlanID != "professional" && in.PlanID != "large" {
		return Academy{}, core.E(422, "plan_required", "Selecione um plano para esta academia.")
	}
	if in.TermsVersion != core.LegalVersion {
		return Academy{}, core.E(422, "subscription_terms_required", "Confirme as condições da assinatura e do teste grátis de 5 dias.")
	}
	if len(in.Name) < 2 || len(in.Name) > 120 {
		return Academy{}, core.E(422, "invalid_name", "Informe um nome de 2 a 120 caracteres.")
	}
	if in.Timezone == "" {
		in.Timezone = "America/Sao_Paulo"
	}
	if _, e := time.LoadLocation(in.Timezone); e != nil {
		return Academy{}, core.E(422, "invalid_timezone", "Fuso horário inválido.")
	}
	return s.Repo.Create(ctx, core.P(ctx).UserID, in)
}
