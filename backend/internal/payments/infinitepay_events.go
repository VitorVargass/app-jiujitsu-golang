package payments

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"strings"
	"tatame/backend/internal/core"
)

type InfiniteEvent struct {
	Order        string `json:"order_nsu"`
	Transaction  string `json:"transaction_nsu"`
	Slug         string `json:"invoice_slug"`
	RedirectSlug string `json:"slug,omitempty"`
	Event        string `json:"event,omitempty"`
}

func (e *InfiniteEvent) normalize() bool {
	if e.Slug == "" {
		e.Slug = e.RedirectSlug
	}
	e.RedirectSlug = ""
	return core.ValidID(e.Order) && len(e.Transaction) > 0 && len(e.Transaction) <= 200 && len(e.Slug) > 0 && len(e.Slug) <= 200 && len(e.Event) <= 50 && !strings.ContainsAny(e.Transaction+e.Slug, "\r\n\x00")
}
func (p *InfinitePay) enqueue(ctx context.Context, connection string, event InfiniteEvent) error {
	raw, e := json.Marshal(event)
	if e != nil {
		return e
	}
	sum := sha256.Sum256(raw)
	_, e = p.DB.Exec(ctx, `INSERT INTO checkout_inbox(id,connection_id,fingerprint,payload) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(connection_id,fingerprint) DO NOTHING`, core.ID(), connection, hex.EncodeToString(sum[:]), string(raw))
	return e
}
func (m *Manager) checkInfinite(ctx context.Context, c checkoutAttempt, event InfiniteEvent) error {
	p := m.Infinite
	if p == nil || !p.Enabled {
		return core.E(503, "payments_disabled", "Confirmação bancária temporariamente indisponível.")
	}
	conn, e := p.connection(ctx, c.Academy, c.Connection)
	if e != nil {
		return e
	}
	key, e := p.open(conn.Academy, conn.ID, conn.Cipher)
	if e != nil {
		return e
	}
	// Webhook fields are only identifiers for an independent authenticated query.
	var out struct {
		Success    bool   `json:"success"`
		Paid       bool   `json:"paid"`
		Amount     int64  `json:"amount"`
		PaidAmount int64  `json:"paid_amount"`
		Method     string `json:"capture_method"`
	}
	e = p.request(ctx, "/payment_check", key, map[string]any{"handle": conn.Handle, "order_nsu": c.Reference, "transaction_nsu": event.Transaction, "slug": event.Slug}, &out)
	if e != nil {
		return core.E(503, "payment_check_unavailable", "Não foi possível confirmar o pagamento. Tente novamente mais tarde.")
	}
	if out.Success && !out.Paid && out.Amount == c.Amount {
		if event.Event == "refunded" || event.Event == "canceled" {
			return m.reviewInfinite(ctx, c, "Notificação de estorno ou cancelamento. Confira a situação na InfinitePay; o fechamento local foi preservado.")
		}
		if _, err := p.DB.Exec(ctx, `UPDATE checkout_attempts SET transaction_nsu=$2,slug=$3,last_checked_at=now(),updated_at=now() WHERE id=$1 AND state IN('ready','creating','uncertain')`, c.ID, event.Transaction, event.Slug); err != nil {
			return err
		}
	}
	if !out.Success || !out.Paid {
		return core.E(409, "payment_waiting", "Pagamento ainda não confirmado pela InfinitePay.")
	}
	if out.Amount != c.Amount || out.PaidAmount < c.Amount || (out.Method != "pix" && out.Method != "credit_card") {
		return m.reviewInfinite(ctx, c, "Valor ou meio de pagamento divergente da mensalidade.")
	}
	if event.Event != "" && event.Event != "paid" && event.Event != "settled" {
		return m.reviewInfinite(ctx, c, "Notificação de cancelamento ou estorno. Confira a transação na InfinitePay.")
	}
	var retired bool
	if e = p.DB.QueryRow(ctx, "SELECT retired_at IS NOT NULL FROM checkout_attempts WHERE id=$1", c.ID).Scan(&retired); e != nil {
		return e
	}
	if retired {
		return m.reviewInfinite(ctx, c, "Pagamento recebido em checkout substituído após conferência manual. Confira o valor recebido antes de registrar a baixa; a mensalidade atual foi preservada.")
	}
	tx, e := p.DB.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	var amount int64
	var status, method string
	e = tx.QueryRow(ctx, "SELECT amount_cents,status,payment_method FROM invoices WHERE academy_id=$1 AND id=$2 FOR UPDATE", c.Academy, c.Invoice).Scan(&amount, &status, &method)
	if e != nil {
		return e
	}
	var oldTransaction, oldConnection string
	e = tx.QueryRow(ctx, `SELECT transaction_nsu,connection_id FROM checkout_receipts WHERE academy_id=$1 AND invoice_id=$2`, c.Academy, c.Invoice).Scan(&oldTransaction, &oldConnection)
	if e != nil && !errors.Is(e, pgx.ErrNoRows) {
		return e
	}
	receiptExists := e == nil
	if amount != c.Amount || status == "cancelled" || (status == "paid" && (!receiptExists || oldTransaction != event.Transaction || oldConnection != c.Connection)) {
		tx.Rollback(ctx)
		return m.reviewInfinite(ctx, c, "Pagamento após outro fechamento ou com valor alterado. Confira o recebimento.")
	}
	var receiptInvoice string
	e = tx.QueryRow(ctx, "SELECT invoice_id FROM checkout_receipts WHERE connection_id=$1 AND transaction_nsu=$2", c.Connection, event.Transaction).Scan(&receiptInvoice)
	if e != nil && !errors.Is(e, pgx.ErrNoRows) {
		return e
	}
	if e == nil && receiptInvoice != c.Invoice {
		tx.Rollback(ctx)
		return m.reviewInfinite(ctx, c, "Transação já vinculada a outra mensalidade.")
	}
	if _, e = tx.Exec(ctx, `INSERT INTO checkout_receipts(connection_id,transaction_nsu,academy_id,attempt_id,invoice_id,amount_cents,capture_method) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`, c.Connection, event.Transaction, c.Academy, c.ID, c.Invoice, c.Amount, out.Method); e != nil {
		return e
	}
	method = "infinitepay_pix"
	if out.Method == "credit_card" {
		method = "infinitepay_card"
	}
	if _, e = tx.Exec(ctx, `UPDATE invoices SET status='paid',payment_method=$3,paid_at=COALESCE(paid_at,now()) WHERE academy_id=$1 AND id=$2`, c.Academy, c.Invoice, method); e != nil {
		return e
	}
	if _, e = tx.Exec(ctx, `UPDATE checkout_attempts SET state='paid',transaction_nsu=$2,slug=$3,review_reason='',last_checked_at=now(),updated_at=now() WHERE id=$1`, c.ID, event.Transaction, event.Slug); e != nil {
		return e
	}
	if _, e = tx.Exec(ctx, `UPDATE payment_connections SET validated_at=COALESCE(validated_at,now()) WHERE id=$1`, c.Connection); e != nil {
		return e
	}
	return tx.Commit(ctx)
}
func (m *Manager) reviewInfinite(ctx context.Context, c checkoutAttempt, reason string) error {
	_, e := m.Repo.DB.Exec(ctx, `UPDATE checkout_attempts SET state='review',review_reason=$2,last_checked_at=now(),updated_at=now() WHERE id=$1`, c.ID, reason)
	if e != nil {
		return e
	}
	return core.E(409, "payment_review", reason)
}
func (m *Manager) processInfiniteInbox(ctx context.Context) error {
	p := m.Infinite
	if p == nil || !p.Enabled {
		return nil
	}
	for n := 0; n < 30; n++ {
		var id, connection string
		var raw []byte
		var tries int
		e := p.DB.QueryRow(ctx, `UPDATE checkout_inbox SET state='processing',lease_until=now()+interval '60 seconds',tries=tries+1 WHERE id=(SELECT id FROM checkout_inbox WHERE (state='pending' AND next_attempt_at<=now()) OR (state='processing' AND lease_until<now()) ORDER BY next_attempt_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING id,connection_id,payload,tries`).Scan(&id, &connection, &raw, &tries)
		if errors.Is(e, pgx.ErrNoRows) {
			return nil
		}
		if e != nil {
			return e
		}
		var event InfiniteEvent
		e = json.Unmarshal(raw, &event)
		var c checkoutAttempt
		if e == nil {
			c, e = scanAttempt(p.DB.QueryRow(ctx, "SELECT "+attemptColumns+" FROM checkout_attempts WHERE connection_id=$1 AND reference=$2", connection, event.Order))
		}
		var release func()
		if e == nil {
			release, e = m.lockOperation(ctx, c.Academy, c.Invoice)
		}
		if e == nil {
			func() { defer release(); e = m.checkInfinite(ctx, c, event) }()
		}
		state := "done"
		if e != nil {
			state = "pending"
			var ce *core.Error
			if errors.As(e, &ce) && ce.Code == "payment_review" {
				state = "review"
			}
			if tries >= 20 {
				state = "review"
			}
		}
		if state == "review" && c.ID != "" {
			var ce *core.Error
			if !errors.As(e, &ce) || ce.Code != "payment_review" {
				_, err := p.DB.Exec(ctx, `UPDATE checkout_attempts SET state='review',review_reason='Não foi possível confirmar a transação após as tentativas automáticas. Confira na InfinitePay.',updated_at=now() WHERE id=$1 AND state<>'paid'`, c.ID)
				if err != nil {
					return err
				}
			}
		}
		_, saveErr := p.DB.Exec(ctx, `UPDATE checkout_inbox SET state=$2,next_attempt_at=now()+interval '1 minute',lease_until=NULL WHERE id=$1`, id, state)
		if saveErr != nil {
			return saveErr
		}
	}
	return nil
}
func (m *Manager) reconcileInfinite(ctx context.Context) error {
	p := m.Infinite
	if p == nil || !p.Enabled {
		return nil
	}
	if e := m.processInfiniteInbox(ctx); e != nil {
		return e
	}
	rows, e := p.DB.Query(ctx, "SELECT "+attemptColumns+" FROM checkout_attempts WHERE transaction_nsu<>'' AND slug<>'' AND state IN('ready','uncertain') AND (last_checked_at IS NULL OR last_checked_at<now()-interval '1 minute') ORDER BY updated_at LIMIT 30")
	if e != nil {
		return e
	}
	list := []checkoutAttempt{}
	for rows.Next() {
		c, err := scanAttempt(rows)
		if err != nil {
			rows.Close()
			return err
		}
		list = append(list, c)
	}
	e = rows.Err()
	rows.Close()
	if e != nil {
		return e
	}
	for _, c := range list {
		release, err := m.lockOperation(ctx, c.Academy, c.Invoice)
		if err != nil {
			continue
		}
		_ = m.checkInfinite(ctx, c, InfiniteEvent{Order: c.Reference, Transaction: c.Transaction, Slug: c.Slug})
		release()
	}
	return nil
}
