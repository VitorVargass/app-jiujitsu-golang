package subscriptions

import (
	"context"
	"github.com/jackc/pgx/v5"
)

type Plan struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	MinStudents int    `json:"min_students"`
	MaxStudents *int   `json:"max_students"`
	Amount      int64  `json:"amount_cents"`
}

func Plans() []Plan {
	essential, professional := 200, 999
	return []Plan{
		{ID: "essential", Name: "Essencial", MinStudents: 0, MaxStudents: &essential, Amount: 15000},
		{ID: "professional", Name: "Profissional", MinStudents: 201, MaxStudents: &professional, Amount: 25000},
		{ID: "large", Name: "Grande academia", MinStudents: 1000, Amount: 45000},
	}
}

func PlanForStudents(count int) Plan {
	plans := Plans()
	if count >= 1000 {
		return plans[2]
	}
	if count > 200 {
		return plans[1]
	}
	return plans[0]
}

func EffectivePlan(count int, selected string) Plan {
	current := PlanForStudents(count)
	for _, p := range Plans() {
		if p.ID == selected && p.Amount > current.Amount {
			return p
		}
	}
	return current
}

func (m *Manager) activeStudents(ctx context.Context, academy string) (int, error) {
	var count int
	err := m.DB.QueryRow(ctx, "SELECT count(*) FROM students WHERE academy_id=$1 AND status='active' AND archived_at IS NULL", academy).Scan(&count)
	return count, err
}

// Caller locks platform_subscriptions first, serializing pricing and issuance.
// Never reprice a period that has a checkout attempt, including a rejected one.
func syncCyclePrice(ctx context.Context, tx pgx.Tx, academy, cycle string, plan Plan, count int) error {
	_, err := tx.Exec(ctx, `UPDATE platform_subscription_cycles SET amount_cents=$3,plan_id=$4,active_students=$5 WHERE academy_id=$1 AND id=$2 AND state='open' AND NOT EXISTS(SELECT 1 FROM platform_subscription_attempts WHERE cycle_id=$2)`, academy, cycle, plan.Amount, plan.ID, count)
	return err
}
