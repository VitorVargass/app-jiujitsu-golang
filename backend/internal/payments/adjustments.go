package payments

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"strings"
	"tatame/backend/internal/billing"
	"tatame/backend/internal/core"
	"time"
	"unicode/utf8"
)

type DiscountInput struct {
	DiscountCents       int64  `json:"discount_cents"`
	ExpectedAmountCents int64  `json:"expected_amount_cents"`
	Reason              string `json:"reason"`
}
type ManualPaymentInput struct {
	ExpectedAmountCents int64  `json:"expected_amount_cents"`
	Method              string `json:"method"`
	Note                string `json:"note"`
}
type Adjustment struct {
	ID                  string    `json:"id"`
	Kind                string    `json:"kind"`
	ActorName           string    `json:"actor_name"`
	PreviousAmountCents int64     `json:"previous_amount_cents"`
	AmountCents         int64     `json:"amount_cents"`
	DiscountCents       int64     `json:"discount_cents"`
	PaymentMethod       string    `json:"payment_method"`
	Note                string    `json:"note"`
	CreatedAt           time.Time `json:"created_at"`
}

func (m *Manager) Discount(ctx context.Context, a, id string, in DiscountInput) (billing.Invoice, error) {
	in.Reason = strings.TrimSpace(in.Reason)
	if in.DiscountCents < 0 || in.DiscountCents > 100000000 || in.ExpectedAmountCents <= 0 || utf8.RuneCountInString(in.Reason) < 3 || utf8.RuneCountInString(in.Reason) > 300 {
		return billing.Invoice{}, core.E(422, "invalid_discount", "Informe o desconto em reais e um motivo de 3 a 300 caracteres.")
	}
	return m.adjust(ctx, a, id, in.ExpectedAmountCents, &in, nil)
}
func (m *Manager) ManualPayment(ctx context.Context, a, id string, in ManualPaymentInput) (billing.Invoice, error) {
	in.Note = strings.TrimSpace(in.Note)
	switch in.Method {
	case "cash", "pix", "card", "transfer", "other":
	default:
		return billing.Invoice{}, core.E(422, "invalid_payment_method", "Escolha como o pagamento foi recebido.")
	}
	if in.ExpectedAmountCents <= 0 || utf8.RuneCountInString(in.Note) > 500 {
		return billing.Invoice{}, core.E(422, "invalid_payment", "Confira o valor e use uma observação de até 500 caracteres.")
	}
	return m.adjust(ctx, a, id, in.ExpectedAmountCents, nil, &in)
}
func (m *Manager) History(ctx context.Context, a, id string) ([]Adjustment, error) {
	if _, e := m.Access.Require(ctx, a, "admin"); e != nil {
		return nil, e
	}
	if _, e := m.Authorize(ctx, a, id); e != nil {
		return nil, e
	}
	rows, e := m.Repo.DB.Query(ctx, `SELECT * FROM (
 SELECT h.id,h.kind,u.name,h.previous_amount_cents,h.amount_cents,h.discount_cents,h.payment_method,h.note,h.created_at
 FROM invoice_adjustments h JOIN users u ON u.id=h.actor_user_id WHERE h.academy_id=$1 AND h.invoice_id=$2
 UNION ALL
 SELECT r.attempt_id,'bank_payment','InfinitePay',r.amount_cents,r.amount_cents,0::bigint,
 CASE WHEN r.capture_method='pix' THEN 'infinitepay_pix' ELSE 'infinitepay_card' END,
 'Confirmado por consulta bancária',r.confirmed_at FROM checkout_receipts r WHERE r.academy_id=$1 AND r.invoice_id=$2
 ) history ORDER BY created_at DESC,id DESC LIMIT 50`, a, id)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []Adjustment{}
	for rows.Next() {
		var h Adjustment
		if e = rows.Scan(&h.ID, &h.Kind, &h.ActorName, &h.PreviousAmountCents, &h.AmountCents, &h.DiscountCents, &h.PaymentMethod, &h.Note, &h.CreatedAt); e != nil {
			return nil, e
		}
		out = append(out, h)
	}
	return out, rows.Err()
}
func (m *Manager) adjust(ctx context.Context, a, id string, expected int64, discount *DiscountInput, manual *ManualPaymentInput) (billing.Invoice, error) {
	if _, e := m.Access.Require(ctx, a, "admin"); e != nil {
		return billing.Invoice{}, e
	}
	invoice, e := m.Authorize(ctx, a, id)
	if e != nil {
		return invoice, e
	}
	ctx, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()
	release, e := m.lockOperation(ctx, a, id)
	if e != nil {
		return invoice, e
	}
	defer release()
	invoice, e = m.Authorize(ctx, a, id)
	if e != nil {
		return invoice, e
	}
	if invoice.Status == "paid" {
		if manual != nil && invoice.PaymentMethod == manual.Method && invoice.AmountCents == expected {
			var same bool
			e = m.Repo.DB.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM invoice_adjustments WHERE academy_id=$1 AND invoice_id=$2 AND kind='manual_payment' AND note=$3)", a, id, manual.Note).Scan(&same)
			if e == nil && same {
				return invoice, nil
			}
		}
		return invoice, core.E(409, "invoice_paid", "Esta mensalidade já foi paga. Atualize a tela para conferir.")
	}
	if invoice.Status == "cancelled" {
		return invoice, core.E(409, "invoice_closed", "Esta mensalidade foi cancelada.")
	}
	if discount != nil && invoice.DiscountCents == discount.DiscountCents && invoice.DiscountReason == discount.Reason {
		return invoice, nil
	}
	if invoice.AmountCents != expected {
		return invoice, staleInvoice()
	}
	if discount != nil && discount.DiscountCents >= invoice.OriginalAmountCents {
		return invoice, core.E(422, "invalid_discount", "O desconto deve ser menor que o valor original da mensalidade.")
	}
	// HTTP calls happen outside the short database transaction. The lease also
	// serializes Pix issuance, webhooks and reconciliation for this invoice.
	if e = m.blockInfiniteAdjustment(ctx, a, id); e != nil {
		return invoice, e
	}
	if e = m.retireUnpaidPix(ctx, a, id); e != nil {
		return invoice, e
	}
	tx, e := m.Repo.DB.Begin(ctx)
	if e != nil {
		return invoice, e
	}
	defer tx.Rollback(ctx)
	var allowed bool
	e = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM memberships m JOIN membership_roles r ON r.membership_id=m.id WHERE m.academy_id=$1 AND m.user_id=$2 AND m.status='active' AND r.role='admin')`, a, core.P(ctx).UserID).Scan(&allowed)
	if e != nil {
		return invoice, e
	}
	if !allowed {
		return invoice, core.E(403, "forbidden", "Você não tem permissão para esta operação.")
	}
	var status string
	var amount, currentDiscount int64
	e = tx.QueryRow(ctx, "SELECT status,amount_cents,discount_cents FROM invoices WHERE academy_id=$1 AND id=$2 FOR UPDATE", a, id).Scan(&status, &amount, &currentDiscount)
	if e != nil {
		return invoice, e
	}
	if status != "open" || amount != expected {
		return invoice, staleInvoice()
	}
	kind, note, method := "manual_payment", "", ""
	nextAmount, nextDiscount := amount, currentDiscount
	if discount != nil {
		kind, note = "discount", discount.Reason
		nextDiscount = discount.DiscountCents
		nextAmount = amount + currentDiscount - nextDiscount
		_, e = tx.Exec(ctx, "UPDATE invoices SET amount_cents=$3,discount_cents=$4,discount_reason=$5 WHERE academy_id=$1 AND id=$2", a, id, nextAmount, nextDiscount, note)
	} else {
		method, note = manual.Method, manual.Note
		_, e = tx.Exec(ctx, "UPDATE invoices SET status='paid',paid_at=now(),payment_method=$3 WHERE academy_id=$1 AND id=$2", a, id, method)
	}
	if e != nil {
		return invoice, e
	}
	_, e = tx.Exec(ctx, `INSERT INTO invoice_adjustments(id,academy_id,invoice_id,actor_user_id,kind,previous_amount_cents,amount_cents,discount_cents,payment_method,note)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, core.ID(), a, id, core.P(ctx).UserID, kind, amount, nextAmount, nextDiscount, method, note)
	if e != nil {
		return invoice, e
	}
	if e = tx.Commit(ctx); e != nil {
		return invoice, e
	}
	return (billing.Repository{DB: m.Repo.DB}).Get(ctx, a, id)
}
func staleInvoice() error {
	return core.E(409, "invoice_changed", "A mensalidade mudou. Atualize a tela e confira o valor antes de confirmar.")
}

// A deleted pending Pix must be confirmed at the provider before changing the
// invoice. A lost response leaves local values unchanged; a retry recovers it.
func (m *Manager) retireUnpaidPix(ctx context.Context, a, id string) error {
	c, e := scanCharge(m.Repo.DB.QueryRow(ctx, "SELECT "+chargeColumns+" FROM pix_charges WHERE academy_id=$1 AND invoice_id=$2 AND state<>'retired'", a, id))
	if errors.Is(e, pgx.ErrNoRows) {
		return nil
	}
	if e != nil {
		return e
	}
	client, ok := m.Clients[a]
	if !ok {
		return bankUnavailable()
	}
	var p Payment
	if c.ProviderID != "" {
		p, e = client.get(ctx, c.ProviderID)
	} else {
		var found *Payment
		found, e = client.find(ctx, c.Reference)
		if found != nil {
			p = *found
		}
	}
	if e != nil {
		return bankUnavailable()
	}
	if p.ID == "" {
		if c.State != "new" {
			return core.E(409, "pix_pending", "A emissão do Pix está em conferência. Aguarde antes de alterar a mensalidade.")
		}
		return m.Repo.State(ctx, c.ID, "retired")
	}
	if e = m.Repo.Apply(ctx, c, p); e != nil {
		return e
	}
	if p.Status == "RECEIVED" || p.Status == "CONFIRMED" {
		return core.E(409, "invoice_paid", "O Asaas já confirmou o pagamento. Atualize a mensalidade.")
	}
	if strings.Contains(p.Status, "REFUND") {
		return core.E(409, "invoice_closed", "Confira o estorno desta cobrança antes de alterar a mensalidade.")
	}
	if !p.Deleted {
		// Even a failed DELETE may have reached the provider: always query again.
		removeErr := client.remove(ctx, p.ID)
		p, e = client.get(ctx, p.ID)
		if e != nil {
			return bankUnavailable()
		}
		if e = m.Repo.Apply(ctx, c, p); e != nil {
			return e
		}
		if p.Status == "RECEIVED" || p.Status == "CONFIRMED" {
			return core.E(409, "invoice_paid", "O Asaas já confirmou o pagamento. Atualize a mensalidade.")
		}
		if removeErr != nil && !p.Deleted {
			return bankUnavailable()
		}
		if !p.Deleted {
			return core.E(409, "pix_pending", "Não foi possível encerrar o Pix anterior. Tente novamente.")
		}
	}
	return m.Repo.State(ctx, c.ID, "retired")
}
