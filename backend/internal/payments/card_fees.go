package payments

import (
	"context"
	"net/http"
	"tatame/backend/internal/core"
)

func (h Handler) CardFees(w http.ResponseWriter, r *http.Request) {
	academyID := r.PathValue("academy")
	if _, err := h.Manager.Access.Require(r.Context(), academyID, "admin"); err != nil {
		core.Fail(w, err)
		return
	}
	var input struct {
		PassCardFees *bool `json:"pass_card_fees"`
	}
	if err := core.Decode(w, r, &input); err != nil {
		core.Fail(w, err)
		return
	}
	if input.PassCardFees == nil {
		core.Fail(w, core.E(422, "invalid_card_fees", "Escolha se deseja repassar as taxas do cartão ao aluno."))
		return
	}
	if err := h.Manager.saveCardFees(r.Context(), academyID, *input.PassCardFees); err != nil {
		core.Fail(w, err)
		return
	}
	h.Status(w, r)
}

func (m *Manager) saveCardFees(ctx context.Context, academyID string, pass bool) error {
	result, err := m.Repo.DB.Exec(ctx, `INSERT INTO payment_fee_settings(academy_id,pass_card_fees,updated_by)
 SELECT $1,$2,$3 WHERE EXISTS(
 SELECT 1 FROM memberships m JOIN membership_roles r ON r.membership_id=m.id
 WHERE m.academy_id=$1 AND m.user_id=$3 AND m.status='active' AND r.role='admin')
 ON CONFLICT(academy_id) DO UPDATE SET pass_card_fees=EXCLUDED.pass_card_fees,
 updated_by=EXCLUDED.updated_by,updated_at=now()`, academyID, pass, core.P(ctx).UserID)
	if err != nil {
		return err
	}
	if result.RowsAffected() != 1 {
		return core.E(403, "forbidden", "Acesso não autorizado.")
	}
	return nil
}
