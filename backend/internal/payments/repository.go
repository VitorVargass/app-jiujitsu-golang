package payments

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"tatame/backend/internal/billing"
	"tatame/backend/internal/core"
	"time"
)

type Repository struct{ DB *pgxpool.Pool }
type Charge struct {
	ID, AcademyID, InvoiceID, Reference, ProviderID, CustomerID, State, ProviderStatus, Payload string
	AmountCents                                                                                 int64
	ExpiresAt                                                                                   *time.Time
}

const chargeColumns = "id,academy_id,invoice_id,reference,COALESCE(provider_id,''),COALESCE(customer_id,''),state,provider_status,payload,expires_at,amount_cents"

func scanCharge(row pgx.Row) (Charge, error) {
	var c Charge
	e := row.Scan(&c.ID, &c.AcademyID, &c.InvoiceID, &c.Reference, &c.ProviderID, &c.CustomerID, &c.State, &c.ProviderStatus, &c.Payload, &c.ExpiresAt, &c.AmountCents)
	return c, e
}
func (r Repository) Reserve(ctx context.Context, a, id string) (Charge, bool, error) {
	tx, e := r.DB.Begin(ctx)
	if e != nil {
		return Charge{}, false, e
	}
	defer tx.Rollback(ctx)
	var status string
	e = tx.QueryRow(ctx, "SELECT status FROM invoices WHERE academy_id=$1 AND id=$2 FOR UPDATE", a, id).Scan(&status)
	if e != nil {
		return Charge{}, false, e
	}
	if status != "open" {
		return Charge{}, false, core.E(409, "invoice_closed", "Esta mensalidade já foi paga ou cancelada.")
	}
	c, e := scanCharge(tx.QueryRow(ctx, "SELECT "+chargeColumns+" FROM pix_charges WHERE academy_id=$1 AND invoice_id=$2 AND state<>'retired'", a, id))
	if errors.Is(e, pgx.ErrNoRows) {
		c = Charge{ID: core.ID(), AcademyID: a, InvoiceID: id, Reference: core.Token(), State: "new"}
		_, e = tx.Exec(ctx, "INSERT INTO pix_charges(id,academy_id,invoice_id,reference,amount_cents) SELECT $1,$2,$3,$4,amount_cents FROM invoices WHERE academy_id=$2 AND id=$3", c.ID, a, id, c.Reference)
	}
	if e != nil {
		return c, false, e
	}
	owner := c.State == "new"
	if owner {
		_, e = tx.Exec(ctx, "UPDATE pix_charges SET state='creating',updated_at=now() WHERE id=$1", c.ID)
		c.State = "creating"
		e = tx.QueryRow(ctx, "SELECT amount_cents FROM invoices WHERE academy_id=$1 AND id=$2", a, id).Scan(&c.AmountCents)
	}
	if e != nil {
		return c, false, e
	}
	return c, owner, tx.Commit(ctx)
}
func (r Repository) State(ctx context.Context, id, state string) error {
	_, e := r.DB.Exec(ctx, "UPDATE pix_charges SET state=$2,updated_at=now() WHERE id=$1", id, state)
	return e
}
func (r Repository) Ready(ctx context.Context, c Charge, p Payment, q QR, at time.Time) error {
	_, e := r.DB.Exec(ctx, "UPDATE pix_charges SET provider_id=$2,customer_id=$3,provider_status=$4,payload=$5,expires_at=$6,state='ready',updated_at=now() WHERE id=$1", c.ID, p.ID, p.Customer, p.Status, q.Payload, at)
	return e
}
func (r Repository) Apply(ctx context.Context, c Charge, p Payment) error {
	amount, e := billing.Cents(p.Value.String())
	if e != nil {
		return e
	}
	tx, e := r.DB.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	var invoiceAmount int64
	var invoiceStatus, method, state string
	e = tx.QueryRow(ctx, "SELECT amount_cents,status,payment_method FROM invoices WHERE academy_id=$1 AND id=$2 FOR UPDATE", c.AcademyID, c.InvoiceID).Scan(&invoiceAmount, &invoiceStatus, &method)
	if e != nil {
		return e
	}
	if p.ExternalReference != c.Reference || p.BillingType != "PIX" || amount != c.AmountCents || p.ID == "" || (c.ProviderID != "" && c.ProviderID != p.ID) {
		return core.E(409, "payment_mismatch", "Pagamento divergente; a academia deve conferir a cobrança.")
	}
	e = tx.QueryRow(ctx, "SELECT state FROM pix_charges WHERE academy_id=$1 AND id=$2", c.AcademyID, c.ID).Scan(&state)
	if e != nil {
		return e
	}
	settled := p.Status == "RECEIVED" || p.Status == "CONFIRMED"
	if state == "retired" {
		if settled {
			return core.E(409, "payment_review", "Pagamento recebido em um Pix substituído. A academia deve conferir o recebimento no Asaas.")
		}
		return nil
	}
	if settled && (invoiceAmount != amount || invoiceStatus == "cancelled" || (invoiceStatus == "paid" && method != "" && method != "asaas_pix")) {
		return core.E(409, "payment_review", "Pagamento divergente do fechamento desta mensalidade. A academia deve conferir o recebimento.")
	}
	_, e = tx.Exec(ctx, "UPDATE pix_charges SET provider_id=$2,customer_id=$3,provider_status=$4,updated_at=now() WHERE id=$1", c.ID, p.ID, p.Customer, p.Status)
	if e != nil {
		return e
	}
	if p.Status == "RECEIVED" || p.Status == "CONFIRMED" {
		at := time.Now()
		if parsed, err := time.ParseInLocation("2006-01-02", p.PaymentDate, saoPaulo()); err == nil {
			at = parsed
		}
		_, e = tx.Exec(ctx, `INSERT INTO payment_receipts(academy_id,provider_id,invoice_id,amount_cents,paid_at,status) VALUES($1,$2,$3,$4,$5,'received')
  ON CONFLICT(academy_id,provider_id) DO UPDATE SET status='received'`, c.AcademyID, p.ID, c.InvoiceID, amount, at)
		if e == nil {
			_, e = tx.Exec(ctx, "UPDATE invoices SET status='paid',payment_method='asaas_pix',paid_at=COALESCE(paid_at,$3) WHERE academy_id=$1 AND id=$2", c.AcademyID, c.InvoiceID, at)
		}
	} else if p.Status == "REFUNDED" {
		_, e = tx.Exec(ctx, "UPDATE payment_receipts SET status='refunded' WHERE academy_id=$1 AND provider_id=$2", c.AcademyID, p.ID)
		if e == nil {
			_, e = tx.Exec(ctx, "UPDATE invoices SET status='cancelled',paid_at=NULL WHERE academy_id=$1 AND id=$2", c.AcademyID, c.InvoiceID)
		}
	}
	if e != nil {
		return e
	}
	return tx.Commit(ctx)
}
func (r Repository) Pending(ctx context.Context, a string) ([]Charge, error) {
	rows, e := r.DB.Query(ctx, "SELECT "+chargeColumns+" FROM pix_charges WHERE academy_id=$1 AND state<>'retired' ORDER BY updated_at LIMIT 100", a)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []Charge{}
	for rows.Next() {
		c, e := scanCharge(rows)
		if e != nil {
			return nil, e
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
func (r Repository) Find(ctx context.Context, a, provider, ref string) (Charge, error) {
	return scanCharge(r.DB.QueryRow(ctx, "SELECT "+chargeColumns+" FROM pix_charges WHERE academy_id=$1 AND ((provider_id=$2 AND $2<>'') OR (reference=$3 AND $3<>'')) ORDER BY created_at DESC LIMIT 1", a, provider, ref))
}
