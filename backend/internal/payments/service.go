package payments

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"log/slog"
	"net/url"
	"os"
	"strings"
	"tatame/backend/internal/access"
	"tatame/backend/internal/billing"
	"tatame/backend/internal/core"
	"time"
)

type Manager struct {
	Infinite    *InfinitePay
	Repo        Repository
	Access      access.Service
	Connections map[string]Connection
	Clients     map[string]Asaas
}

func New(db *pgxpool.Pool, configs []Connection) *Manager {
	m := &Manager{Repo: Repository{db}, Access: access.Service{DB: db}, Connections: map[string]Connection{}, Clients: map[string]Asaas{}}
	for _, c := range configs {
		m.Connections[c.ID] = c
		m.Clients[c.AcademyID] = Asaas{Connection: c}
	}
	return m
}
func Load(db *pgxpool.Pool, path string) (*Manager, error) {
	if path == "" {
		return New(db, nil), nil
	}
	raw, e := os.ReadFile(path)
	if e != nil {
		return nil, fmt.Errorf("cannot read Asaas configuration")
	}
	var configs []Connection
	if e = json.Unmarshal(raw, &configs); e != nil {
		return nil, fmt.Errorf("invalid Asaas configuration")
	}
	academies, ids := map[string]bool{}, map[string]bool{}
	for _, c := range configs {
		u, e := url.Parse(c.BaseURL)
		if e != nil || u.Scheme != "https" || u.User != nil || u.RawQuery != "" || (u.Host != "api.asaas.com" && u.Host != "api-sandbox.asaas.com") || strings.TrimRight(u.Path, "/") != "/v3" || len(c.APIKey) < 20 || len(c.WebhookToken) < 32 || !core.ValidID(c.AcademyID) || !core.ValidID(c.ID) || academies[c.AcademyID] || ids[c.ID] || (c.Environment != "sandbox" && c.Environment != "production") {
			return nil, fmt.Errorf("invalid Asaas connection; check IDs, environment, API base and credentials")
		}
		if (c.Environment == "production") != (u.Host == "api.asaas.com") {
			return nil, fmt.Errorf("Asaas environment and API base mismatch")
		}
		academies[c.AcademyID] = true
		ids[c.ID] = true
	}
	return New(db, configs), nil
}
func (m *Manager) Authorize(ctx context.Context, a, id string) (billing.Invoice, error) {
	if !core.ValidID(a) || !core.ValidID(id) {
		return billing.Invoice{}, core.E(404, "not_found", "Mensalidade não encontrada.")
	}
	if core.P(ctx).UserID == "" {
		return billing.Invoice{}, core.E(403, "forbidden", "Conta pessoal necessária.")
	}
	invoice, e := (billing.Repository{DB: m.Repo.DB}).Get(ctx, a, id)
	if e != nil {
		return invoice, e
	}
	if _, e = m.Access.Require(ctx, a, "admin"); e == nil {
		return invoice, nil
	}
	var own bool
	e = m.Repo.DB.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM students WHERE academy_id=$1 AND id=$2 AND user_id=$3)", a, invoice.StudentID, core.P(ctx).UserID).Scan(&own)
	if e != nil {
		return invoice, e
	}
	if !own {
		return invoice, core.E(403, "forbidden", "Você não tem acesso a esta mensalidade.")
	}
	return invoice, nil
}

type PixResult struct {
	AmountCents int64      `json:"amount_cents"`
	Status      string     `json:"status"`
	Payload     string     `json:"payload,omitempty"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	Environment string     `json:"environment"`
}

func bankUnavailable() error {
	return core.E(503, "bank_unavailable", "Não foi possível consultar o Pix. Aguarde e tente novamente; nenhum pagamento foi confirmado.")
}
func (m *Manager) Pix(ctx context.Context, a, id string) (PixResult, error) {
	if _, e := m.Authorize(ctx, a, id); e != nil {
		return PixResult{}, e
	}
	release, e := m.lockOperation(ctx, a, id)
	if e != nil {
		return PixResult{}, e
	}
	defer release()
	if e = m.blockInfiniteAdjustment(ctx, a, id); e != nil {
		return PixResult{}, e
	}
	return m.pix(ctx, a, id, true)
}
func (m *Manager) pix(ctx context.Context, a, id string, reissue bool) (PixResult, error) {
	invoice, e := m.Authorize(ctx, a, id)
	if e != nil {
		return PixResult{}, e
	}
	client, ok := m.Clients[a]
	if !ok {
		return PixResult{}, core.E(503, "payments_not_configured", "A academia ainda não habilitou os pagamentos Pix.")
	}
	if invoice.Status == "paid" {
		return PixResult{Status: "paid", Environment: client.Connection.Environment}, nil
	}
	if invoice.Status == "cancelled" {
		return PixResult{}, core.E(409, "invoice_closed", "Esta mensalidade foi cancelada.")
	}
	c, owner, e := m.Repo.Reserve(ctx, a, id)
	if e != nil {
		return PixResult{}, e
	}
	var p Payment
	if c.ProviderID != "" {
		p, e = client.get(ctx, c.ProviderID)
	} else {
		found, err := client.find(ctx, c.Reference)
		e = err
		if e == nil && found != nil {
			p = *found
		}
		if e == nil && found == nil {
			if !owner {
				return PixResult{}, core.E(503, "pix_pending", "A emissão está sendo conferida. Tente novamente em instantes; a cobrança não será duplicada.")
			}
			customer, err := client.customer(ctx, invoice.PayerName, invoice.PayerDocument, "tatame-payer:"+a+":"+invoice.PayerDocument)
			if err != nil {
				_ = m.Repo.State(ctx, c.ID, "new")
				return PixResult{}, bankUnavailable()
			}
			p, e = client.create(ctx, invoice, customer, c.Reference)
			if e != nil {
				state := "uncertain"
				if certainRejection(e) {
					state = "new"
				}
				_ = m.Repo.State(ctx, c.ID, state)
				return PixResult{}, bankUnavailable()
			}
		}
	}
	if e != nil {
		if owner {
			_ = m.Repo.State(ctx, c.ID, "new")
		}
		return PixResult{}, bankUnavailable()
	}
	if e = m.Repo.Apply(ctx, c, p); e != nil {
		return PixResult{}, e
	}
	if p.Status == "RECEIVED" || p.Status == "CONFIRMED" {
		return PixResult{Status: "paid", Environment: client.Connection.Environment}, nil
	}
	if strings.Contains(p.Status, "REFUND") || p.Deleted {
		return PixResult{}, core.E(409, "invoice_closed", "Esta cobrança foi cancelada ou estornada.")
	}
	if c.ExpiresAt != nil && time.Now().After(*c.ExpiresAt) {
		if e = client.remove(ctx, p.ID); e != nil {
			return PixResult{}, bankUnavailable()
		}
		if e = m.Repo.State(ctx, c.ID, "retired"); e != nil {
			return PixResult{}, e
		}
		if !reissue {
			return PixResult{}, core.E(409, "pix_expired", "O provedor retornou um Pix expirado. A academia precisa conferir a cobrança.")
		}
		return m.pix(ctx, a, id, false)
	}
	q, e := client.qr(ctx, p.ID)
	if e != nil {
		return PixResult{}, bankUnavailable()
	}
	at, e := expiry(q.ExpirationDate)
	if e != nil {
		return PixResult{}, bankUnavailable()
	}
	if !at.After(time.Now()) {
		if e = m.Repo.Ready(ctx, c, p, q, at); e != nil {
			return PixResult{}, e
		}
		return PixResult{}, core.E(409, "pix_expired", "O Pix anterior expirou. Tente novamente para reemitir a cobrança.")
	}
	if e = m.Repo.Ready(ctx, c, p, q, at); e != nil {
		return PixResult{}, e
	}
	return PixResult{Status: "waiting", AmountCents: invoice.AmountCents, Payload: q.Payload, ExpiresAt: &at, Environment: client.Connection.Environment}, nil
}
func (m *Manager) Cancel(ctx context.Context, a, id string) error {
	if _, e := m.Access.Require(ctx, a, "admin"); e != nil {
		return e
	}
	release, err := m.lockOperation(ctx, a, id)
	if err != nil {
		return err
	}
	defer release()
	invoice, e := m.Authorize(ctx, a, id)
	if e != nil {
		return e
	}
	if invoice.Status == "paid" {
		return core.E(409, "invoice_paid", "Uma mensalidade paga não pode ser cancelada aqui.")
	}
	if e = m.blockInfiniteAdjustment(ctx, a, id); e != nil {
		return e
	}
	rows, e := m.Repo.DB.Query(ctx, "SELECT "+chargeColumns+" FROM pix_charges WHERE academy_id=$1 AND invoice_id=$2 AND state<>'retired'", a, id)
	if e != nil {
		return e
	}
	all := []Charge{}
	for rows.Next() {
		c, err := scanCharge(rows)
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
		client, ok := m.Clients[a]
		if !ok {
			return bankUnavailable()
		}
		var p Payment
		if c.ProviderID != "" {
			p, e = client.get(ctx, c.ProviderID)
		} else {
			found, err := client.find(ctx, c.Reference)
			e = err
			if found != nil {
				p = *found
			}
			if found == nil && c.State != "new" {
				return core.E(409, "pix_pending", "Aguarde a conferência da emissão antes de cancelar.")
			}
		}
		if e != nil {
			return bankUnavailable()
		}
		if p.ID != "" {
			if e = m.Repo.Apply(ctx, c, p); e != nil {
				return e
			}
			if p.Status == "RECEIVED" || p.Status == "CONFIRMED" {
				return core.E(409, "invoice_paid", "Pagamento já confirmado.")
			}
			if !p.Deleted {
				if e = client.remove(ctx, p.ID); e != nil {
					return bankUnavailable()
				}
			}
		}
	}
	_, e = m.Repo.DB.Exec(ctx, "UPDATE invoices SET status='cancelled' WHERE academy_id=$1 AND id=$2 AND status='open'", a, id)
	return e
}
func (m *Manager) Reconcile(ctx context.Context) error {
	if e := m.reconcileInfinite(ctx); e != nil {
		return e
	}
	for a, client := range m.Clients {
		charges, e := m.Repo.Pending(ctx, a)
		if e != nil {
			return e
		}
		for _, c := range charges {
			release, err := m.lockOperation(ctx, a, c.InvoiceID)
			if err != nil {
				continue
			}
			current, err := scanCharge(m.Repo.DB.QueryRow(ctx, "SELECT "+chargeColumns+" FROM pix_charges WHERE academy_id=$1 AND id=$2", a, c.ID))
			if err != nil || current.State == "retired" {
				release()
				continue
			}
			c = current
			var p Payment
			if c.ProviderID != "" {
				p, e = client.get(ctx, c.ProviderID)
			} else {
				found, err := client.find(ctx, c.Reference)
				e = err
				if found != nil {
					p = *found
				}
			}
			if e == nil && p.ID != "" {
				e = m.Repo.Apply(ctx, c, p)
			}
			_, _ = m.Repo.DB.Exec(ctx, "UPDATE pix_charges SET updated_at=now() WHERE id=$1", c.ID)
			release()
			if e != nil {
				slog.Warn("payment reconciliation deferred", "charge_id", c.ID)
			}
		}
	}
	return nil
}
func (m *Manager) Run(ctx context.Context) {
	cycle := func() {
		if e := (billing.Repository{DB: m.Repo.DB}).Generate(ctx); e != nil && ctx.Err() == nil {
			slog.Error("billing generation failed", "error", e)
		}
		if e := m.Reconcile(ctx); e != nil && ctx.Err() == nil {
			slog.Error("payment reconciliation failed", "error", e)
		}
	}
	cycle()
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			cycle()
		}
	}
}
