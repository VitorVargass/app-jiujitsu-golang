// Package subscriptions bills academies for TatameMix. It never uses academy payment credentials.
package subscriptions

import (
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"tatame/backend/internal/core"
	"time"
)

const PriceCents int64 = 45000
const Grace = 5 * 24 * time.Hour

type Config struct {
	Enabled                   bool
	APIKey, Handle, PublicURL string
}
type Manager struct {
	DB     *pgxpool.Pool
	Config Config
	Bank   *Provider
	Now    func() time.Time
}

func New(db *pgxpool.Pool, cfg Config) *Manager {
	return &Manager{DB: db, Config: cfg, Bank: newProvider(cfg), Now: time.Now}
}

type Cycle struct {
	CheckoutState string     `json:"checkout_state,omitempty"`
	ReviewReason  string     `json:"review_reason,omitempty"`
	ID            string     `json:"id"`
	Academy       string     `json:"-"`
	Start         time.Time  `json:"period_start"`
	End           time.Time  `json:"period_end"`
	Amount        int64      `json:"amount_cents"`
	State         string     `json:"state"`
	PaidAt        *time.Time `json:"paid_at"`
}
type Status struct {
	RenewalSoon bool       `json:"renewal_soon"`
	Enabled     bool       `json:"enabled"`
	Price       int64      `json:"amount_cents"`
	State       string     `json:"status"`
	Restricted  bool       `json:"restricted"`
	Renewal     bool       `json:"renewal_enabled"`
	PaidUntil   *time.Time `json:"paid_until"`
	GraceUntil  *time.Time `json:"grace_until"`
	Cycle       *Cycle     `json:"cycle"`
	Checkout    *Checkout  `json:"checkout,omitempty"`
}
type Checkout struct {
	Retryable bool   `json:"retryable,omitempty"`
	ID        string `json:"id,omitempty"`
	Status    string `json:"status"`
	URL       string `json:"url,omitempty"`
	Amount    int64  `json:"amount_cents"`
	Reason    string `json:"review_reason,omitempty"`
}
type attempt struct {
	ID, Academy, Cycle, Reference, Receiver, State, URL, Transaction, Slug, Reason string
	Expires                                                                        time.Time
}

const columns = "id,academy_id,cycle_id,reference,receiver_handle,state,checkout_url,transaction_nsu,slug,review_reason,expires_at"

func nextMonth(t time.Time) time.Time { return nextMonthOn(t, t.UTC().Day()) }
func nextMonthOn(t time.Time, day int) time.Time {
	t = t.UTC()
	first := time.Date(t.Year(), t.Month()+1, 1, t.Hour(), t.Minute(), t.Second(), t.Nanosecond(), time.UTC)
	last := first.AddDate(0, 1, -1).Day()
	if day > last {
		day = last
	}
	return first.AddDate(0, 0, day-1)
}
func accessState(until, now time.Time, renewal bool) (string, bool) {
	if now.Before(until) {
		return "active", false
	}
	if !renewal {
		return "cancelled", true
	}
	if now.Before(until.Add(Grace)) {
		return "grace", false
	}
	return "overdue", true
}
func (c attempt) result(now time.Time) Checkout {
	v := Checkout{ID: c.ID, Amount: PriceCents, Status: "review", Reason: c.Reason}
	if c.State == "rejected" {
		v.Retryable = true
		v.Reason = "Emissão recusada pela InfinitePay. Após corrigir a configuração, tente novamente."
		return v
	}
	if c.State == "paid" {
		v.Status = "paid"
		return v
	}
	if c.State == "ready" && now.Before(c.Expires) {
		v.Status = "waiting"
		v.URL = c.URL
		return v
	}
	if v.Reason == "" {
		v.Reason = "A emissão precisa ser conferida antes de gerar outro link."
	}
	return v
}
func disabled() error {
	return core.E(503, "subscription_payments_disabled", "A cobrança do TatameMix ainda não foi habilitada pelo servidor.")
}
func (m *Manager) ensure(ctx context.Context, a string) error {
	_, e := m.DB.Exec(ctx, "INSERT INTO platform_subscriptions(academy_id) VALUES($1) ON CONFLICT DO NOTHING", a)
	return e
}
