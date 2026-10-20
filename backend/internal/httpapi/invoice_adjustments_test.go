package httpapi_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"tatame/backend/internal/billing"
	"tatame/backend/internal/core"
	"tatame/backend/internal/database"
	"tatame/backend/internal/httpapi"
	"tatame/backend/internal/payments"
	"testing"
	"time"
)

func TestInvoiceAdjustments(t *testing.T) {
	address := os.Getenv("TEST_DATABASE_URL")
	if address == "" {
		t.Skip("dedicated PostgreSQL required")
	}
	must := func(e error) {
		t.Helper()
		if e != nil {
			t.Fatal(e)
		}
	}
	ctx := context.Background()
	must(database.Migrate(address))
	db, e := database.Open(ctx, address)
	must(e)
	defer db.Close()
	var mu sync.Mutex
	stored := map[string]payments.Payment{}
	creates := 0
	failDelete, loseDelete, failGet, loseCreate := false, false, false, false
	bank := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.URL.Path == "/customers":
			_ = json.NewEncoder(w).Encode(map[string]any{"data": []any{map[string]string{"id": "cus_adjustment"}}})
		case r.URL.Path == "/payments" && r.Method == "GET":
			list := []payments.Payment{}
			for _, p := range stored {
				if p.ExternalReference == r.URL.Query().Get("externalReference") {
					list = append(list, p)
				}
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"data": list})
		case r.URL.Path == "/payments" && r.Method == "POST":
			var p payments.Payment
			_ = json.NewDecoder(r.Body).Decode(&p)
			creates++
			p.ID = fmt.Sprintf("pay_adjust_%d", creates)
			p.Status = "PENDING"
			stored[p.ID] = p
			if loseCreate {
				loseCreate = false
				http.Error(w, "lost response", 500)
				return
			}
			_ = json.NewEncoder(w).Encode(p)
		case strings.HasSuffix(r.URL.Path, "/pixQrCode"):
			_ = json.NewEncoder(w).Encode(map[string]string{"payload": "000201TESTINVOICE", "expirationDate": time.Now().Add(time.Hour).Format(time.RFC3339)})
		case strings.HasPrefix(r.URL.Path, "/payments/"):
			id := strings.TrimPrefix(r.URL.Path, "/payments/")
			p, ok := stored[id]
			if !ok {
				http.NotFound(w, r)
				return
			}
			if r.Method == "DELETE" {
				if failDelete {
					http.Error(w, "unavailable", 500)
					return
				}
				p.Deleted = true
				stored[id] = p
				if loseDelete {
					loseDelete = false
					failGet = true
					http.Error(w, "lost response", 500)
					return
				}
				_ = json.NewEncoder(w).Encode(map[string]bool{"deleted": true})
				return
			}
			if failGet {
				http.Error(w, "unavailable", 500)
				return
			}
			_ = json.NewEncoder(w).Encode(p)
		default:
			http.NotFound(w, r)
		}
	}))
	defer bank.Close()
	manager := payments.New(db, nil)
	server := httptest.NewServer(httpapi.NewWithPayments(db, "", manager))
	defer server.Close()
	base := client{t: t, url: server.URL}
	register := func(name string) client {
		v := base.ok("POST", "/v1/auth/register", map[string]string{"name": name, "email": core.ID() + "@test.example", "password": "Tatame123!"})
		return client{t: t, url: server.URL, token: v["token"].(string)}
	}
	admin, student, outsider := register("Gestor ajustes"), register("Aluno ajustes"), register("Outro gestor")
	acad := admin.ok("POST", "/v1/academies", map[string]string{"name": "Ajustes financeiros"})
	a := acad["id"].(string)
	prefix := "/v1/academies/" + a
	other := outsider.ok("POST", "/v1/academies", map[string]string{"name": "Outra unidade"})
	otherPrefix := "/v1/academies/" + other["id"].(string)
	conn := payments.Connection{ID: core.ID(), AcademyID: a, Environment: "sandbox", BaseURL: bank.URL, APIKey: "test-key", WebhookToken: strings.Repeat("w", 32)}
	manager.Clients[a] = payments.Asaas{Connection: conn, HTTP: bank.Client()}
	manager.Connections[conn.ID] = conn
	mod := admin.list(prefix + "/modalities")[0]["id"].(string)
	loc, _ := time.LoadLocation("America/Sao_Paulo")
	month := time.Now().In(loc).Format("2006-01")
	fixture := func(email string) (string, string) {
		body := map[string]any{"name": "Aluno " + core.ID(), "email": email, "reuse_existing_identity": email != "", "birth_date": "2012-04-12", "cpf": testCPF(), "status": "active", "modality_ids": []string{mod}, "billing": map[string]any{"enabled": true, "amount_cents": 20050, "due_day": 10, "first_month": month, "payer_name": "Responsável", "payer_document": "52998224725"}}
		s := admin.ok("POST", prefix+"/students", body)
		sid := s["id"].(string)
		page := admin.ok("GET", prefix+"/invoices?student_id="+sid, nil)
		return page["items"].([]any)[0].(map[string]any)["id"].(string), sid
	}
	path := func(id string) string { return prefix + "/invoices/" + id }
	expect := func(c client, method, url string, body any, want int) {
		t.Helper()
		code, out := c.request(method, url, body, "")
		if code != want {
			t.Fatalf("%s %s: want %d got %d %v", method, url, want, code, out)
		}
	}
	discount := func(value, expected int64, reason string) map[string]any {
		return map[string]any{"discount_cents": value, "expected_amount_cents": expected, "reason": reason}
	}
	manual := func(expected int64) map[string]any {
		return map[string]any{"expected_amount_cents": expected, "method": "cash", "note": "Recebido na recepção"}
	}
	check := func(id, status string, amount, off int64) {
		t.Helper()
		v := admin.ok("GET", path(id), nil)
		if v["status"] != status || v["amount_cents"] != float64(amount) || v["discount_cents"] != float64(off) || v["original_amount_cents"] != float64(20050) {
			t.Fatal("unexpected invoice", v)
		}
	}
	currentStatus := "open"
	if time.Now().In(loc).Day() > 10 {
		currentStatus = "overdue"
	}
	iid, sid := fixture(getEmail(t, db, student.token))
	invite := admin.ok("POST", prefix+"/students/"+sid+"/invitations", nil)
	student.ok("POST", "/v1/invitations/"+invite["token"].(string)+"/accept", nil)
	expect(student, "PATCH", path(iid)+"/discount", discount(1000, 20050, "Acordo"), 403)
	expect(student, "POST", path(iid)+"/manual-payment", manual(20050), 403)
	expect(student, "GET", path(iid)+"/history", nil, 403)
	expect(outsider, "POST", path(iid)+"/manual-payment", manual(20050), 403)
	expect(outsider, "PATCH", otherPrefix+"/invoices/"+iid+"/discount", discount(1000, 20050, "Acordo"), 404)
	for _, v := range []int64{-1, 20050, 20051} {
		expect(admin, "PATCH", path(iid)+"/discount", discount(v, 20050, "Inválido"), 422)
	}
	expect(admin, "POST", path(iid)+"/manual-payment", map[string]any{"expected_amount_cents": 20050, "method": "anything"}, 422)
	admin.ok("PATCH", path(iid)+"/discount", discount(5050, 20050, "Acordo deste mês"))
	admin.ok("PATCH", path(iid)+"/discount", discount(5050, 20050, "Acordo deste mês"))
	check(iid, currentStatus, 15000, 5050)
	if h := admin.list(path(iid) + "/history"); len(h) != 1 {
		t.Fatal("discount retry duplicated audit", h)
	}
	expect(admin, "POST", path(iid)+"/manual-payment", manual(20050), 409)
	admin.ok("PATCH", path(iid)+"/discount", discount(0, 15000, "Remover desconto"))
	admin.ok("PATCH", path(iid)+"/discount", discount(2000, 20050, "Novo acordo"))
	check(iid, currentStatus, 18050, 2000)
	// The recurring agreement and future invoice retain the original full amount.
	var contract int64
	must(db.QueryRow(ctx, "SELECT amount_cents FROM student_billing WHERE academy_id=$1 AND student_id=$2", a, sid).Scan(&contract))
	if contract != 20050 {
		t.Fatal("contract was changed")
	}
	tx, e := db.Begin(ctx)
	must(e)
	must(billing.GenerateTx(ctx, tx, a, sid, time.Now().AddDate(0, 1, 0)))
	must(tx.Commit(ctx))
	var nextAmount int64
	must(db.QueryRow(ctx, "SELECT amount_cents FROM invoices WHERE academy_id=$1 AND student_id=$2 AND id<>$3", a, sid, iid).Scan(&nextAmount))
	if nextAmount != 20050 {
		t.Fatal("discount leaked into future invoice")
	}
	admin.ok("POST", path(iid)+"/manual-payment", manual(18050))
	admin.ok("POST", path(iid)+"/manual-payment", manual(18050))
	check(iid, "paid", 18050, 2000)
	if h := admin.list(path(iid) + "/history"); len(h) != 4 || h[0]["kind"] != "manual_payment" || h[0]["actor_name"] != "Gestor ajustes" {
		t.Fatal("manual audit", h)
	}
	expect(admin, "PATCH", path(iid)+"/discount", discount(1000, 18050, "Tarde demais"), 409)
	own := student.ok("GET", path(iid), nil)
	if own["payment_method"] != "cash" {
		t.Fatal("student did not see settlement")
	}
	// Pending Pix is removed before a discount, then the next Pix uses the net amount.
	pi, _ := fixture("")
	admin.ok("POST", path(pi)+"/pix", nil)
	var oldID string
	must(db.QueryRow(ctx, "SELECT provider_id FROM pix_charges WHERE invoice_id=$1", pi).Scan(&oldID))
	admin.ok("PATCH", path(pi)+"/discount", discount(1000, 20050, "Pontual"))
	check(pi, currentStatus, 19050, 1000)
	mu.Lock()
	oldDeleted := stored[oldID].Deleted
	mu.Unlock()
	if !oldDeleted {
		t.Fatal("old Pix is still payable")
	}
	pix := admin.ok("POST", path(pi)+"/pix", nil)
	if pix["amount_cents"] != float64(19050) {
		t.Fatal("wrong regenerated Pix", pix)
	}
	var newID string
	must(db.QueryRow(ctx, "SELECT provider_id FROM pix_charges WHERE invoice_id=$1 AND state<>'retired'", pi).Scan(&newID))
	if oldID == newID {
		t.Fatal("old Pix reused")
	}
	webhook := func(id, status string) int {
		mu.Lock()
		p := stored[id]
		p.Status = status
		stored[id] = p
		mu.Unlock()
		raw, _ := json.Marshal(map[string]any{"id": "evt_" + id + "_" + status, "payment": map[string]string{"id": id}})
		req, _ := http.NewRequest("POST", server.URL+"/v1/webhooks/asaas/"+conn.ID+"/pix", bytes.NewReader(raw))
		req.Header.Set("asaas-access-token", conn.WebhookToken)
		res, e := http.DefaultClient.Do(req)
		must(e)
		defer res.Body.Close()
		return res.StatusCode
	}
	if code := webhook(oldID, "REFUNDED"); code != 200 {
		t.Fatal("retired webhook", code)
	}
	check(pi, currentStatus, 19050, 1000)
	if code := webhook(newID, "RECEIVED"); code != 200 {
		t.Fatal("new payment", code)
	}
	if code := webhook(newID, "RECEIVED"); code != 200 {
		t.Fatal("repeated payment", code)
	}
	check(pi, "paid", 19050, 1000)
	// A payment already received by Asaas wins over manual settlement.
	paid, _ := fixture("")
	admin.ok("POST", path(paid)+"/pix", nil)
	var paidID string
	must(db.QueryRow(ctx, "SELECT provider_id FROM pix_charges WHERE invoice_id=$1", paid).Scan(&paidID))
	mu.Lock()
	p := stored[paidID]
	p.Status = "RECEIVED"
	stored[paidID] = p
	mu.Unlock()
	expect(admin, "POST", path(paid)+"/manual-payment", manual(20050), 409)
	check(paid, "paid", 20050, 0)
	if h := admin.list(path(paid) + "/history"); len(h) != 0 {
		t.Fatal("bank payment became manual")
	}
	// Delete failure and a lost deletion response leave the amount unchanged.
	fail, _ := fixture("")
	admin.ok("POST", path(fail)+"/pix", nil)
	mu.Lock()
	failDelete = true
	mu.Unlock()
	expect(admin, "PATCH", path(fail)+"/discount", discount(500, 20050, "Acordo"), 503)
	check(fail, currentStatus, 20050, 0)
	mu.Lock()
	failDelete = false
	loseDelete = true
	mu.Unlock()
	expect(admin, "PATCH", path(fail)+"/discount", discount(500, 20050, "Acordo"), 503)
	check(fail, currentStatus, 20050, 0)
	mu.Lock()
	failGet = false
	mu.Unlock()
	admin.ok("PATCH", path(fail)+"/discount", discount(500, 20050, "Acordo"))
	check(fail, currentStatus, 19550, 500)
	// A create accepted by the provider with a lost response is recovered by reference.
	uncertain, _ := fixture("")
	mu.Lock()
	loseCreate = true
	mu.Unlock()
	expect(admin, "POST", path(uncertain)+"/pix", nil, 503)
	admin.ok("POST", path(uncertain)+"/manual-payment", manual(20050))
	check(uncertain, "paid", 20050, 0)
	// A truly uncertain charge with no provider match cannot be silently written off.
	blocked, _ := fixture("")
	_, e = db.Exec(ctx, "INSERT INTO pix_charges(id,academy_id,invoice_id,reference,state,amount_cents) VALUES($1,$2,$3,$4,'uncertain',20050)", core.ID(), a, blocked, core.Token())
	must(e)
	expect(admin, "POST", path(blocked)+"/manual-payment", manual(20050), 409)
	check(blocked, currentStatus, 20050, 0)
	// Concurrency cannot create two manual receipts.
	concurrent, _ := fixture("")
	var wg sync.WaitGroup
	codes := make(chan int, 2)
	for range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			code, _ := admin.request("POST", path(concurrent)+"/manual-payment", manual(20050), "")
			codes <- code
		}()
	}
	wg.Wait()
	close(codes)
	for code := range codes {
		if code != 200 && code != 503 {
			t.Fatal("concurrent result", code)
		}
	}
	admin.ok("POST", path(concurrent)+"/manual-payment", manual(20050))
	if h := admin.list(path(concurrent) + "/history"); len(h) != 1 {
		t.Fatal("concurrent manual duplication", h)
	}

	// Concurrent discounts are checked against the amount each manager saw.
	parallel, _ := fixture("")
	results := make(chan int, 2)
	for _, off := range []int64{1000, 2000} {
		wg.Add(1)
		go func(off int64) {
			defer wg.Done()
			code, _ := admin.request("PATCH", path(parallel)+"/discount", discount(off, 20050, "Acordo concorrente"), "")
			results <- code
		}(off)
	}
	wg.Wait()
	close(results)
	success := 0
	for code := range results {
		if code == 200 {
			success++
		} else if code != 409 && code != 503 {
			t.Fatal("concurrent discount result", code)
		}
	}
	if success != 1 {
		t.Fatal("lost discount update", success)
	}
	if h := admin.list(path(parallel) + "/history"); len(h) != 1 {
		t.Fatal("discount race audit", h)
	}
	// Retired Pix events cannot cancel or overwrite a manual settlement.
	external, _ := fixture("")
	admin.ok("POST", path(external)+"/pix", nil)
	var externalID string
	must(db.QueryRow(ctx, "SELECT provider_id FROM pix_charges WHERE invoice_id=$1", external).Scan(&externalID))
	admin.ok("POST", path(external)+"/manual-payment", manual(20050))
	if code := webhook(externalID, "REFUNDED"); code != 200 {
		t.Fatal("retired refund notification", code)
	}
	check(external, "paid", 20050, 0)
	if code := webhook(externalID, "RECEIVED"); code != 409 {
		t.Fatal("late payment was not flagged for review", code)
	}
	check(external, "paid", 20050, 0)
	cancelled, _ := fixture("")
	admin.ok("PATCH", path(cancelled)+"/cancel", nil)
	expect(admin, "POST", path(cancelled)+"/manual-payment", manual(20050), 409)
	expect(admin, "PATCH", path(cancelled)+"/discount", discount(500, 20050, "Acordo"), 409)
	must(manager.Reconcile(ctx))
	var receipts int
	must(db.QueryRow(ctx, "SELECT count(*) FROM payment_receipts WHERE academy_id=$1", a).Scan(&receipts))
	if receipts != 2 {
		t.Fatal("manual settlement duplicated bank receipts", receipts)
	}
	var sum int64
	must(db.QueryRow(ctx, "SELECT sum(amount_cents) FROM invoices WHERE academy_id=$1 AND status='paid'", a).Scan(&sum))
	dashboard := admin.ok("GET", prefix+"/dashboard", nil)
	if dashboard["received_month_cents"] != float64(sum) {
		t.Fatal("dashboard did not use net settled values", dashboard, sum)
	}
}
