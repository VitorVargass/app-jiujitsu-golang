package payments

import (
	"context"
	"time"
)

func (c checkoutAttempt) renewable() bool {
	return c.State != "paid" && !time.Now().Before(c.Expires)
}

// The invoice lock serializes renewal. Retain every reference for late payments.
func (m *Manager) renewExpiredCheckout(ctx context.Context, c checkoutAttempt) (bool, error) {
	if !c.renewable() {
		return false, nil
	}
	tag, err := m.Repo.DB.Exec(ctx, "UPDATE checkout_attempts SET retired_at=now(),retirement_note='Substituição de tentativa com validade encerrada.',updated_at=now() WHERE id=$1 AND retired_at IS NULL AND state<>'paid' AND expires_at<=now()", c.ID)
	return err == nil && tag.RowsAffected() == 1, err
}
