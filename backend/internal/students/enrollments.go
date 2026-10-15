package students

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"regexp"
	"strings"
	"tatame/backend/internal/core"
)

func normalizeEnrollments(in *Input) error {
	in.AlternatePhone = strings.TrimSpace(in.AlternatePhone)
	if len(in.AlternatePhone) > 30 {
		return core.E(422, "invalid_contact", "Telefone alternativo inválido.")
	}
	if in.ChargeMode == "" {
		in.ChargeMode = "custom"
	}
	if in.ChargeMode != "custom" && in.ChargeMode != "plan" && in.ChargeMode != "modalities" {
		return core.E(422, "invalid_charge_mode", "Escolha cobrança por plano ou por modalidades.")
	}
	if in.ChargeMode == "plan" && in.PlanID == "" {
		return core.E(422, "invalid_plan", "Selecione um plano.")
	}
	if in.ChargeMode == "modalities" && in.PlanID != "" {
		return core.E(422, "invalid_plan", "A cobrança por modalidades não utiliza plano.")
	}
	if in.ModalityDetails == nil {
		if in.ChargeMode != "custom" {
			return core.E(422, "invalid_modalities", "Informe as modalidades e suas graduações.")
		}
		return nil
	}
	if len(in.ModalityDetails) > 30 {
		return core.E(422, "invalid_modalities", "Selecione até 30 modalidades.")
	}
	seen := map[string]bool{}
	ids := []string{}
	var total int64
	for i := range in.ModalityDetails {
		d := &in.ModalityDetails[i]
		d.Belt = strings.TrimSpace(d.Belt)
		if !core.ValidID(d.ModalityID) || seen[d.ModalityID] || len(d.Belt) > 50 || d.AmountCents < 0 || d.AmountCents > 100000000 {
			return core.E(422, "invalid_modality", "Modalidade, faixa ou valor inválido.")
		}
		seen[d.ModalityID] = true
		ids = append(ids, d.ModalityID)
		total += d.AmountCents
	}
	if len(in.Modalities) > 0 {
		if len(in.Modalities) != len(ids) {
			return core.E(422, "invalid_modalities", "As modalidades informadas não correspondem às graduações.")
		}
		check := map[string]bool{}
		for _, id := range in.Modalities {
			if !seen[id] || check[id] {
				return core.E(422, "invalid_modalities", "Modalidades divergentes ou repetidas.")
			}
			check[id] = true
		}
	}
	in.Modalities = ids
	if in.ChargeMode != "custom" && len(ids) == 0 {
		return core.E(422, "invalid_modalities", "Selecione pelo menos uma modalidade.")
	}
	if in.ChargeMode == "modalities" && in.Billing != nil {
		in.Billing.AmountCents = total
	}
	if in.ChargeMode != "custom" {
		in.Belt = "Sem graduação"
		for _, d := range in.ModalityDetails {
			if d.Belt != "" {
				in.Belt = d.Belt
				break
			}
		}
	}
	return nil
}

var colorPattern = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

func validateBeltOptions(options []BeltOption) error {
	if len(options) > 30 {
		return core.E(422, "invalid_belts", "Configure até 30 graduações.")
	}
	labels := map[string]bool{}
	for i := range options {
		option := &options[i]
		option.Label = strings.TrimSpace(option.Label)
		key := strings.ToLower(option.Label)
		if len(option.Label) < 1 || len(option.Label) > 50 || labels[key] || len(option.Colors) < 1 || len(option.Colors) > 3 {
			return core.E(422, "invalid_belts", "Cada graduação precisa de um nome único e de uma a três cores.")
		}
		labels[key] = true
		for _, color := range option.Colors {
			if !colorPattern.MatchString(color) {
				return core.E(422, "invalid_belts", "Cor de graduação inválida.")
			}
		}
	}
	return nil
}

// Resolve against the academy inside the same transaction used to save the contract.
func resolveEnrollments(ctx context.Context, tx pgx.Tx, a, id string, in *Input) error {
	details := make([]ModalityDetail, 0, len(in.Modalities))
	supplied := map[string]ModalityDetail{}
	for _, d := range in.ModalityDetails {
		supplied[d.ModalityID] = d
	}
	for _, mid := range in.Modalities {
		var active, existing bool
		var raw []byte
		var price int64
		var oldBelt string
		err := tx.QueryRow(ctx, `SELECT m.active,m.belt_options,m.amount_cents,
   EXISTS(SELECT 1 FROM student_modalities sm WHERE sm.academy_id=m.academy_id AND sm.modality_id=m.id AND sm.student_id=NULLIF($3,'')::uuid),
   COALESCE((SELECT belt FROM student_modalities sm WHERE sm.academy_id=m.academy_id AND sm.modality_id=m.id AND sm.student_id=NULLIF($3,'')::uuid),'')
   FROM modalities m WHERE m.academy_id=$1 AND m.id=$2`, a, mid, id).Scan(&active, &raw, &price, &existing, &oldBelt)
		if errors.Is(err, pgx.ErrNoRows) || err == nil && !active && !existing {
			return core.E(422, "invalid_modality", "Selecione modalidades ativas desta academia.")
		}
		if err != nil {
			return err
		}
		var options []BeltOption
		if err = json.Unmarshal(raw, &options); err != nil {
			return err
		}
		d, present := supplied[mid]
		if !present {
			d = ModalityDetail{ModalityID: mid, AmountCents: price, Belt: oldBelt}
			if !existing && len(options) > 0 {
				d.Belt = in.Belt
			}
		} else {
			valid := len(options) == 0 && d.Belt == ""
			for _, option := range options {
				if option.Label == d.Belt {
					valid = true
					break
				}
			}
			if !valid && !(existing && d.Belt == oldBelt) {
				return core.E(422, "invalid_belt", "Selecione uma graduação válida para cada modalidade.")
			}
		}
		details = append(details, d)
	}
	if in.PlanID != "" {
		var active, existing bool
		err := tx.QueryRow(ctx, `SELECT active,EXISTS(SELECT 1 FROM students WHERE academy_id=$1 AND id=NULLIF($3,'')::uuid AND plan_id=$2) FROM plans WHERE academy_id=$1 AND id=$2`, a, in.PlanID, id).Scan(&active, &existing)
		if errors.Is(err, pgx.ErrNoRows) || err == nil && !active && !existing {
			return core.E(422, "invalid_plan", "Selecione um plano ativo desta academia.")
		}
		if err != nil {
			return err
		}
		if in.ChargeMode == "plan" {
			var ids []string
			if err = tx.QueryRow(ctx, "SELECT COALESCE(array_agg(modality_id::text),'{}'::text[]) FROM plan_modalities WHERE academy_id=$1 AND plan_id=$2", a, in.PlanID).Scan(&ids); err != nil {
				return err
			}
			if len(ids) == 0 || len(ids) != len(details) {
				return core.E(422, "invalid_plan_modalities", "As modalidades devem corresponder ao plano escolhido.")
			}
			selected := map[string]bool{}
			for _, d := range details {
				selected[d.ModalityID] = true
			}
			for _, mid := range ids {
				if !selected[mid] {
					return core.E(422, "invalid_plan_modalities", "As modalidades devem corresponder ao plano escolhido.")
				}
			}
		}
	}
	in.ModalityDetails = details
	return nil
}
