package subscriptions

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"strings"
	"tatame/backend/internal/core"
	"time"
)

type Event struct {
	Order        string `json:"order_nsu"`
	Transaction  string `json:"transaction_nsu"`
	Slug         string `json:"invoice_slug"`
	RedirectSlug string `json:"slug,omitempty"`
	Kind         string `json:"event,omitempty"`
}

func (e *Event) valid() bool {
	if e.Slug == "" {
		e.Slug = e.RedirectSlug
	}
	e.RedirectSlug = ""
	return core.ValidID(e.Order) && len(e.Transaction) > 0 && len(e.Transaction) <= 200 && len(e.Slug) > 0 && len(e.Slug) <= 200 && len(e.Kind) <= 50 && !strings.ContainsAny(e.Transaction+e.Slug, "\r\n\x00")
}
func (m *Manager) enqueue(ctx context.Context, e Event) error {
	var id string
	if err := m.DB.QueryRow(ctx, "SELECT id FROM platform_subscription_attempts WHERE reference=$1", e.Order).Scan(&id); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return core.E(404, "not_found", "Referência não encontrada.")
		}
		return err
	}
	raw, _ := json.Marshal(e)
	hash := sha256.Sum256(raw)
	_, err := m.DB.Exec(ctx, `INSERT INTO platform_subscription_inbox(id,attempt_id,fingerprint,payload) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(fingerprint) DO NOTHING`, core.ID(), id, hex.EncodeToString(hash[:]), string(raw))
	return err
}
func (m *Manager) review(ctx context.Context, c attempt, reason string) error {
	_, e := m.DB.Exec(ctx, "UPDATE platform_subscription_attempts SET state=CASE WHEN state='paid' THEN state ELSE 'review' END,review_reason=$2,updated_at=now() WHERE id=$1", c.ID, reason)
	if e != nil {
		return e
	}
	return core.E(409, "subscription_payment_review", reason)
}
func (m *Manager) verify(ctx context.Context, c attempt, event Event) error {
	if !m.Config.Enabled {
		return disabled()
	}
	if c.Receiver != m.Config.Handle {
		return m.review(ctx, c, "Conta recebedora foi alterada. Confira esta cobrança com o suporte.")
	}
	var out struct {
		Success    bool   `json:"success"`
		Paid       bool   `json:"paid"`
		Amount     int64  `json:"amount"`
		PaidAmount int64  `json:"paid_amount"`
		Method     string `json:"capture_method"`
	}
	e := m.Bank.request(ctx, "/payment_check", map[string]any{"handle": c.Receiver, "order_nsu": c.Reference, "transaction_nsu": event.Transaction, "slug": event.Slug}, &out)
	if e != nil {
		return core.E(503, "subscription_check_unavailable", "Não foi possível conferir o pagamento agora.")
	}
	if !out.Success {
		return core.E(409, "subscription_payment_waiting", "Pagamento ainda não confirmado.")
	}
	if out.Amount != PriceCents {
		return m.review(ctx, c, "Valor divergente. O pagamento exige conferência.")
	}
	if !out.Paid {
		if c.State == "paid" {
			return m.review(ctx, c, "Pagamento antes confirmado mudou no provedor. Confira possível estorno.")
		}
		_, e = m.DB.Exec(ctx, "UPDATE platform_subscription_attempts SET transaction_nsu=$2,slug=$3,last_checked_at=now() WHERE id=$1 AND state<>'paid'", c.ID, event.Transaction, event.Slug)
		if e != nil {
			return e
		}
		return core.E(409, "subscription_payment_waiting", "Pagamento ainda não confirmado.")
	}
	if out.PaidAmount < PriceCents || (out.Method != "pix" && out.Method != "credit_card") {
		return m.review(ctx, c, "Valor recebido ou meio de pagamento divergente.")
	}
	// The untrusted event name cannot revoke or confirm payment; only provider response is proof.
	tx, e := m.DB.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	var until time.Time
	var billingDay int
	if e = tx.QueryRow(ctx, "SELECT paid_until,billing_day FROM platform_subscriptions WHERE academy_id=$1 FOR UPDATE", c.Academy).Scan(&until, &billingDay); e != nil {
		return e
	}
	var state string
	if e = tx.QueryRow(ctx, "SELECT state FROM platform_subscription_cycles WHERE academy_id=$1 AND id=$2 FOR UPDATE", c.Academy, c.Cycle).Scan(&state); e != nil {
		return e
	}
	var oldAttempt string
	e = tx.QueryRow(ctx, "SELECT attempt_id FROM platform_subscription_receipts WHERE transaction_nsu=$1", event.Transaction).Scan(&oldAttempt)
	if e != nil && !errors.Is(e, pgx.ErrNoRows) {
		return e
	}
	if e == nil {
		if oldAttempt != c.ID {
			tx.Rollback(ctx)
			return m.review(ctx, c, "Transação já utilizada em outra assinatura.")
		}
		return tx.Commit(ctx)
	}
	if state == "paid" {
		tx.Rollback(ctx)
		return m.review(ctx, c, "Outro pagamento já quitou este período. Confira possível duplicidade.")
	}
	now := m.Now().UTC()
	start := until
	if now.After(start) {
		start = now
		billingDay = now.Day()
	}
	end := nextMonthOn(start, billingDay)
	if _, e = tx.Exec(ctx, "INSERT INTO platform_subscription_receipts(transaction_nsu,attempt_id,cycle_id,amount_cents,capture_method) VALUES($1,$2,$3,$4,$5)", event.Transaction, c.ID, c.Cycle, PriceCents, out.Method); e != nil {
		return e
	}
	if _, e = tx.Exec(ctx, "UPDATE platform_subscription_cycles SET state='paid',period_start=$2,period_end=$3,paid_at=$4 WHERE id=$1", c.Cycle, start, end, now); e != nil {
		return e
	}
	if _, e = tx.Exec(ctx, "UPDATE platform_subscriptions SET paid_until=$2,billing_day=$3,updated_at=now() WHERE academy_id=$1", c.Academy, end, billingDay); e != nil {
		return e
	}
	if _, e = tx.Exec(ctx, "UPDATE platform_subscription_attempts SET state='paid',transaction_nsu=$2,slug=$3,review_reason='',last_checked_at=now(),updated_at=now() WHERE id=$1", c.ID, event.Transaction, event.Slug); e != nil {
		return e
	}
	return tx.Commit(ctx)
}
func (m *Manager) Check(ctx context.Context, a, id string, event Event) (Checkout, error) {
	if e := m.authorize(ctx, a); e != nil {
		return Checkout{}, e
	}
	if !m.Config.Enabled {
		return Checkout{}, disabled()
	}
	lookup := "id"
	if id == "" && core.ValidID(event.Order) {
		id = event.Order
		lookup = "reference"
	}
	if !core.ValidID(id) {
		return Checkout{}, core.E(422, "invalid_attempt", "Tentativa inválida.")
	}
	c, e := scanAttempt(m.DB.QueryRow(ctx, "SELECT "+columns+" FROM platform_subscription_attempts WHERE academy_id=$1 AND "+lookup+"=$2", a, id))
	if errors.Is(e, pgx.ErrNoRows) {
		return Checkout{}, core.E(404, "not_found", "Tentativa não encontrada.")
	}
	if e != nil {
		return Checkout{}, e
	}
	if event.Transaction != "" || event.Slug != "" || event.RedirectSlug != "" {
		if !event.valid() || event.Order != c.Reference {
			return Checkout{}, core.E(422, "invalid_event", "Dados do retorno inválidos.")
		}
	} else {
		event = Event{Order: c.Reference, Transaction: c.Transaction, Slug: c.Slug}
		if !event.valid() {
			return c.result(m.Now()), nil
		}
	}
	if e = m.enqueue(ctx, event); e != nil {
		return Checkout{}, e
	}
	e = m.verify(ctx, c, event)
	if e != nil {
		var ce *core.Error
		if !errors.As(e, &ce) || (ce.Code != "subscription_payment_waiting" && ce.Code != "subscription_payment_review") {
			return Checkout{}, e
		}
	}
	c, err := scanAttempt(m.DB.QueryRow(ctx, "SELECT "+columns+" FROM platform_subscription_attempts WHERE id=$1", c.ID))
	if err != nil {
		return Checkout{}, err
	}
	return c.result(m.Now()), nil
}
func (m *Manager) RunCycle(ctx context.Context) error {
	if !m.Config.Enabled {
		return nil
	}
	for n := 0; n < 30; n++ {
		var id, attemptID string
		var raw []byte
		var tries int
		e := m.DB.QueryRow(ctx, `UPDATE platform_subscription_inbox SET state='processing',lease_until=now()+interval '60 seconds',tries=tries+1 WHERE id=(SELECT id FROM platform_subscription_inbox WHERE (state='pending' AND next_attempt_at<=now()) OR (state='processing' AND lease_until<now()) ORDER BY next_attempt_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING id,attempt_id,payload,tries`).Scan(&id, &attemptID, &raw, &tries)
		if errors.Is(e, pgx.ErrNoRows) {
			break
		}
		if e != nil {
			return e
		}
		var event Event
		e = json.Unmarshal(raw, &event)
		c, err := scanAttempt(m.DB.QueryRow(ctx, "SELECT "+columns+" FROM platform_subscription_attempts WHERE id=$1", attemptID))
		if e == nil {
			e = err
		}
		if e == nil {
			e = m.verify(ctx, c, event)
		}
		state := "done"
		if e != nil {
			state = "pending"
			var ce *core.Error
			if tries >= 20 || (errors.As(e, &ce) && ce.Code == "subscription_payment_review") {
				state = "review"
			}
		}
		if _, err = m.DB.Exec(ctx, "UPDATE platform_subscription_inbox SET state=$2,next_attempt_at=now()+interval '1 minute',lease_until=NULL WHERE id=$1", id, state); err != nil {
			return err
		}
	}
	rows, e := m.DB.Query(ctx, "SELECT "+columns+" FROM platform_subscription_attempts WHERE transaction_nsu<>'' AND slug<>'' AND state IN('ready','uncertain') AND (last_checked_at IS NULL OR last_checked_at<now()-interval '1 minute') ORDER BY updated_at LIMIT 30")
	if e != nil {
		return e
	}
	all := []attempt{}
	for rows.Next() {
		c, err := scanAttempt(rows)
		if err != nil {
			rows.Close()
			return err
		}
		all = append(all, c)
	}
	e = rows.Err()
	rows.Close()
	if e != nil {
		return e
	}
	for _, c := range all {
		_ = m.verify(ctx, c, Event{Order: c.Reference, Transaction: c.Transaction, Slug: c.Slug})
	}
	return nil
}
