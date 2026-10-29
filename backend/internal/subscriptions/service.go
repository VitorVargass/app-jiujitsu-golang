package subscriptions

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"tatame/backend/internal/access"
	"tatame/backend/internal/core"
	"time"
)

func scanAttempt(row pgx.Row) (attempt, error) {
	var c attempt
	e := row.Scan(&c.ID, &c.Academy, &c.Cycle, &c.Reference, &c.Receiver, &c.State, &c.URL, &c.Transaction, &c.Slug, &c.Reason, &c.Expires)
	return c, e
}
func (m *Manager) authorize(ctx context.Context, a string) error {
	_, e := (access.Service{DB: m.DB}).Require(ctx, a, "admin")
	return e
}
func (m *Manager) Status(ctx context.Context, a string) (Status, error) {
	if e := m.authorize(ctx, a); e != nil {
		return Status{}, e
	}
	return m.snapshot(ctx, a, true)
}
func (m *Manager) snapshot(ctx context.Context, a string, withCycle bool) (Status, error) {
	v := Status{Enabled: m.Config.Enabled, Price: PriceCents, State: "disabled"}
	if !v.Enabled {
		return v, nil
	}
	if e := m.ensure(ctx, a); e != nil {
		return v, e
	}
	tx, e := m.DB.Begin(ctx)
	if e != nil {
		return v, e
	}
	defer tx.Rollback(ctx)
	var until time.Time
	var billingDay int
	if e = tx.QueryRow(ctx, "SELECT paid_until,renewal_enabled,billing_day FROM platform_subscriptions WHERE academy_id=$1 FOR UPDATE", a).Scan(&until, &v.Renewal, &billingDay); e != nil {
		return v, e
	}
	now := m.Now().UTC()
	v.State, v.Restricted = accessState(until, now, v.Renewal)
	v.RenewalSoon = v.State == "active" && until.Sub(now) <= 7*24*time.Hour
	v.PaidUntil = &until
	grace := until.Add(Grace)
	v.GraceUntil = &grace
	if withCycle && v.Renewal {
		c := Cycle{ID: core.ID(), Academy: a, Start: until, End: nextMonthOn(until, billingDay), Amount: PriceCents}
		if _, e = tx.Exec(ctx, `INSERT INTO platform_subscription_cycles(id,academy_id,period_start,period_end) VALUES($1,$2,$3,$4) ON CONFLICT(academy_id,period_start) DO NOTHING`, c.ID, a, c.Start, c.End); e != nil {
			return v, e
		}
		if e = tx.QueryRow(ctx, "SELECT id,period_start,period_end,amount_cents,state,paid_at FROM platform_subscription_cycles WHERE academy_id=$1 AND period_start=$2", a, until).Scan(&c.ID, &c.Start, &c.End, &c.Amount, &c.State, &c.PaidAt); e != nil {
			return v, e
		}
		v.Cycle = &c
		att, err := scanAttempt(tx.QueryRow(ctx, "SELECT "+columns+" FROM platform_subscription_attempts WHERE academy_id=$1 AND cycle_id=$2", a, c.ID))
		if err == nil {
			out := att.result(now)
			v.Checkout = &out
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return v, err
		}
	}
	return v, tx.Commit(ctx)
}
func (m *Manager) Renewal(ctx context.Context, a string, enabled bool) error {
	if e := m.authorize(ctx, a); e != nil {
		return e
	}
	if !m.Config.Enabled {
		return disabled()
	}
	if e := m.ensure(ctx, a); e != nil {
		return e
	}
	tx, e := m.DB.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	if _, e = tx.Exec(ctx, "UPDATE platform_subscriptions SET renewal_enabled=$2,updated_at=now() WHERE academy_id=$1", a, enabled); e != nil {
		return e
	}
	if _, e = tx.Exec(ctx, "INSERT INTO platform_subscription_events(id,academy_id,actor_user_id,renewal_enabled) VALUES($1,$2,$3,$4)", core.ID(), a, core.P(ctx).UserID, enabled); e != nil {
		return e
	}
	return tx.Commit(ctx)
}
func (m *Manager) History(ctx context.Context, a string, page, size int) (core.Page[Cycle], error) {
	v := core.Page[Cycle]{Items: []Cycle{}, Page: page, PageSize: size}
	if e := m.authorize(ctx, a); e != nil {
		return v, e
	}
	if e := m.DB.QueryRow(ctx, "SELECT count(*) FROM platform_subscription_cycles WHERE academy_id=$1", a).Scan(&v.Total); e != nil {
		return v, e
	}
	rows, e := m.DB.Query(ctx, "SELECT c.id,c.period_start,c.period_end,c.amount_cents,c.state,c.paid_at,COALESCE(p.state,''),COALESCE(p.review_reason,'') FROM platform_subscription_cycles c LEFT JOIN platform_subscription_attempts p ON p.cycle_id=c.id WHERE c.academy_id=$1 ORDER BY c.period_start DESC,c.id LIMIT $2 OFFSET $3", a, size, (page-1)*size)
	if e != nil {
		return v, e
	}
	defer rows.Close()
	for rows.Next() {
		var c Cycle
		if e = rows.Scan(&c.ID, &c.Start, &c.End, &c.Amount, &c.State, &c.PaidAt, &c.CheckoutState, &c.ReviewReason); e != nil {
			return v, e
		}
		v.Items = append(v.Items, c)
	}
	return v, rows.Err()
}
func (m *Manager) Checkout(ctx context.Context, a, id string) (Checkout, error) {
	if e := m.authorize(ctx, a); e != nil {
		return Checkout{}, e
	}
	if !m.Config.Enabled {
		return Checkout{}, disabled()
	}
	if !core.ValidID(id) {
		return Checkout{}, core.E(422, "invalid_cycle", "Atualize a assinatura antes de pagar.")
	}
	var state string
	var renewal bool
	e := m.DB.QueryRow(ctx, `SELECT c.state,s.renewal_enabled FROM platform_subscription_cycles c JOIN platform_subscriptions s ON s.academy_id=c.academy_id WHERE c.academy_id=$1 AND c.id=$2`, a, id).Scan(&state, &renewal)
	if errors.Is(e, pgx.ErrNoRows) {
		return Checkout{}, core.E(404, "not_found", "Cobrança não encontrada.")
	}
	if e != nil {
		return Checkout{}, e
	}
	if state == "paid" {
		return Checkout{Status: "paid", Amount: PriceCents}, nil
	}
	if !renewal {
		return Checkout{}, core.E(409, "renewal_disabled", "Retome a assinatura antes de gerar um pagamento.")
	}
	c := attempt{ID: core.ID(), Academy: a, Cycle: id, Reference: core.ID(), Receiver: m.Config.Handle, State: "creating", Expires: m.Now().Add(24 * time.Hour)}
	tag, e := m.DB.Exec(ctx, `INSERT INTO platform_subscription_attempts(id,academy_id,cycle_id,reference,receiver_handle,state,expires_at) VALUES($1,$2,$3,$4,$5,'creating',$6) ON CONFLICT(cycle_id) DO NOTHING`, c.ID, a, id, c.Reference, c.Receiver, c.Expires)
	if e != nil {
		return Checkout{}, e
	}
	if tag.RowsAffected() == 0 {
		c, e = scanAttempt(m.DB.QueryRow(ctx, "SELECT "+columns+" FROM platform_subscription_attempts WHERE academy_id=$1 AND cycle_id=$2", a, id))
		if e != nil {
			return Checkout{}, e
		}
		if c.State != "rejected" {
			return c.result(m.Now()), nil
		}
		tag, e = m.DB.Exec(ctx, "UPDATE platform_subscription_attempts SET state='creating',expires_at=$2,receiver_handle=$3,updated_at=now() WHERE id=$1 AND state='rejected'", c.ID, m.Now().Add(24*time.Hour), m.Config.Handle)
		if e != nil {
			return Checkout{}, e
		}
		if tag.RowsAffected() == 0 {
			return Checkout{Status: "review", Amount: PriceCents}, nil
		}
		c.Expires = m.Now().Add(24 * time.Hour)
		c.Receiver = m.Config.Handle
	}
	// Attempt is durable BEFORE external IO. Cancellation/crash never permits automatic reissue.
	var name, email string
	_ = m.DB.QueryRow(ctx, "SELECT u.name,COALESCE(p.email,'') FROM users u JOIN people p ON p.id=u.person_id WHERE u.id=$1", core.P(ctx).UserID).Scan(&name, &email)
	input := map[string]any{
		"order_nsu":    c.Reference,
		"redirect_url": m.Config.PublicURL + "/subscription?academy_id=" + a,
		"items":        []map[string]any{{"quantity": 1, "price": PriceCents, "description": "Assinatura TatameMix — mensal"}},
		"options":      map[string]any{"single_payment": true, "valid_until": c.Expires.Format(time.RFC3339), "require_delivery_address": false, "payment_methods_enabled": []string{"pix", "credit_card"}},
		"webhook":      map[string]any{"url": m.Config.PublicURL + "/v1/webhooks/tatamemix/infinitepay", "events": []string{"paid", "refunded", "canceled"}},
	}
	if name != "" || email != "" {
		input["customer"] = map[string]string{"name": name, "email": email}
	}
	var out struct {
		URL string `json:"url"`
	}
	e = m.Bank.request(ctx, "/links", input, &out)
	c.State = "ready"
	c.URL = out.URL
	if e != nil || !validURL(out.URL) {
		c.State = "uncertain"
		c.URL = ""
		var pe *providerError
		if errors.As(e, &pe) && (pe.Status == 400 || pe.Status == 401 || pe.Status == 403 || pe.Status == 422) {
			c.State = "rejected"
		}
	}
	save, done := context.WithTimeout(context.Background(), 5*time.Second)
	defer done()
	// A fast webhook may already have settled the attempt. Never overwrite that state.
	_, err := m.DB.Exec(save, "UPDATE platform_subscription_attempts SET state=$2,checkout_url=$3,updated_at=now() WHERE id=$1 AND state='creating'", c.ID, c.State, c.URL)
	if err != nil {
		return Checkout{}, err
	}
	current, err := scanAttempt(m.DB.QueryRow(save, "SELECT "+columns+" FROM platform_subscription_attempts WHERE id=$1", c.ID))
	if err != nil {
		return Checkout{}, err
	}
	if current.State == "rejected" {
		return Checkout{}, core.E(502, "subscription_checkout_rejected", "A InfinitePay recusou o link. Confira a configuração da TatameMix.")
	}
	return current.result(m.Now()), nil
}
