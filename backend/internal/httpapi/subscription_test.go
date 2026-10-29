package httpapi_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"sync/atomic"
	"tatame/backend/internal/core"
	"tatame/backend/internal/database"
	"tatame/backend/internal/httpapi"
	"tatame/backend/internal/payments"
	"tatame/backend/internal/subscriptions"
	"testing"
)

func TestPlatformSubscription(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("Set isolated TEST_DATABASE_URL")
	}
	ctx := context.Background()
	if e := database.Migrate(url); e != nil {
		t.Fatal(e)
	}
	db, e := database.Open(ctx, url)
	if e != nil {
		t.Fatal(e)
	}
	defer db.Close()
	var links atomic.Int32
	var paid atomic.Bool
	var failLink atomic.Bool
	var amount atomic.Int64
	amount.Store(45000)
	fake := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Api-Key") != "platform-test-key" {
			t.Error("Academy credential used for platform billing")
			http.Error(w, "bad key", 401)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/links":
			links.Add(1)
			var in map[string]any
			if e := json.NewDecoder(r.Body).Decode(&in); e != nil {
				t.Error(e)
			}
			items := in["items"].([]any)
			price := items[0].(map[string]any)["price"].(float64)
			if price != 45000 {
				t.Errorf("price=%v", price)
			}
			options := in["options"].(map[string]any)
			if _, ok := options["discounts"]; ok {
				t.Error("Discount configured")
			}
			if failLink.Load() {
				http.Error(w, "response lost", 500)
				return
			}
			json.NewEncoder(w).Encode(map[string]string{"url": "https://checkout.infinitepay.io/tatamemix/test"})
		case "/payment_check":
			json.NewEncoder(w).Encode(map[string]any{"success": true, "paid": paid.Load(), "amount": amount.Load(), "paid_amount": amount.Load(), "capture_method": "pix"})
		default:
			http.NotFound(w, r)
		}
	}))
	defer fake.Close()
	platform := subscriptions.New(db, subscriptions.Config{Enabled: true, APIKey: "platform-test-key", Handle: "tatamemix", PublicURL: "https://tatamemix.example"})
	platform.Bank.BaseURL = fake.URL
	bank := payments.New(db, nil)
	bank.Subscriptions = platform
	server := httptest.NewServer(httpapi.NewWithPayments(db, "", bank))
	defer server.Close()
	register := func(name string) client {
		c := client{t: t, url: server.URL}
		v := c.ok("POST", "/v1/auth/register", map[string]string{"name": name, "email": core.ID() + "@subscription.test", "password": "Platform-test-42!"})
		c.token = v["token"].(string)
		return c
	}
	owner := register("Gestor assinatura")
	outsider := register("Sem acesso")
	academy := owner.ok("POST", "/v1/academies", map[string]string{"name": "Academia assinatura"})
	a := academy["id"].(string)
	base := "/v1/academies/" + a
	status := owner.ok("GET", base+"/subscription", nil)
	if links.Load() != 0 || status["amount_cents"] != float64(45000) || status["status"] != "grace" {
		t.Fatal(status, links.Load())
	}
	cycle := status["cycle"].(map[string]any)["id"].(string)
	if code, _ := outsider.request("GET", base+"/subscription", nil, ""); code != 403 {
		t.Fatal("foreign status", code)
	}
	if code, _ := outsider.request("POST", base+"/subscription/checkout", map[string]string{"cycle_id": cycle}, ""); code != 403 {
		t.Fatal("foreign checkout", code)
	}
	// A second manager shares the SAME subscription, not a second fee.
	managerEmail := core.ID() + "@manager.test"
	owner.ok("POST", base+"/managers", map[string]string{"name": "Segundo dono", "email": managerEmail, "password": "Platform-other-42!"})
	second := client{t: t, url: server.URL}
	login := second.ok("POST", "/v1/auth/login", map[string]string{"email": managerEmail, "password": "Platform-other-42!"})
	second.token = login["token"].(string)
	shared := second.ok("GET", base+"/subscription", nil)
	if shared["cycle"].(map[string]any)["id"] != cycle {
		t.Fatal("Manager received another subscription")
	}
	if code, _ := owner.request("POST", base+"/subscription/checkout", map[string]any{"cycle_id": cycle, "amount_cents": 1}, ""); code != 400 {
		t.Fatal("client could choose subscription price", code)
	}
	var wg sync.WaitGroup
	for i := 0; i < 3; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			code, _ := owner.request("POST", base+"/subscription/checkout", map[string]string{"cycle_id": cycle}, "")
			if code != 200 {
				t.Errorf("checkout=%d", code)
			}
		}()
	}
	wg.Wait()
	if links.Load() != 1 {
		t.Fatal("duplicate emission", links.Load())
	}
	var ref, attempt string
	if e = db.QueryRow(ctx, "SELECT reference,id FROM platform_subscription_attempts WHERE cycle_id=$1", cycle).Scan(&ref, &attempt); e != nil {
		t.Fatal(e)
	}
	// Not paying restricts writes, but keeps reads and regularization routes available.
	if _, e = db.Exec(ctx, "UPDATE platform_subscriptions SET paid_until=now()-interval '6 days' WHERE academy_id=$1", a); e != nil {
		t.Fatal(e)
	}
	restricted := owner.ok("GET", base+"/subscription", nil)
	if restricted["restricted"] != true {
		t.Fatal(restricted)
	}
	if code, _ := owner.request("POST", base+"/classes", map[string]string{"name": "Bloqueada"}, ""); code != 402 {
		t.Fatal("write allowed", code)
	}
	owner.ok("GET", base+"/classes", nil)
	if code, _ := owner.request("POST", base+"/invoices/"+core.ID()+"/checkout", map[string]any{}, ""); code == 402 {
		t.Fatal("student payment route held hostage")
	}

	event := map[string]string{"order_nsu": ref, "transaction_nsu": core.ID(), "invoice_slug": "fake-slug", "event": "paid"}
	anon := client{t: t, url: server.URL}
	event["future_optional_field"] = "accepted metadata"
	anon.ok("POST", "/v1/webhooks/tatamemix/infinitepay", event)
	delete(event, "future_optional_field")
	anon.ok("POST", "/v1/webhooks/tatamemix/infinitepay", event)
	if e = platform.RunCycle(ctx); e != nil {
		t.Fatal(e)
	}
	var receipts int
	db.QueryRow(ctx, "SELECT count(*) FROM platform_subscription_receipts WHERE attempt_id=$1", attempt).Scan(&receipts)
	if receipts != 0 {
		t.Fatal("fake webhook granted access")
	}
	// Provider confirmation, not callback fields, extends access exactly once.
	paid.Store(true)
	if _, e = db.Exec(ctx, "UPDATE platform_subscription_inbox SET next_attempt_at=now() WHERE attempt_id=$1", attempt); e != nil {
		t.Fatal(e)
	}
	if e = platform.RunCycle(ctx); e != nil {
		t.Fatal(e)
	}
	active := owner.ok("GET", base+"/subscription", nil)
	if active["status"] != "active" || active["restricted"] != false {
		t.Fatal(active)
	}
	until := active["paid_until"]
	callback := map[string]any{"attempt_id": "", "event": event}
	owner.ok("POST", base+"/subscription/payment-check", callback)
	anon.ok("POST", "/v1/webhooks/tatamemix/infinitepay", event)
	if e = platform.RunCycle(ctx); e != nil {
		t.Fatal(e)
	}
	if again := owner.ok("GET", base+"/subscription", nil); again["paid_until"] != until {
		t.Fatal("duplicate extended access twice")
	}
	db.QueryRow(ctx, "SELECT count(*) FROM platform_subscription_receipts WHERE attempt_id=$1", attempt).Scan(&receipts)
	if receipts != 1 {
		t.Fatal(receipts)
	}
	if code, _ := outsider.request("POST", base+"/subscription/payment-check", callback, ""); code != 403 {
		t.Fatal("foreign verification", code)
	}
	// Cancellation preserves paid access. Resume doesn't charge the card.
	cancelled := owner.ok("PATCH", base+"/subscription", map[string]bool{"enabled": false})
	if cancelled["renewal_enabled"] != false || cancelled["status"] != "active" {
		t.Fatal(cancelled)
	}
	owner.ok("PATCH", base+"/subscription", map[string]bool{"enabled": true})
	if links.Load() != 1 {
		t.Fatal("renewal toggle emitted payment")
	}
	// Lost response is never automatically reissued, even after its local expiry.
	a2 := owner.ok("POST", "/v1/academies", map[string]string{"name": "Outra assinatura"})["id"].(string)
	b2 := "/v1/academies/" + a2
	c2 := owner.ok("GET", b2+"/subscription", nil)["cycle"].(map[string]any)["id"].(string)
	failLink.Store(true)
	first := owner.ok("POST", b2+"/subscription/checkout", map[string]string{"cycle_id": c2})
	if first["status"] != "review" {
		t.Fatal(first)
	}
	owner.ok("POST", b2+"/subscription/checkout", map[string]string{"cycle_id": c2})
	if links.Load() != 2 {
		t.Fatal("uncertain result reissued")
	}
	// Bank value divergence cannot grant access.
	var ref2, id2 string
	db.QueryRow(ctx, "SELECT reference,id FROM platform_subscription_attempts WHERE cycle_id=$1", c2).Scan(&ref2, &id2)
	amount.Store(1)
	divergent := owner.ok("POST", b2+"/subscription/payment-check", map[string]any{"attempt_id": id2, "event": map[string]string{"order_nsu": ref2, "transaction_nsu": core.ID(), "slug": "other"}})
	if divergent["status"] != "review" {
		t.Fatal(divergent)
	}
	var n int
	db.QueryRow(ctx, "SELECT count(*) FROM platform_subscription_receipts WHERE attempt_id=$1", id2).Scan(&n)
	if n != 0 {
		t.Fatal("divergent value paid")
	}
	hist := owner.ok("GET", b2+"/subscription/history", nil)
	items := hist["items"].([]any)
	if len(items) == 0 || items[0].(map[string]any)["review_reason"] == "" {
		t.Fatal("Payment review not visible in history", hist)
	}
	// Disabling rollout leaves existing academies unrestricted; no provider call.
	bank.Subscriptions.Config.Enabled = false
	if v := owner.ok("GET", base+"/subscription", nil); v["status"] != "disabled" {
		t.Fatal(v)
	}
	if e = db.QueryRow(ctx, "SELECT count(*) FROM platform_subscription_receipts WHERE attempt_id=$1", attempt).Scan(&n); e != nil || n != 1 {
		t.Fatal(n, e)
	}
}
