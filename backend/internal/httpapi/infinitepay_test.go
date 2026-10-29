package httpapi_test

import (
	"bytes"
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
	"testing"
)

func TestInfinitePayFlow(t *testing.T) {
	address := os.Getenv("TEST_DATABASE_URL")
	if address == "" {
		t.Skip("dedicated PostgreSQL required")
	}
	if e := database.Migrate(address); e != nil {
		t.Fatal(e)
	}
	ctx := context.Background()
	db, e := database.Open(ctx, address)
	if e != nil {
		t.Fatal(e)
	}
	defer db.Close()
	var expectedPrice atomic.Int64
	expectedPrice.Store(18000)
	var creates atomic.Int32
	var amount atomic.Int64
	amount.Store(18000)
	var paid atomic.Bool
	var fail atomic.Bool
	var checkedKey string
	var keyMu sync.Mutex
	bank := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		keyMu.Lock()
		checkedKey = r.Header.Get("X-Api-Key")
		keyMu.Unlock()
		if r.URL.Path == "/links" {
			creates.Add(1)
			var payload map[string]any
			if e := json.NewDecoder(r.Body).Decode(&payload); e != nil {
				t.Error(e)
			}
			opts := payload["options"].(map[string]any)
			if opts["single_payment"] != true || payload["order_nsu"] == nil || payload["webhook"] == nil {
				t.Error("incomplete checkout contract")
			}
			items := payload["items"].([]any)
			if items[0].(map[string]any)["price"] != float64(expectedPrice.Load()) {
				t.Error("incorrect amount")
			}
			if fail.Load() {
				w.WriteHeader(500)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]string{"url": "https://checkout.infinitepay.io/test-fixture"})
			return
		}
		if r.URL.Path == "/payment_check" {
			_ = json.NewEncoder(w).Encode(map[string]any{"success": true, "paid": paid.Load(), "amount": amount.Load(), "paid_amount": amount.Load(), "capture_method": "pix"})
			return
		}
		w.WriteHeader(404)
	}))
	defer bank.Close()
	manager := payments.New(db, nil)
	manager.Infinite = &payments.InfinitePay{DB: db, Key: bytes.Repeat([]byte{3}, 32), PublicURL: "https://tatame.example", Enabled: true, BaseURL: bank.URL, HTTP: bank.Client()}
	server := httptest.NewServer(httpapi.NewWithPayments(db, "", manager))
	defer server.Close()
	base := client{t: t, url: server.URL}
	register := func(name string) client {
		v := base.ok("POST", "/v1/auth/register", map[string]string{"name": name, "email": core.ID() + "@infinite.test", "password": "Test-Infinite-42!"})
		return client{t: t, url: server.URL, token: v["token"].(string)}
	}
	owner := register("Gestor teste InfinitePay")
	outsider := register("Pessoa sem acesso")
	academy := owner.ok("POST", "/v1/academies", map[string]string{"name": "Academia teste InfinitePay"})
	a := academy["id"].(string)
	prefix := "/v1/academies/" + a
	studentEmail := core.ID() + "@infinite.test"
	student := owner.ok("POST", prefix+"/students", map[string]any{"email": studentEmail, "name": "Aluno teste pagamento", "cpf": testCPF(), "birth_date": "1990-01-01", "status": "active"})
	sid := student["id"].(string)
	studentLogin := base.ok("POST", "/v1/auth/register", map[string]string{"name": "Aluno teste pagamento", "email": studentEmail, "password": "Test-Infinite-42!"})
	studentClient := client{t: t, url: server.URL, token: studentLogin["token"].(string)}
	// Canonical identity matches the enrollment; bind only this synthetic fixture.
	if _, e = db.Exec(ctx, "UPDATE students SET user_id=$2 WHERE academy_id=$1 AND id=$3", a, studentLogin["user"].(map[string]any)["id"], sid); e != nil {
		t.Fatal(e)
	}
	if code, _ := studentClient.request("PUT", prefix+"/payment-integration", map[string]any{"handle": "other-handle", "api_key": "inchk_fake_no_permission"}, ""); code != 403 {
		t.Fatal("student configured receiving account", code)
	}
	deviceToken := core.Token()
	if _, e = db.Exec(ctx, "INSERT INTO devices(id,academy_id,name,token_hash) VALUES($1,$2,'Dispositivo teste',$3)", core.ID(), a, core.Hash(deviceToken)); e != nil {
		t.Fatal(e)
	}
	deviceClient := client{t: t, url: server.URL, token: deviceToken}

	invoiceSequence := 0
	newInvoice := func() string {
		invoiceSequence++
		id := core.ID()
		_, e = db.Exec(ctx, `INSERT INTO invoices(id,academy_id,student_id,competence,due_date,amount_cents,payer_name,payer_document) VALUES($1,$2,$3,(date_trunc('month',now())+($4::int*interval '1 month'))::date,current_date,18000,'Pagador ficticio','52998224725')`, id, a, sid, invoiceSequence)
		if e != nil {
			t.Fatal(e)
		}
		return id
	}
	key := "inchk_test-secret-key-11111"
	in := map[string]any{"handle": "$academia-teste", "api_key": key}
	for _, method := range []string{"GET", "PUT", "PATCH"} {
		if code, _ := outsider.request(method, prefix+"/payment-integration", in, ""); code != 403 {
			t.Fatalf("integration access %s %d", method, code)
		}
	}
	saved := owner.ok("PUT", prefix+"/payment-integration", in)
	raw, _ := json.Marshal(saved)
	if strings.Contains(string(raw), key) || saved["validated_at"] != nil {
		t.Fatal("secret leak or false validation")
	}
	if creates.Load() != 0 {
		t.Fatal("save generated charge")
	}
	var cipher []byte
	var connection string
	if e = db.QueryRow(ctx, "SELECT id,encrypted_key FROM payment_connections WHERE academy_id=$1 AND current", a).Scan(&connection, &cipher); e != nil || bytes.Contains(cipher, []byte(key)) {
		t.Fatal("unencrypted secret", e)
	}
	id := newInvoice()
	path := prefix + "/invoices/" + id
	if code, _ := outsider.request("POST", path+"/checkout", nil, ""); code != 403 {
		t.Fatal("cross tenant checkout", code)
	}
	if code, _ := deviceClient.request("POST", path+"/checkout", nil, ""); code != 403 {
		t.Fatal("device started payment", code)
	}
	result := studentClient.ok("POST", path+"/checkout", nil)
	if result["status"] != "waiting" {
		t.Fatal(result)
	}
	owner.ok("POST", path+"/checkout", nil)
	if creates.Load() != 1 {
		t.Fatal("duplicate charge")
	}
	for _, request := range []struct {
		method, suffix string
		body           any
	}{{"PATCH", "/discount", map[string]any{"discount_cents": 100, "expected_amount_cents": 18000, "reason": "Teste desconto"}}, {"POST", "/manual-payment", map[string]any{"method": "cash", "expected_amount_cents": 18000}}, {"PATCH", "/cancel", nil}, {"POST", "/pix", nil}} {
		if code, _ := owner.request(request.method, path+request.suffix, request.body, ""); code != 409 {
			t.Fatalf("issued link not protected %s %d", request.suffix, code)
		}
	}
	var reference string
	db.QueryRow(ctx, "SELECT reference FROM checkout_attempts WHERE invoice_id=$1", id).Scan(&reference)
	event := map[string]any{"order_nsu": reference, "transaction_nsu": "synthetic-transaction", "invoice_slug": "synthetic-slug"}
	webhook := "/v1/webhooks/infinitepay/" + connection
	base.ok("POST", webhook, event)
	if e = manager.Reconcile(ctx); e != nil {
		t.Fatal(e)
	}
	if got := owner.ok("GET", path, nil)["status"]; got != "open" && got != "overdue" {
		t.Fatal("forged webhook paid invoice", got)
	}
	// Same notification can be retried, and is only trusted after authenticated provider confirmation.
	paid.Store(true)
	_, e = db.Exec(ctx, "UPDATE checkout_inbox SET next_attempt_at=now() WHERE connection_id=$1", connection)
	if e != nil {
		t.Fatal(e)
	}
	if e = manager.Reconcile(ctx); e != nil {
		t.Fatal(e)
	}
	base.ok("POST", webhook, event)
	manager.Reconcile(ctx)
	got := owner.ok("GET", path, nil)
	if got["status"] != "paid" || got["payment_method"] != "infinitepay_pix" {
		t.Fatal("payment not applied", got)
	}
	history := owner.list(path + "/history")
	if len(history) != 1 || history[0]["kind"] != "bank_payment" {
		t.Fatal("bank receipt missing from history", history)
	}
	var count int
	db.QueryRow(ctx, "SELECT count(*) FROM checkout_receipts WHERE academy_id=$1", a).Scan(&count)
	if count != 1 {
		t.Fatal("duplicate receipts", count)
	}
	if owner.ok("GET", prefix+"/payment-integration", nil)["validated_at"] == nil {
		t.Fatal("verified payment did not validate connection")
	}
	// Replace credentials; old attempts continue to use their original key.
	owner.ok("PUT", prefix+"/payment-integration", map[string]any{"handle": "new-handle", "api_key": "inchk_test-secret-key-22222"})
	owner.ok("POST", path+"/payment-check", map[string]any{"order_nsu": reference, "transaction_nsu": "synthetic-transaction", "slug": "synthetic-slug"})
	keyMu.Lock()
	oldKeyUsed := checkedKey == key
	keyMu.Unlock()
	if !oldKeyUsed {
		t.Fatal("old connection was overwritten")
	}
	owner.ok("PATCH", prefix+"/payment-integration", map[string]any{"enabled": false})
	id2 := newInvoice()
	if code, _ := owner.request("POST", prefix+"/invoices/"+id2+"/checkout", nil, ""); code != 503 {
		t.Fatal("suspension ignored", code)
	}
	owner.ok("PATCH", prefix+"/payment-integration", map[string]any{"enabled": true})
	// Ambiguous creation cannot be automatically retried, including after a simulated restart.
	fail.Store(true)
	result = owner.ok("POST", prefix+"/invoices/"+id2+"/checkout", nil)
	if result["status"] != "review" {
		t.Fatal(result)
	}
	before := creates.Load()
	owner.ok("POST", prefix+"/invoices/"+id2+"/checkout", nil)
	if creates.Load() != before {
		t.Fatal("ambiguous creation reissued")
	}
	fail.Store(false)
	// Divergent bank value is recorded as review, without changing accounting.
	id3 := newInvoice()
	path3 := prefix + "/invoices/" + id3
	owner.ok("POST", path3+"/checkout", nil)
	db.QueryRow(ctx, "SELECT reference FROM checkout_attempts WHERE invoice_id=$1", id3).Scan(&reference)
	amount.Store(17000)
	if code, _ := owner.request("POST", path3+"/payment-check", map[string]any{"order_nsu": reference, "transaction_nsu": "mismatch-txn", "slug": "mismatch-slug"}, ""); code != 409 {
		t.Fatal("mismatch accepted", code)
	}
	got = owner.ok("GET", path3, nil)
	if got["status"] == "paid" || got["payment_checkout"].(map[string]any)["status"] != "review" {
		t.Fatal("mismatch posted", got)
	}
	// Two simultaneous requests cannot create two external links.
	id4 := newInvoice()
	before = creates.Load()
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			code, _ := owner.request("POST", prefix+"/invoices/"+id4+"/checkout", nil, "")
			if code != 200 && code != 503 {
				t.Errorf("concurrent checkout %d", code)
			}
		}()
	}
	wg.Wait()
	if creates.Load()-before > 1 {
		t.Fatal("concurrent issuance duplicated")
	}
	// Expiry is not treated as proof of cancellation.
	_, e = db.Exec(ctx, "UPDATE checkout_attempts SET expires_at=now()-interval '1 day' WHERE invoice_id=$1", id4)
	if e != nil {
		t.Fatal(e)
	}
	if result = owner.ok("POST", prefix+"/invoices/"+id4+"/checkout", nil); result["status"] != "review" {
		t.Fatal("expired link reissued")
	}
	// Recover the same stored link, without emitting another charge, including after local expiry.
	expired := owner.ok("GET", prefix+"/invoices/"+id4, nil)["payment_checkout"].(map[string]any)
	if expired["url"] != "https://checkout.infinitepay.io/test-fixture" || expired["expired"] != true {
		t.Fatal("Stored link hidden after expiry", expired)
	}
	amount.Store(18000)
	paid.Store(false)
	id5 := newInvoice()
	path5 := prefix + "/invoices/" + id5
	issued := owner.ok("POST", path5+"/checkout", nil)
	oldID := issued["id"].(string)
	before = creates.Load()
	for i := 0; i < 2; i++ {
		v := studentClient.ok("GET", path5, nil)
		if v["payment_checkout"].(map[string]any)["url"] != issued["url"] {
			t.Fatal("Lost stored link")
		}
	}
	if creates.Load() != before {
		t.Fatal("Reading invoice created another checkout")
	}
	var oldRef string
	db.QueryRow(ctx, "SELECT reference FROM checkout_attempts WHERE id=$1", oldID).Scan(&oldRef)
	if code, _ := owner.request("POST", path5+"/payment-check", map[string]any{"order_nsu": oldRef, "transaction_nsu": "old-recovery-txn", "slug": "old-recovery-slug"}, ""); code != 409 {
		t.Fatal(code)
	}
	resolution := map[string]any{"attempt_id": oldID, "confirmed_invalidated": false, "note": "Protocolo ficticio: link inutilizado no provedor"}
	if code, _ := owner.request("POST", path5+"/checkout-retirement", resolution, ""); code != 422 {
		t.Fatal("Missing acknowledgment accepted", code)
	}
	resolution["confirmed_invalidated"] = true
	if code, _ := studentClient.request("POST", path5+"/checkout-retirement", resolution, ""); code != 403 {
		t.Fatal("Student retired checkout", code)
	}
	if code, _ := outsider.request("GET", path5+"/checkouts", nil, ""); code != 403 {
		t.Fatal("Foreign checkout history", code)
	}
	owner.ok("POST", path5+"/checkout-retirement", resolution)
	if len(owner.list(path5+"/checkouts")) != 1 {
		t.Fatal("Previous link deleted")
	}
	owner.ok("PATCH", path5+"/discount", map[string]any{"discount_cents": 1000, "expected_amount_cents": 18000, "reason": "Desconto após conferência registrada"})
	expectedPrice.Store(17000)
	next := owner.ok("POST", path5+"/checkout", nil)
	if next["id"] == oldID || next["amount_cents"] != float64(17000) {
		t.Fatal("Old checkout reused after price change", next)
	}
	audit := owner.list(path5 + "/history")
	if len(audit) != 2 {
		t.Fatal("Resolution/discount audit missing", audit)
	}
	var newRef string
	db.QueryRow(ctx, "SELECT reference FROM checkout_attempts WHERE id=$1", next["id"]).Scan(&newRef)
	// Late payment of an old link is never posted against the changed monthly amount.
	paid.Store(true)
	amount.Store(18000)
	if code, _ := owner.request("POST", path5+"/payment-check", map[string]any{"order_nsu": oldRef, "transaction_nsu": "old-recovery-txn", "slug": "old-recovery-slug"}, ""); code != 409 {
		t.Fatal("Old payment posted", code)
	}
	changed := owner.ok("GET", path5, nil)
	if changed["status"] == "paid" || changed["checkout_history_warning"] == nil {
		t.Fatal("Late receipt hidden or posted", changed)
	}
	if changed["payment_checkout"].(map[string]any)["id"] != next["id"] {
		t.Fatal("Old callback replaced current attempt")
	}
	amount.Store(17000)
	owner.ok("POST", path5+"/payment-check", map[string]any{"order_nsu": newRef, "transaction_nsu": "new-recovery-txn", "slug": "new-recovery-slug"})
	if owner.ok("GET", path5, nil)["status"] != "paid" {
		t.Fatal("New checkout did not settle")
	}
	// A fresh provider check prevents manually retiring a payment that just arrived.
	expectedPrice.Store(18000)
	amount.Store(18000)
	paid.Store(false)
	id6 := newInvoice()
	path6 := prefix + "/invoices/" + id6
	current := owner.ok("POST", path6+"/checkout", nil)
	var ref6 string
	db.QueryRow(ctx, "SELECT reference FROM checkout_attempts WHERE id=$1", current["id"]).Scan(&ref6)
	owner.request("POST", path6+"/payment-check", map[string]any{"order_nsu": ref6, "transaction_nsu": "paid-before-resolution", "slug": "known-slug"}, "")
	paid.Store(true)
	if code, _ := owner.request("POST", path6+"/checkout-retirement", map[string]any{"attempt_id": current["id"], "confirmed_invalidated": true, "note": "Tentativa de conferência já superada pelo recebimento"}, ""); code != 409 {
		t.Fatal("Paid checkout retired", code)
	}
	if owner.ok("GET", path6, nil)["status"] != "paid" {
		t.Fatal("Bank confirmation not applied")
	}

}
