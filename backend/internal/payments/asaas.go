package payments

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"tatame/backend/internal/billing"
	"time"
)

type Connection struct {
	ID           string `json:"id"`
	AcademyID    string `json:"academy_id"`
	Environment  string `json:"environment"`
	BaseURL      string `json:"base_url"`
	APIKey       string `json:"api_key"`
	WebhookToken string `json:"webhook_token"`
}
type Asaas struct {
	Connection Connection
	HTTP       *http.Client
}
type ProviderError struct{ Status int }

func (e *ProviderError) Error() string { return fmt.Sprintf("Asaas HTTP %d", e.Status) }

type Payment struct {
	ID                string      `json:"id"`
	Customer          string      `json:"customer"`
	ExternalReference string      `json:"externalReference"`
	Status            string      `json:"status"`
	BillingType       string      `json:"billingType"`
	Value             json.Number `json:"value"`
	PaymentDate       string      `json:"paymentDate"`
	Deleted           bool        `json:"deleted"`
}
type QR struct {
	Payload        string `json:"payload"`
	ExpirationDate string `json:"expirationDate"`
}

func (c Asaas) request(ctx context.Context, method, path string, in, out any) error {
	var body io.Reader
	if in != nil {
		b, e := json.Marshal(in)
		if e != nil {
			return e
		}
		body = bytes.NewReader(b)
	}
	req, e := http.NewRequestWithContext(ctx, method, strings.TrimRight(c.Connection.BaseURL, "/")+path, body)
	if e != nil {
		return e
	}
	req.Header.Set("access_token", c.Connection.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Tatame/2.0")
	client := c.HTTP
	if client == nil {
		client = &http.Client{Timeout: 8 * time.Second}
	}
	res, e := client.Do(req)
	if e != nil {
		return fmt.Errorf("Asaas connection unavailable: %w", e)
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode > 299 {
		return &ProviderError{res.StatusCode}
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(io.LimitReader(res.Body, 2<<20)).Decode(out)
}
func (c Asaas) find(ctx context.Context, ref string) (*Payment, error) {
	var list struct {
		Data []Payment `json:"data"`
	}
	e := c.request(ctx, "GET", "/payments?externalReference="+url.QueryEscape(ref), nil, &list)
	if e != nil {
		return nil, e
	}
	if len(list.Data) > 1 {
		return nil, fmt.Errorf("multiple provider charges for reference")
	}
	if len(list.Data) == 0 {
		return nil, nil
	}
	return &list.Data[0], nil
}
func (c Asaas) customer(ctx context.Context, name, document, ref string) (string, error) {
	var list struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	e := c.request(ctx, "GET", "/customers?externalReference="+url.QueryEscape(ref), nil, &list)
	if e != nil {
		return "", e
	}
	if len(list.Data) > 0 {
		return list.Data[0].ID, nil
	}
	var out struct {
		ID string `json:"id"`
	}
	e = c.request(ctx, "POST", "/customers", map[string]any{"name": name, "cpfCnpj": document, "externalReference": ref, "notificationDisabled": true}, &out)
	if e == nil && out.ID == "" {
		e = fmt.Errorf("provider returned no customer ID")
	}
	return out.ID, e
}
func (c Asaas) create(ctx context.Context, invoice billing.Invoice, customer, ref string) (Payment, error) {
	due := invoice.DueDate
	if due < time.Now().In(saoPaulo()).Format("2006-01-02") {
		due = time.Now().In(saoPaulo()).Format("2006-01-02")
	}
	var out Payment
	e := c.request(ctx, "POST", "/payments", map[string]any{"customer": customer, "billingType": "PIX", "value": json.Number(billing.Decimal(invoice.AmountCents)), "dueDate": due, "externalReference": ref, "description": "Mensalidade Tatame " + invoice.Competence}, &out)
	if e == nil && out.ID == "" {
		e = fmt.Errorf("provider returned no payment ID")
	}
	return out, e
}
func (c Asaas) get(ctx context.Context, id string) (Payment, error) {
	var p Payment
	e := c.request(ctx, "GET", "/payments/"+url.PathEscape(id), nil, &p)
	return p, e
}
func (c Asaas) qr(ctx context.Context, id string) (QR, error) {
	var q QR
	e := c.request(ctx, "GET", "/payments/"+url.PathEscape(id)+"/pixQrCode", nil, &q)
	if e == nil && len(q.Payload) < 10 {
		e = fmt.Errorf("provider returned invalid Pix payload")
	}
	return q, e
}
func (c Asaas) remove(ctx context.Context, id string) error {
	return c.request(ctx, "DELETE", "/payments/"+url.PathEscape(id), nil, nil)
}
func certainRejection(e error) bool {
	var pe *ProviderError
	return errors.As(e, &pe) && pe.Status >= 400 && pe.Status < 500 && pe.Status != 408 && pe.Status != 429
}
func saoPaulo() *time.Location {
	loc, e := time.LoadLocation("America/Sao_Paulo")
	if e != nil {
		return time.UTC
	}
	return loc
}
func expiry(s string) (time.Time, error) {
	for _, f := range []string{time.RFC3339, "2006-01-02 15:04:05", "2006-01-02"} {
		if t, e := time.ParseInLocation(f, s, saoPaulo()); e == nil {
			if f == "2006-01-02" {
				t = t.AddDate(0, 0, 1).Add(-time.Nanosecond)
			}
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("invalid Pix expiry")
}
