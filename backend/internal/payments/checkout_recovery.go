package payments

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"net/http"
	"strings"
	"tatame/backend/internal/core"
	"time"
	"unicode/utf8"
)

type CheckoutRecord struct {
	ID        string     `json:"id"`
	Reference string     `json:"reference"`
	State     string     `json:"state"`
	URL       string     `json:"url,omitempty"`
	Amount    int64      `json:"amount_cents"`
	CreatedAt time.Time  `json:"created_at"`
	RetiredAt *time.Time `json:"retired_at"`
	RetiredBy string     `json:"retired_by,omitempty"`
	Note      string     `json:"retirement_note,omitempty"`
	Reason    string     `json:"review_reason,omitempty"`
}
type RetireCheckoutInput struct {
	Attempt   string `json:"attempt_id"`
	Confirmed bool   `json:"confirmed_invalidated"`
	Note      string `json:"note"`
}

func (m *Manager) checkoutHistory(ctx context.Context, a, id string) ([]CheckoutRecord, error) {
	if _, e := m.Access.Require(ctx, a, "admin"); e != nil {
		return nil, e
	}
	if _, e := m.Authorize(ctx, a, id); e != nil {
		return nil, e
	}
	rows, e := m.Repo.DB.Query(ctx, `SELECT c.id,c.reference,c.state,c.checkout_url,c.amount_cents,c.created_at,c.retired_at,COALESCE(u.name,''),c.retirement_note,c.review_reason FROM checkout_attempts c LEFT JOIN users u ON u.id=c.retired_by WHERE c.academy_id=$1 AND c.invoice_id=$2 ORDER BY c.created_at DESC,c.id DESC LIMIT 50`, a, id)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []CheckoutRecord{}
	for rows.Next() {
		var v CheckoutRecord
		if e = rows.Scan(&v.ID, &v.Reference, &v.State, &v.URL, &v.Amount, &v.CreatedAt, &v.RetiredAt, &v.RetiredBy, &v.Note, &v.Reason); e != nil {
			return nil, e
		}
		if !validCheckoutURL(v.URL) {
			v.URL = ""
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// This is a manager's audited external verification, NOT a provider cancellation API.
func (m *Manager) retireCheckout(ctx context.Context, a, id string, in RetireCheckoutInput) error {
	if _, e := m.Access.Require(ctx, a, "admin"); e != nil {
		return e
	}
	in.Note = strings.TrimSpace(in.Note)
	if !in.Confirmed || !core.ValidID(in.Attempt) || utf8.RuneCountInString(in.Note) < 10 || utf8.RuneCountInString(in.Note) > 500 {
		return core.E(422, "invalid_checkout_resolution", "Confirme a inutilização na InfinitePay e registre a evidência/protocolo (10 a 500 caracteres).")
	}
	release, e := m.lockOperation(ctx, a, id)
	if e != nil {
		return e
	}
	defer release()
	invoice, e := m.Authorize(ctx, a, id)
	if e != nil {
		return e
	}
	if invoice.Status == "paid" || invoice.Status == "cancelled" {
		return core.E(409, "invoice_closed", "Esta mensalidade já foi encerrada.")
	}
	c, e := scanAttempt(m.Repo.DB.QueryRow(ctx, "SELECT "+attemptColumns+" FROM checkout_attempts WHERE academy_id=$1 AND invoice_id=$2 AND id=$3 AND retired_at IS NULL", a, id, in.Attempt))
	if errors.Is(e, pgx.ErrNoRows) {
		return core.E(409, "stale_checkout", "O checkout mudou. Atualize a tela e confira novamente.")
	}
	if e != nil {
		return e
	}
	if c.State == "paid" {
		return core.E(409, "invoice_paid", "Pagamento já confirmado.")
	}
	// A fresh issuance may still be writing its response. Never retire an in-flight HTTP call.
	var created time.Time
	if e = m.Repo.DB.QueryRow(ctx, "SELECT updated_at FROM checkout_attempts WHERE id=$1", c.ID).Scan(&created); e != nil {
		return e
	}
	if c.State == "creating" && time.Since(created) < 2*time.Minute {
		return core.E(409, "checkout_in_progress", "A emissão ainda está em andamento. Aguarde sua conclusão antes de conferir.")
	}
	if c.Transaction != "" && c.Slug != "" {
		if m.Infinite == nil || !m.Infinite.Enabled {
			return bankUnavailable()
		}
		e = m.checkInfinite(ctx, c, InfiniteEvent{Order: c.Reference, Transaction: c.Transaction, Slug: c.Slug})
		if e == nil {
			return core.E(409, "invoice_paid", "A InfinitePay confirmou o pagamento. Atualize a mensalidade.")
		}
		var ce *core.Error
		if !errors.As(e, &ce) || ce.Code != "payment_waiting" {
			return e
		}
	}
	tx, e := m.Repo.DB.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	var active bool
	if e = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM memberships m JOIN membership_roles r ON r.membership_id=m.id WHERE m.academy_id=$1 AND m.user_id=$2 AND m.status='active' AND r.role='admin')`, a, core.P(ctx).UserID).Scan(&active); e != nil {
		return e
	}
	if !active {
		return core.E(403, "forbidden", "Permissão de gestor necessária.")
	}
	var state string
	if e = tx.QueryRow(ctx, "SELECT status FROM invoices WHERE academy_id=$1 AND id=$2 FOR UPDATE", a, id).Scan(&state); e != nil {
		return e
	}
	if state == "paid" || state == "cancelled" {
		return core.E(409, "invoice_closed", "A mensalidade foi encerrada. Atualize a tela.")
	}
	tag, e := tx.Exec(ctx, "UPDATE checkout_attempts SET retired_at=now(),retired_by=$2,retirement_note=$3,updated_at=now() WHERE id=$1 AND retired_at IS NULL AND state<>'paid'", c.ID, core.P(ctx).UserID, in.Note)
	if e != nil {
		return e
	}
	if tag.RowsAffected() != 1 {
		return core.E(409, "stale_checkout", "O checkout mudou durante a conferência.")
	}
	return tx.Commit(ctx)
}
func (h Handler) CheckoutHistory(w http.ResponseWriter, r *http.Request) {
	v, e := h.Manager.checkoutHistory(r.Context(), r.PathValue("academy"), r.PathValue("invoice"))
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) RetireCheckout(w http.ResponseWriter, r *http.Request) {
	var in RetireCheckoutInput
	if e := core.Decode(w, r, &in); e != nil {
		core.Fail(w, e)
		return
	}
	if e := h.Manager.retireCheckout(r.Context(), r.PathValue("academy"), r.PathValue("invoice"), in); e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, map[string]bool{"recorded": true})
}
