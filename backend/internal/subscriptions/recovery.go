package subscriptions

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
)

// The caller holds the subscription row lock, shared with settlement and issuance.
// Expired attempts remain available to reconcile delayed notifications.
func (m *Manager) recoverExpired(ctx context.Context, tx pgx.Tx, academy, cycle string) (Checkout, bool, error) {
	c, err := scanAttempt(tx.QueryRow(ctx, "SELECT "+columns+" FROM platform_subscription_attempts WHERE academy_id=$1 AND cycle_id=$2 AND retired_at IS NULL", academy, cycle))
	if errors.Is(err, pgx.ErrNoRows) {
		return Checkout{}, false, nil
	}
	if err != nil {
		return Checkout{}, true, err
	}
	if !c.renewable(m.Now()) {
		return Checkout{}, false, nil
	}
	_, err = tx.Exec(ctx, "UPDATE platform_subscription_attempts SET retired_at=now(),updated_at=now() WHERE id=$1", c.ID)
	return Checkout{}, false, err
}
