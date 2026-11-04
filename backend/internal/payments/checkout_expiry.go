package payments

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"tatame/backend/internal/core"
)

// A ready attempt was successfully created with options.valid_until. Unknown
// issuance outcomes and known transactions must never be replaced on time alone.
func (c checkoutAttempt) renewable() bool {
	return c.State == "ready" && validCheckoutURL(c.URL) && !time.Now().Before(c.Expires)
}

// Called under the invoice operation lock, also used by webhook reconciliation.
func (m *Manager) renewExpiredCheckout(ctx context.Context, c checkoutAttempt) (bool, error) {
	if !c.renewable() {
		return false, nil
	}
	event := InfiniteEvent{Order: c.Reference, Transaction: c.Transaction, Slug: c.Slug}
	if event.Transaction == "" || event.Slug == "" {
		var raw []byte
		err := m.Repo.DB.QueryRow(ctx, `SELECT payload FROM checkout_inbox WHERE connection_id=$1 AND payload->>'order_nsu'=$2 AND state<>'done' ORDER BY created_at DESC LIMIT 1`, c.Connection, c.Reference).Scan(&raw)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return false, err
		}
		if err == nil {
			if err = json.Unmarshal(raw, &event); err != nil || !event.normalize() {
				return false, core.E(409, "payment_review", "Há uma notificação pendente deste pagamento. Confira a transação antes de gerar outro link.")
			}
		}
	}
	if event.Transaction != "" || event.Slug != "" {
		if event.Transaction == "" || event.Slug == "" {
			return false, core.E(409, "payment_review", "Há uma transação pendente de conferência. Não foi emitido outro link.")
		}
		if err := m.checkInfinite(ctx, c, event); err != nil {
			return false, err
		}
		// Successful confirmation has already settled the invoice.
		return false, nil
	}
	var historicalReview bool
	if err := m.Repo.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM checkout_attempts WHERE academy_id=$1 AND invoice_id=$2 AND retired_at IS NOT NULL AND state='review')`, c.Academy, c.Invoice).Scan(&historicalReview); err != nil {
		return false, err
	}
	if historicalReview {
		return false, core.E(409, "payment_review", "Há um recebimento anterior em conferência. Confira com a academia antes de emitir outro link.")
	}
	tag, err := m.Repo.DB.Exec(ctx, `UPDATE checkout_attempts SET retired_at=now(),retirement_note='Substituição automática de link com validade encerrada, sem transação conhecida.',updated_at=now() WHERE id=$1 AND retired_at IS NULL AND state='ready' AND expires_at<=now() AND transaction_nsu='' AND slug=''`, c.ID)
	return err == nil && tag.RowsAffected() == 1, err
}
