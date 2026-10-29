package payments

import (
	"bytes"
	"context"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestInfiniteCredentialEncryption(t *testing.T) {
	p := &InfinitePay{Key: bytes.Repeat([]byte{7}, 32)}
	data, e := p.seal("academy-a", "connection-a", "secret-api-key")
	if e != nil {
		t.Fatal(e)
	}
	if bytes.Contains(data, []byte("secret-api-key")) {
		t.Fatal("plaintext stored")
	}
	value, e := p.open("academy-a", "connection-a", data)
	if e != nil || value != "secret-api-key" {
		t.Fatal("decrypt", e)
	}
	for _, ids := range [][2]string{{"academy-b", "connection-a"}, {"academy-a", "connection-b"}} {
		if _, e = p.open(ids[0], ids[1], data); e == nil {
			t.Fatal("credential transferred between tenants")
		}
	}
	data[len(data)-1] ^= 1
	if _, e = p.open("academy-a", "connection-a", data); e == nil {
		t.Fatal("tampering accepted")
	}
}
func TestInfinitePayConfig(t *testing.T) {
	t.Setenv("INFINITEPAY_ENABLED", "false")
	t.Setenv("PAYMENTS_MASTER_KEY", "")
	t.Setenv("PAYMENTS_PUBLIC_URL", "")
	p, e := LoadInfinitePay(nil)
	if e != nil || p.Enabled {
		t.Fatal(e)
	}
	t.Setenv("INFINITEPAY_ENABLED", "true")
	if _, e = LoadInfinitePay(nil); e == nil {
		t.Fatal("enabled without secrets")
	}
	t.Setenv("PAYMENTS_MASTER_KEY", base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{1}, 32)))
	t.Setenv("PAYMENTS_PUBLIC_URL", "https://tatame.example")
	if _, e = LoadInfinitePay(nil); e != nil {
		t.Fatal(e)
	}
	t.Setenv("PAYMENTS_PUBLIC_URL", "http://localhost")
	if _, e = LoadInfinitePay(nil); e == nil {
		t.Fatal("insecure public origin accepted")
	}
}
func TestInfinitePaySafeHTTP(t *testing.T) {
	bank := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Api-Key") != "fake-secret" {
			t.Error("missing authentication")
		}
		http.Error(w, "fake-secret private-bank-error", 500)
	}))
	defer bank.Close()
	p := &InfinitePay{BaseURL: bank.URL, HTTP: bank.Client()}
	e := p.request(context.Background(), "/links", "fake-secret", map[string]string{}, new(any))
	if e == nil || strings.Contains(e.Error(), "fake-secret") {
		t.Fatal("provider secret leaked", e)
	}
	for _, raw := range []string{"https://evil.example/pay", "https://checkout.infinitepay.io.evil.example/pay", "http://checkout.infinitepay.io/pay", "https://user@checkout.infinitepay.io/pay"} {
		if validCheckoutURL(raw) {
			t.Fatal("unsafe redirect", raw)
		}
	}
	if !validCheckoutURL("https://checkout.infinitepay.io/test") {
		t.Fatal("valid checkout rejected")
	}
}

func TestCheckoutRecoveryResult(t *testing.T) {
	c := checkoutAttempt{ID: "test", State: "ready", URL: "https://checkout.infinitepay.io/original", Amount: 18000, Expires: time.Now().Add(-time.Hour)}
	v := c.result()
	if v.Status != "review" || v.URL != c.URL || !v.Expired {
		t.Fatal(v)
	}
	c.State = "paid"
	if v = c.result(); v.URL != "" || v.Status != "paid" {
		t.Fatal(v)
	}
	c.State = "uncertain"
	c.URL = ""
	if v = c.result(); v.URL != "" || v.Status != "review" {
		t.Fatal(v)
	}
}
