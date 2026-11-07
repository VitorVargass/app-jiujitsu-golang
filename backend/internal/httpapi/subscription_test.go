package httpapi_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"tatame/backend/internal/core"
	"tatame/backend/internal/database"
	"tatame/backend/internal/httpapi"
	"tatame/backend/internal/payments"
	"tatame/backend/internal/subscriptions"
	"testing"
	"time"
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
	amount.Store(15000)
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
			if !strings.HasPrefix(in["redirect_url"].(string), "https://tatamemix.example/subscription?") || in["webhook"].(map[string]any)["url"] != "https://api.tatamemix.example/v1/webhooks/tatamemix/infinitepay" {
				t.Error("subscription must return to portal and deliver webhooks to API")
			}
			items := in["items"].([]any)
			price := items[0].(map[string]any)["price"].(float64)
			if price != 15000 {
				t.Errorf("price=%v", price)
			}
			options := in["options"].(map[string]any)
			expiry, expiryErr := time.Parse(time.RFC3339, options["valid_until"].(string))
			if expiryErr != nil || time.Until(expiry) < 59*time.Minute || time.Until(expiry) > time.Hour {
				t.Error("checkout validity must be one hour", expiry, expiryErr)
			}
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
	platform := subscriptions.New(db, subscriptions.Config{Enabled: true, APIKey: "platform-test-key", Handle: "tatamemix", PublicURL: "https://tatamemix.example", APIURL: "https://api.tatamemix.example"})
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
	if links.Load() != 0 || status["amount_cents"] != float64(15000) || status["status"] != "trial" {
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
	if _, e = db.Exec(ctx, "UPDATE platform_subscriptions SET paid_until=now()-interval '6 days',trial_ends_at=now()-interval '6 days' WHERE academy_id=$1", a); e != nil {
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

	// Recovery preserves references and serializes concurrent requests.
	failLink.Store(false)
	paid.Store(false)
	amount.Store(15000)
	a3 := owner.ok("POST", "/v1/academies", map[string]string{"name": "Expired subscription"})["id"].(string)
	b3 := "/v1/academies/" + a3
	cycle3 := owner.ok("GET", b3+"/subscription", nil)["cycle"].(map[string]any)["id"].(string)
	original := owner.ok("POST", b3+"/subscription/checkout", map[string]string{"cycle_id": cycle3})
	originalID := original["id"].(string)
	var originalRef string
	if e = db.QueryRow(ctx, "SELECT reference FROM platform_subscription_attempts WHERE id=$1", originalID).Scan(&originalRef); e != nil {
		t.Fatal(e)
	}
	if _, e = db.Exec(ctx, "UPDATE platform_subscription_attempts SET expires_at=now()-interval '1 day' WHERE id=$1", originalID); e != nil {
		t.Fatal(e)
	}
	expired3 := owner.ok("GET", b3+"/subscription", nil)["checkout"].(map[string]any)
	if expired3["retryable"] != true || expired3["expired"] != true || expired3["url"] != original["url"] {
		t.Fatal(expired3)
	}
	beforeRecovery := links.Load()
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			code, _ := owner.request("POST", b3+"/subscription/checkout", map[string]string{"cycle_id": cycle3}, "")
			if code != 200 {
				t.Errorf("recovery code=%d", code)
			}
		}()
	}
	wg.Wait()
	if links.Load() != beforeRecovery+1 {
		t.Fatal("duplicate renewal", links.Load(), beforeRecovery)
	}
	replacement := owner.ok("GET", b3+"/subscription", nil)["checkout"].(map[string]any)
	if replacement["id"] == originalID || replacement["status"] != "waiting" {
		t.Fatal(replacement)
	}
	var attempts int
	if e = db.QueryRow(ctx, "SELECT count(*) FROM platform_subscription_attempts WHERE cycle_id=$1", cycle3).Scan(&attempts); e != nil || attempts != 2 {
		t.Fatal("history lost", attempts, e)
	}
	history3 := owner.ok("GET", b3+"/subscription/history", nil)
	if len(history3["items"].([]any)) != 1 {
		t.Fatal("duplicate history periods", history3)
	}
	// Even a pending transaction must not block replacement after expiry.
	replacementID := replacement["id"].(string)
	var replacementRef string
	if e = db.QueryRow(ctx, "SELECT reference FROM platform_subscription_attempts WHERE id=$1", replacementID).Scan(&replacementRef); e != nil {
		t.Fatal(e)
	}
	if _, e = db.Exec(ctx, "UPDATE platform_subscription_attempts SET expires_at=now()-interval '1 day' WHERE id=$1", replacementID); e != nil {
		t.Fatal(e)
	}
	pending := map[string]string{"order_nsu": replacementRef, "transaction_nsu": core.ID(), "invoice_slug": "pending-recovery"}
	anon.ok("POST", "/v1/webhooks/tatamemix/infinitepay", pending)
	beforeRecovery = links.Load()
	if code, _ := owner.request("POST", b3+"/subscription/checkout", map[string]string{"cycle_id": cycle3}, ""); code != 200 {
		t.Fatal("expired pending transaction not replaced", code)
	}
	if links.Load() != beforeRecovery+1 {
		t.Fatal("expired pending transaction did not emit one replacement")
	}
	paid.Store(true)
	settled := owner.ok("POST", b3+"/subscription/payment-check", map[string]any{"attempt_id": replacementID, "event": pending})
	if settled["status"] != "paid" || links.Load() != beforeRecovery+1 {
		t.Fatal("pending payment not settled", settled)
	}
	// A late payment on an archived reference cannot grant a second period.
	until3 := owner.ok("GET", b3+"/subscription", nil)["paid_until"]
	late := owner.ok("POST", b3+"/subscription/payment-check", map[string]any{"attempt_id": originalID, "event": map[string]string{"order_nsu": originalRef, "transaction_nsu": core.ID(), "slug": "late-old"}})
	if late["status"] != "review" {
		t.Fatal("late duplicate accepted", late)
	}
	if owner.ok("GET", b3+"/subscription", nil)["paid_until"] != until3 {
		t.Fatal("late payment extended twice")
	}

	// An old reference settling first closes the period and suppresses its replacement.
	a4 := owner.ok("POST", "/v1/academies", map[string]string{"name": "Late settlement"})["id"].(string)
	b4 := "/v1/academies/" + a4
	cycle4 := owner.ok("GET", b4+"/subscription", nil)["cycle"].(map[string]any)["id"].(string)
	old4 := owner.ok("POST", b4+"/subscription/checkout", map[string]string{"cycle_id": cycle4})
	var ref4 string
	if e = db.QueryRow(ctx, "SELECT reference FROM platform_subscription_attempts WHERE id=$1", old4["id"]).Scan(&ref4); e != nil {
		t.Fatal(e)
	}
	if _, e = db.Exec(ctx, "UPDATE platform_subscription_attempts SET expires_at=now()-interval '1 day' WHERE id=$1", old4["id"]); e != nil {
		t.Fatal(e)
	}
	new4 := owner.ok("POST", b4+"/subscription/checkout", map[string]string{"cycle_id": cycle4})
	late4 := map[string]any{"attempt_id": old4["id"], "event": map[string]string{"order_nsu": ref4, "transaction_nsu": core.ID(), "slug": "late-first"}}
	if v := owner.ok("POST", b4+"/subscription/payment-check", late4); v["status"] != "paid" {
		t.Fatal(v)
	}
	until4 := owner.ok("GET", b4+"/subscription", nil)["paid_until"]
	owner.ok("POST", b4+"/subscription/payment-check", late4)
	if owner.ok("GET", b4+"/subscription", nil)["paid_until"] != until4 {
		t.Fatal("old reference settled twice")
	}
	var replacementState string
	if e = db.QueryRow(ctx, "SELECT state FROM platform_subscription_attempts WHERE id=$1", new4["id"]).Scan(&replacementState); e != nil || replacementState != "review" {
		t.Fatal("replacement still offered", replacementState, e)
	}
	beforeRecovery = links.Load()
	if v := owner.ok("POST", b4+"/subscription/checkout", map[string]string{"cycle_id": cycle4}); v["status"] != "paid" || links.Load() != beforeRecovery {
		t.Fatal("paid cycle issued another link", v)
	}
	// Unknown issuance can also be replaced once its requested validity ends.
	if _, e = db.Exec(ctx, "UPDATE platform_subscription_attempts SET expires_at=now()-interval '1 day' WHERE id=$1", id2); e != nil {
		t.Fatal(e)
	}
	beforeRecovery = links.Load()
	owner.ok("POST", b2+"/subscription/checkout", map[string]string{"cycle_id": c2})
	if links.Load() != beforeRecovery+1 {
		t.Fatal("expired unknown issuance was not replaced")
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
