package payments

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"tatame/backend/internal/core"
	"time"
)

// A bounded lease serializes issuance/cancellation across API instances without holding a DB connection during HTTP calls.
func (m *Manager) lockOperation(ctx context.Context, a, id string) (func(), error) {
	owner := core.ID()
	var stored string
	e := m.Repo.DB.QueryRow(ctx, `INSERT INTO payment_operation_locks(academy_id,invoice_id,owner,expires_at) VALUES($1,$2,$3,now()+interval '2 minutes')
 ON CONFLICT(academy_id,invoice_id) DO UPDATE SET owner=EXCLUDED.owner,expires_at=EXCLUDED.expires_at WHERE payment_operation_locks.expires_at<now() RETURNING owner`, a, id, owner).Scan(&stored)
	if errors.Is(e, pgx.ErrNoRows) {
		return nil, core.E(503, "pix_pending", "Uma operação desta mensalidade está em andamento. Aguarde e tente novamente.")
	}
	if e != nil {
		return nil, e
	}
	return func() {
		release, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_, _ = m.Repo.DB.Exec(release, "DELETE FROM payment_operation_locks WHERE academy_id=$1 AND invoice_id=$2 AND owner=$3", a, id, owner)
	}, nil
}
