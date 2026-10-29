package students

import (
	"context"
	"github.com/jackc/pgx/v5"
	"strings"
	"tatame/backend/internal/billing"
	"tatame/backend/internal/core"
	"time"
)

// Called with the student row locked, so identity and payer cannot be resolved
// against a different revision of the enrollment.
func resolveIdentity(ctx context.Context, tx pgx.Tx, a, id string, in *Input, oldBirth string) (bool, error) {
	var zone string
	if err := tx.QueryRow(ctx, "SELECT timezone FROM academies WHERE id=$1", a).Scan(&zone); err != nil {
		return false, err
	}
	loc, err := time.LoadLocation(zone)
	if err != nil {
		return false, err
	}
	now := time.Now().In(loc)
	if in.BirthDate == nil {
		if id == "" {
			return false, core.E(422, "birth_date_required", "Informe a data de nascimento do aluno.")
		}
		in.BirthDate = &oldBirth
	}
	value := strings.TrimSpace(*in.BirthDate)
	adult := false
	if value != "" {
		birth, e := time.Parse("2006-01-02", value)
		if e != nil || birth.Year() < 1900 || value > now.Format("2006-01-02") {
			return false, core.E(422, "invalid_birth_date", "Informe uma data de nascimento válida, sem datas futuras.")
		}
		adult = core.AgeOn(birth, now) >= 18
	} else if id == "" || oldBirth != "" {
		return false, core.E(422, "birth_date_required", "A data de nascimento não pode ficar vazia.")
	}
	in.BirthDate = &value

	var oldEnabled bool
	var oldPayer, oldDocument string
	if id != "" {
		if err = tx.QueryRow(ctx, `SELECT COALESCE((SELECT enabled FROM student_billing WHERE academy_id=$1 AND student_id=$2),false),
 COALESCE((SELECT payer_name FROM student_billing WHERE academy_id=$1 AND student_id=$2),''),
 COALESCE((SELECT payer_document FROM student_billing WHERE academy_id=$1 AND student_id=$2),'')`, a, id).Scan(&oldEnabled, &oldPayer, &oldDocument); err != nil {
			return false, err
		}
	}
	b := in.Billing
	if b == nil {
		if value != "" && !adult && oldEnabled && (len(strings.TrimSpace(oldPayer)) < 2 || !billing.ValidDocument(oldDocument) || oldDocument == *in.CPF) {
			return false, core.E(422, "guardian_required", "Informe nome e CPF/CNPJ do responsável financeiro do menor.")
		}
		if adult && oldEnabled && !billing.ValidDocument(*in.CPF) {
			return false, core.E(422, "invalid_cpf", "Informe o CPF do aluno para suas próximas mensalidades.")
		}
		return adult, nil
	}
	if adult {
		b.PayerName = in.Name
		b.PayerDocument = *in.CPF
	} else {
		b.PayerName = strings.TrimSpace(b.PayerName)
		b.PayerDocument = strings.TrimSpace(b.PayerDocument)
		if value == "" && b.PayerName == "" {
			b.PayerName = in.Name
		} // legacy records remain unchanged until reviewed.
	}
	if value != "" && !adult && (b.Enabled || b.PayerDocument != "") &&
		(len(b.PayerName) < 2 || !billing.ValidDocument(b.PayerDocument) || b.PayerDocument == *in.CPF) {
		return false, core.E(422, "guardian_required", "Informe nome e CPF/CNPJ de um responsável financeiro diferente do menor.")
	}
	month, e := time.Parse("2006-01", b.FirstMonth)
	if e != nil || month.Year() < 2020 || month.Year() > 2100 || b.AmountCents < 0 || b.AmountCents > 100000000 ||
		b.Enabled && b.AmountCents < 1 || b.DueDay < 1 || b.DueDay > 31 || len(b.PayerName) > 100 ||
		(b.Enabled || b.PayerDocument != "") && (!billing.ValidDocument(b.PayerDocument) || len(b.PayerName) < 2) {
		return false, core.E(422, "invalid_billing", "Confira valor mensal, vencimento, mês de início da cobrança e os dados de quem paga.")
	}
	if b.Enabled && in.Status == "inactive" {
		return false, core.E(422, "inactive_billing", "Reative o aluno antes de ativar a cobrança.")
	}
	if b.Enabled && !oldEnabled && b.FirstMonth < now.Format("2006-01") {
		return false, core.E(422, "past_start", "O mês de início da cobrança deve ser o atual ou um mês futuro.")
	}
	if b.Enabled && !oldEnabled {
		b.FirstMonth = billing.FirstBillingMonth(b.FirstMonth, b.DueDay, now)
	}
	return adult, nil
}
