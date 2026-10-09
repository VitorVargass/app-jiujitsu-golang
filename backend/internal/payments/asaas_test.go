package payments

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"tatame/backend/internal/billing"
	"testing"
	"time"
)

func TestAsaasHTTPContract(t *testing.T) {
	bank := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("access_token") != "example-key" {
			t.Error("authentication header")
		}
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		if r.Method != "POST" || r.URL.Path != "/payments" || body["billingType"] != "PIX" || body["value"] != 200.51 || body["externalReference"] != "reference" {
			t.Errorf("bad contract %s %s %v", r.Method, r.URL.Path, body)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"pay_1","billingType":"PIX","status":"PENDING","externalReference":"reference","value":200.51}`))
	}))
	defer bank.Close()
	client := Asaas{Connection: Connection{BaseURL: bank.URL, APIKey: "example-key"}, HTTP: bank.Client()}
	p, e := client.create(context.Background(), billing.Invoice{AmountCents: 20051, DueDate: "2020-01-01", Competence: "2026-10"}, "cus_1", "reference")
	if e != nil || p.Value.String() != "200.51" {
		t.Fatal(p, e)
	}
	if _, e = expiry("2030-12-31 23:59:59"); e != nil {
		t.Fatal(e)
	}
	if _, e = expiry("invalid"); e == nil {
		t.Fatal("invalid expiry accepted")
	}
}
func TestProviderTimeoutAndErrors(t *testing.T) {
	bank := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { http.Error(w, "never expose this bank body", 500) }))
	defer bank.Close()
	c := Asaas{Connection: Connection{BaseURL: bank.URL, APIKey: "secret"}, HTTP: &http.Client{Timeout: time.Second}}
	e := c.request(context.Background(), "GET", "/payments/id", nil, &Payment{})
	if e == nil || e.Error() != "Asaas HTTP 500" || certainRejection(e) {
		t.Fatal("error disclosure or retry classification", e)
	}
	if !certainRejection(&ProviderError{Status: 422}) || certainRejection(&ProviderError{Status: 429}) {
		t.Fatal("retry classification")
	}
}
