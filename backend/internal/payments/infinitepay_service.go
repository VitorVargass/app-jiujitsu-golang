package payments

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"regexp"
	"strings"
	"tatame/backend/internal/core"
	"time"
)

type IntegrationStatus struct {
	Provider    string     `json:"provider"`
	Connected   bool       `json:"connected"`
	Enabled     bool       `json:"enabled"`
	Available   bool       `json:"available"`
	Handle      string     `json:"handle"`
	ValidatedAt *time.Time `json:"validated_at"`
}
type infiniteConnection struct {
	ID, Academy, Handle string
	Cipher              []byte
	Enabled             bool
}

func (p *InfinitePay) connection(ctx context.Context, a, id string) (infiniteConnection, error) {
	var c infiniteConnection
	e := p.DB.QueryRow(ctx, `SELECT id,academy_id,handle,encrypted_key,enabled FROM payment_connections WHERE academy_id=$1 AND (($2='' AND current) OR id::text=$2)`, a, id).Scan(&c.ID, &c.Academy, &c.Handle, &c.Cipher, &c.Enabled)
	return c, e
}
func (m *Manager) integration(ctx context.Context, a string) (IntegrationStatus, error) {
	if _, e := m.Access.Require(ctx, a, "admin"); e != nil {
		return IntegrationStatus{}, e
	}
	s := IntegrationStatus{Provider: "infinitepay"}
	p := m.Infinite
	if p == nil {
		return s, nil
	}
	s.Available = len(p.Key) == 32 && p.PublicURL != "" && p.Enabled
	e := p.DB.QueryRow(ctx, `SELECT handle,enabled,validated_at FROM payment_connections WHERE academy_id=$1 AND current`, a).Scan(&s.Handle, &s.Enabled, &s.ValidatedAt)
	if errors.Is(e, pgx.ErrNoRows) {
		return s, nil
	}
	s.Connected = e == nil
	return s, e
}

type IntegrationInput struct {
	Handle string `json:"handle"`
	APIKey string `json:"api_key"`
}

var infiniteHandle = regexp.MustCompile(`^[A-Za-z0-9_.-]{2,100}$`)

func (m *Manager) saveIntegration(ctx context.Context, a string, in IntegrationInput) error {
	if _, e := m.Access.Require(ctx, a, "admin"); e != nil {
		return e
	}
	p := m.Infinite
	if p == nil || len(p.Key) != 32 {
		return core.E(503, "integration_unavailable", "O servidor ainda não habilitou a configuração de recebimentos.")
	}
	in.Handle = strings.TrimPrefix(strings.TrimSpace(in.Handle), "$")
	in.APIKey = strings.TrimSpace(in.APIKey)
	if !infiniteHandle.MatchString(in.Handle) || len(in.APIKey) < 16 || len(in.APIKey) > 1024 || strings.ContainsAny(in.APIKey, "\r\n\x00") {
		return core.E(422, "invalid_integration", "Informe sua InfiniteTag e uma chave de integração válida.")
	}
	id := core.ID()
	cipher, e := p.seal(a, id, in.APIKey)
	if e != nil {
		return e
	}
	tx, e := p.DB.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	// The academy lock serializes saves; recheck admin after acquiring it.
	if e = tx.QueryRow(ctx, "SELECT id FROM academies WHERE id=$1 FOR UPDATE", a).Scan(new(string)); e != nil {
		return e
	}
	var allowed bool
	if e = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM memberships m JOIN membership_roles r ON r.membership_id=m.id WHERE m.academy_id=$1 AND m.user_id=$2 AND m.status='active' AND r.role='admin')`, a, core.P(ctx).UserID).Scan(&allowed); e != nil {
		return e
	}
	if !allowed {
		return core.E(403, "forbidden", "Acesso não autorizado.")
	}
	if _, e = tx.Exec(ctx, "UPDATE payment_connections SET current=false WHERE academy_id=$1 AND current", a); e != nil {
		return e
	}
	if _, e = tx.Exec(ctx, `INSERT INTO payment_connections(id,academy_id,handle,encrypted_key,updated_by) VALUES($1,$2,$3,$4,$5)`, id, a, in.Handle, cipher, core.P(ctx).UserID); e != nil {
		return e
	}
	if _, e = tx.Exec(ctx, `INSERT INTO payment_connection_audit(id,academy_id,connection_id,actor_user_id,action) VALUES($1,$2,$3,$4,'configured')`, core.ID(), a, id, core.P(ctx).UserID); e != nil {
		return e
	}
	return tx.Commit(ctx)
}
func (m *Manager) enableIntegration(ctx context.Context, a string, enabled bool) error {
	if _, e := m.Access.Require(ctx, a, "admin"); e != nil {
		return e
	}
	if m.Infinite == nil {
		return core.E(503, "integration_unavailable", "Integração indisponível.")
	}
	tx, e := m.Repo.DB.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	var id string
	e = tx.QueryRow(ctx, `UPDATE payment_connections SET enabled=$2,updated_by=$3,updated_at=now() WHERE academy_id=$1 AND current AND EXISTS(SELECT 1 FROM memberships m JOIN membership_roles r ON r.membership_id=m.id WHERE m.academy_id=$1 AND m.user_id=$3 AND m.status='active' AND r.role='admin') RETURNING id`, a, enabled, core.P(ctx).UserID).Scan(&id)
	if errors.Is(e, pgx.ErrNoRows) {
		return core.E(404, "not_configured", "Conexão não encontrada ou acesso revogado.")
	}
	if e != nil {
		return e
	}
	action := "suspended"
	if enabled {
		action = "resumed"
	}
	if _, e = tx.Exec(ctx, `INSERT INTO payment_connection_audit(id,academy_id,connection_id,actor_user_id,action) VALUES($1,$2,$3,$4,$5)`, core.ID(), a, id, core.P(ctx).UserID, action); e != nil {
		return e
	}
	return tx.Commit(ctx)
}

type CheckoutResult struct {
	Expired   bool       `json:"expired,omitempty"`
	Retryable bool       `json:"retryable,omitempty"`
	ID        string     `json:"id,omitempty"`
	Status    string     `json:"status"`
	URL       string     `json:"url,omitempty"`
	Amount    int64      `json:"amount_cents"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	Reason    string     `json:"review_reason,omitempty"`
}
type checkoutAttempt struct {
	ID, Academy, Invoice, Connection, Reference, State, URL, Transaction, Slug, Reason string
	Amount                                                                             int64
	Expires                                                                            time.Time
}

const attemptColumns = `id,academy_id,invoice_id,connection_id,reference,state,checkout_url,transaction_nsu,slug,review_reason,amount_cents,expires_at`

func scanAttempt(row pgx.Row) (checkoutAttempt, error) {
	var c checkoutAttempt
	e := row.Scan(&c.ID, &c.Academy, &c.Invoice, &c.Connection, &c.Reference, &c.State, &c.URL, &c.Transaction, &c.Slug, &c.Reason, &c.Amount, &c.Expires)
	return c, e
}
func (p *InfinitePay) attempt(ctx context.Context, a, id string) (checkoutAttempt, error) {
	return scanAttempt(p.DB.QueryRow(ctx, "SELECT "+attemptColumns+" FROM checkout_attempts WHERE academy_id=$1 AND invoice_id=$2 AND retired_at IS NULL", a, id))
}
func (c checkoutAttempt) result() CheckoutResult {
	v := CheckoutResult{ID: c.ID, Status: "waiting", URL: c.URL, Amount: c.Amount, ExpiresAt: &c.Expires, Reason: c.Reason}
	if !validCheckoutURL(v.URL) {
		v.URL = ""
	}
	if c.State == "paid" {
		v.Status = "paid"
		v.URL = ""
		return v
	}
	v.Expired = !time.Now().Before(c.Expires)
	if c.State != "ready" || v.Expired {
		v.Status = "review"
		if v.Reason == "" {
			if v.Expired && v.URL != "" {
				v.Reason = "O prazo previsto deste link terminou. O link original continua disponível para consulta; a InfinitePay informa se ainda aceita pagamento. Não emitimos outro automaticamente."
			} else {
				v.Reason = "Confira o checkout antes de emitir outro link. Se o link foi recebido, você pode abri-lo ou copiá-lo abaixo."
			}
		}
	}
	if c.State == "rejected" {
		v.Retryable = true
		v.Reason = "A emissão foi recusada. Confira a configuração e tente novamente."
	}
	return v
}
func (m *Manager) checkout(ctx context.Context, a, id string) (CheckoutResult, error) {
	invoice, e := m.Authorize(ctx, a, id)
	if e != nil {
		return CheckoutResult{}, e
	}
	if invoice.Status == "paid" {
		return CheckoutResult{Status: "paid", Amount: invoice.AmountCents}, nil
	}
	if invoice.Status == "cancelled" {
		return CheckoutResult{}, core.E(409, "invoice_closed", "Mensalidade cancelada.")
	}
	p := m.Infinite
	if p == nil || !p.Enabled || len(p.Key) != 32 || p.PublicURL == "" {
		return CheckoutResult{}, core.E(503, "payments_disabled", "Pagamentos online ainda não estão habilitados.")
	}
	ctx, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()
	release, e := m.lockOperation(ctx, a, id)
	if e != nil {
		return CheckoutResult{}, e
	}
	defer release()
	invoice, e = m.Authorize(ctx, a, id)
	if e != nil {
		return CheckoutResult{}, e
	}
	if invoice.Status == "paid" {
		return CheckoutResult{Status: "paid", Amount: invoice.AmountCents}, nil
	}
	if invoice.Status == "cancelled" {
		return CheckoutResult{}, core.E(409, "invoice_closed", "Mensalidade cancelada.")
	}
	c, e := p.attempt(ctx, a, id)
	if e == nil && c.State != "rejected" {
		return c.result(), nil
	}
	if e != nil && !errors.Is(e, pgx.ErrNoRows) {
		return CheckoutResult{}, e
	}
	conn, e := p.connection(ctx, a, "")
	if e != nil || !conn.Enabled {
		return CheckoutResult{}, core.E(503, "payments_not_configured", "A academia precisa conectar ou reativar a InfinitePay.")
	}
	// Never allow simultaneous Asaas and InfinitePay payment links for an invoice.
	var legacy bool
	if e = m.Repo.DB.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM pix_charges WHERE academy_id=$1 AND invoice_id=$2 AND state<>'retired')", a, id).Scan(&legacy); e != nil {
		return CheckoutResult{}, e
	}
	if legacy {
		return CheckoutResult{}, core.E(409, "legacy_charge", "Esta mensalidade possui uma cobrança Asaas. Use o Pix original para não duplicar a cobrança.")
	}
	key, e := p.open(a, conn.ID, conn.Cipher)
	if e != nil {
		return CheckoutResult{}, core.E(503, "credential_unavailable", "Não foi possível acessar a chave de integração.")
	}
	// Resolve contact before persisting an emission attempt: a local read failure
	// must not leave a phantom "creating" checkout that was never sent.
	customer, e := p.customerForInvoice(ctx, a, invoice)
	if e != nil {
		return CheckoutResult{}, e
	}
	if c.ID == "" {
		c = checkoutAttempt{ID: core.ID(), Academy: a, Invoice: id, Connection: conn.ID, Reference: core.ID(), Amount: invoice.AmountCents, Expires: time.Now().Add(24 * time.Hour), State: "creating"}
		_, e = p.DB.Exec(ctx, `INSERT INTO checkout_attempts(id,academy_id,invoice_id,connection_id,reference,amount_cents,expires_at,state) VALUES($1,$2,$3,$4,$5,$6,$7,'creating')`, c.ID, a, id, c.Connection, c.Reference, c.Amount, c.Expires)
	} else {
		c.Connection = conn.ID
		c.Amount = invoice.AmountCents
		c.Expires = time.Now().Add(24 * time.Hour)
		c.State = "creating"
		_, e = p.DB.Exec(ctx, `UPDATE checkout_attempts SET state='creating',connection_id=$2,amount_cents=$3,expires_at=$4,updated_at=now() WHERE id=$1`, c.ID, c.Connection, c.Amount, c.Expires)
	}
	if e != nil {
		return CheckoutResult{}, e
	}
	input := map[string]any{"order_nsu": c.Reference, "redirect_url": p.PublicURL + "/pay/" + a + "/" + id, "items": []map[string]any{{"quantity": 1, "price": c.Amount, "description": "Mensalidade TatameMix • " + invoice.Competence}}, "options": map[string]any{"single_payment": true, "valid_until": c.Expires.Format(time.RFC3339), "require_delivery_address": false}, "webhook": map[string]any{"url": p.PublicURL + "/v1/webhooks/infinitepay/" + conn.ID, "events": []string{"paid", "refunded", "canceled"}}}
	if customer != nil {
		input["customer"] = customer
	}
	var out struct {
		URL string `json:"url"`
	}
	e = p.request(ctx, "/links", key, input, &out)
	state := "ready"
	if e != nil || !validCheckoutURL(out.URL) {
		state = "uncertain"
		var pe *InfiniteHTTPError
		if errors.As(e, &pe) && (pe.Status == 400 || pe.Status == 401 || pe.Status == 403 || pe.Status == 422) {
			state = "rejected"
		}
		out.URL = ""
	}
	// Persist even when the request context was canceled: an accepted request must not be reissued.
	persist, done := context.WithTimeout(context.Background(), 5*time.Second)
	defer done()
	_, saveErr := p.DB.Exec(persist, `UPDATE checkout_attempts SET state=$2,checkout_url=$3,updated_at=now() WHERE id=$1 AND state='creating'`, c.ID, state, out.URL)
	if saveErr != nil {
		return CheckoutResult{}, saveErr
	}
	c, e = scanAttempt(p.DB.QueryRow(persist, "SELECT "+attemptColumns+" FROM checkout_attempts WHERE id=$1", c.ID))
	if e != nil {
		return CheckoutResult{}, e
	}
	if state == "rejected" {
		return CheckoutResult{}, core.E(502, "checkout_rejected", "A InfinitePay recusou a emissão. Confira a configuração antes de tentar novamente.")
	}
	return c.result(), nil
}

// There is no documented API to invalidate an outstanding InfinitePay link. Expiry alone is not proof.
func (m *Manager) blockInfiniteAdjustment(ctx context.Context, a, id string) error {
	var blocked bool
	e := m.Repo.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM checkout_attempts WHERE academy_id=$1 AND invoice_id=$2 AND retired_at IS NULL AND state<>'rejected')`, a, id).Scan(&blocked)
	if e != nil {
		return e
	}
	if blocked {
		return core.E(409, "checkout_review_required", "O link de pagamento desta mensalidade já foi emitido e mantém o valor original. Descontos devem ser definidos antes da emissão. Use Pagar ou Copiar link para continuar o pagamento.")
	}
	return nil
}
