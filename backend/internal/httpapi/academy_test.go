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
	"tatame/backend/internal/billing"
	"tatame/backend/internal/core"
	"tatame/backend/internal/database"
	"tatame/backend/internal/httpapi"
	"tatame/backend/internal/payments"
	"testing"
	"time"
)

func TestAcademyBillingAndAsaas(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("dedicated PostgreSQL required")
	}
	must := func(e error) {
		t.Helper()
		if e != nil {
			t.Fatal(e)
		}
	}
	must(database.Migrate(url))
	db, e := database.Open(context.Background(), url)
	must(e)
	defer db.Close()
	var mu sync.Mutex
	var stored payments.Payment
	creates := 0
	loseReply := true
	status := "PENDING"
	bank := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		if r.Header.Get("access_token") != "test-key" {
			t.Error("missing Asaas key")
		}
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.URL.Path == "/customers":
			_ = json.NewEncoder(w).Encode(map[string]any{"data": []any{map[string]string{"id": "cus_test"}}})
		case r.URL.Path == "/payments" && r.Method == "GET":
			list := []payments.Payment{}
			if stored.ID != "" && r.URL.Query().Get("externalReference") == stored.ExternalReference {
				stored.Status = status
				list = append(list, stored)
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"data": list})
		case r.URL.Path == "/payments" && r.Method == "POST":
			creates++
			var in struct {
				Customer          string
				Value             json.Number
				ExternalReference string
			}
			must(json.NewDecoder(r.Body).Decode(&in))
			stored = payments.Payment{ID: "pay_test", Customer: in.Customer, Value: in.Value, ExternalReference: in.ExternalReference, BillingType: "PIX", Status: status}
			if loseReply {
				loseReply = false
				http.Error(w, "lost response", 500)
				return
			}
			_ = json.NewEncoder(w).Encode(stored)
		case strings.HasSuffix(r.URL.Path, "/pixQrCode"):
			_ = json.NewEncoder(w).Encode(map[string]string{"payload": "000201TEST", "expirationDate": time.Now().Add(time.Hour).Format(time.RFC3339)})
		case r.URL.Path == "/payments/pay_test":
			stored.Status = status
			_ = json.NewEncoder(w).Encode(stored)
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
	admin, student, outsider := register("Gestor financeiro"), register("Aluno convidado"), register("Outro gestor")
	acad := admin.ok("POST", "/v1/academies", map[string]string{"name": "Financeiro"})
	aid := acad["id"].(string)
	prefix := "/v1/academies/" + aid
	other := outsider.ok("POST", "/v1/academies", map[string]string{"name": "Isolada"})
	conn := payments.Connection{ID: core.ID(), AcademyID: aid, Environment: "sandbox", BaseURL: bank.URL, APIKey: "test-key", WebhookToken: strings.Repeat("w", 32)}
	manager.Clients[aid] = payments.Asaas{Connection: conn, HTTP: bank.Client()}
	manager.Connections[conn.ID] = conn
	mods := admin.list(prefix + "/modalities")
	month := time.Now().In(time.FixedZone("BR", -3*3600)).Format("2006-01")
	body := map[string]any{"birth_date": "2012-04-12", "cpf": testCPF(), "name": "Maria da Silva", "email": getEmail(t, db, student.token), "reuse_existing_identity": true, "phone": "11999999999", "status": "active", "belt": "Faixa Azul", "modality_ids": []string{mods[0]["id"].(string), mods[1]["id"].(string)}, "billing": map[string]any{"enabled": true, "amount_cents": 20050, "due_day": 31, "first_month": month, "payer_name": "Maria da Silva", "payer_document": "52998224725"}}
	st := admin.ok("POST", prefix+"/students", body)
	sid := st["id"].(string)
	if st["user_id"] != "" {
		t.Fatal("student unexpectedly owns account")
	}
	if code, _ := outsider.request("GET", prefix+"/students", nil, ""); code != 403 {
		t.Fatal("tenant leak", code)
	}
	if code, _ := admin.request("GET", "/v1/academies/"+other["id"].(string)+"/students/"+sid, nil, ""); code != 403 {
		t.Fatal("tenant leak", code)
	}
	invite := admin.ok("POST", prefix+"/students/"+sid+"/invitations", nil)
	token := invite["token"].(string)
	linked := student.ok("POST", "/v1/invitations/"+token+"/accept", nil)
	if linked["id"] != sid {
		t.Fatal("wrong invitation profile")
	}
	if code, _ := student.request("POST", "/v1/invitations/"+token+"/accept", nil, ""); code != 410 {
		t.Fatal("invitation reused", code)
	}
	own := student.ok("GET", prefix+"/me/student", nil)
	if own["id"] != sid {
		t.Fatal("wrong own profile")
	}
	page := student.ok("GET", prefix+"/me/invoices", nil)
	items := page["items"].([]any)
	if len(items) != 1 {
		t.Fatal("first invoice not generated", page)
	}
	inv := items[0].(map[string]any)
	iid := inv["id"].(string)
	if code, _ := outsider.request("POST", prefix+"/invoices/"+iid+"/pix", nil, ""); code != 403 {
		t.Fatal("unowned payment", code)
	}
	// The provider accepted a request but its response was lost: the retry must find it.
	if code, _ := student.request("POST", prefix+"/invoices/"+iid+"/pix", nil, ""); code != 503 {
		t.Fatal("expected lost response", code)
	}
	pix := student.ok("POST", prefix+"/invoices/"+iid+"/pix", nil)
	if pix["status"] != "waiting" {
		t.Fatal(pix)
	}
	mu.Lock()
	n := creates
	mu.Unlock()
	if n != 1 {
		t.Fatal("duplicated charge", n)
	}
	// Editing the total preserves the current invoice.
	body["billing"].(map[string]any)["amount_cents"] = 24000
	admin.ok("PATCH", prefix+"/students/"+sid, body)
	current := student.ok("GET", prefix+"/invoices/"+iid, nil)
	if current["amount_cents"] != float64(20050) {
		t.Fatal("changed emitted amount")
	}
	var wg sync.WaitGroup
	for range 4 {
		wg.Add(1)
		go func() { defer wg.Done(); must((billing.Repository{DB: db}).Generate(context.Background())) }()
	}
	wg.Wait()
	page = student.ok("GET", prefix+"/me/invoices", nil)
	if page["total"] != float64(1) {
		t.Fatal("generation duplicated invoice")
	}
	webhook := func(auth string) int {
		raw, _ := json.Marshal(map[string]any{"id": "evt_test", "event": "PAYMENT_RECEIVED", "extra": "forward compatible", "payment": map[string]string{"id": "pay_test", "externalReference": stored.ExternalReference}})
		req, _ := http.NewRequest("POST", server.URL+"/v1/webhooks/asaas/"+conn.ID+"/pix", bytes.NewReader(raw))
		req.Header.Set("asaas-access-token", auth)
		res, e := http.DefaultClient.Do(req)
		must(e)
		defer res.Body.Close()
		return res.StatusCode
	}
	if code := webhook("bad"); code != 401 {
		t.Fatal("unauthenticated webhook", code)
	}
	mu.Lock()
	status = "RECEIVED"
	stored.Value = json.Number("200.51")
	mu.Unlock()
	if code := webhook(conn.WebhookToken); code != 409 {
		t.Fatal("mismatched value accepted", code)
	}
	unchanged := student.ok("GET", prefix+"/invoices/"+iid, nil)
	if unchanged["status"] == "paid" {
		t.Fatal("mismatched receipt marked paid")
	}
	mu.Lock()
	stored.Value = json.Number("200.50")
	mu.Unlock()
	if code := webhook(conn.WebhookToken); code != 200 {
		t.Fatal("webhook", code)
	}
	if code := webhook(conn.WebhookToken); code != 200 {
		t.Fatal("duplicate webhook", code)
	}
	current = student.ok("GET", prefix+"/invoices/"+iid, nil)
	if current["status"] != "paid" {
		t.Fatal("payment not confirmed", current)
	}
	var receipts int
	must(db.QueryRow(context.Background(), "SELECT count(*) FROM payment_receipts WHERE academy_id=$1", aid).Scan(&receipts))
	must(manager.Reconcile(context.Background()))
	if receipts != 1 {
		t.Fatal("duplicate receipts", receipts)
	}
	body["status"] = "inactive"
	body["billing"].(map[string]any)["enabled"] = false
	admin.ok("PATCH", prefix+"/students/"+sid, body)
	if page = student.ok("GET", prefix+"/me/invoices", nil); page["total"] != float64(1) {
		t.Fatal("inactive student lost history")
	}
	// Check-in uses the independent student record, including a record without a login.
	stClass := admin.ok("POST", prefix+"/classes", map[string]string{"name": "Sem professor", "modality_id": mods[0]["id"].(string)})
	loc, _ := time.LoadLocation("America/Sao_Paulo")
	schedule := admin.ok("POST", prefix+"/classes/"+stClass["id"].(string)+"/schedules", map[string]any{"weekday": int(time.Now().In(loc).Weekday()), "start_time": "18:00", "duration_minutes": 60})
	session := admin.ok("POST", prefix+"/classes/"+stClass["id"].(string)+"/sessions", map[string]string{"schedule_id": schedule["id"].(string)})
	// A separate manager login is converted to a device.
	deviceLogin := base.ok("POST", "/v1/auth/login", map[string]string{"email": getEmail(t, db, admin.token), "password": "Tatame123!"})
	provisioner := client{t: t, url: server.URL, token: deviceLogin["token"].(string)}
	device := provisioner.ok("POST", prefix+"/devices", map[string]string{"name": "Tablet do novo modelo"})
	kiosk := client{t: t, url: server.URL, token: device["token"].(string)}
	credential := student.ok("GET", prefix+"/me/student-credential", nil)
	path := prefix + "/sessions/" + session["id"].(string) + "/check-ins"
	if code, _ := kiosk.request("POST", path, map[string]string{"student_code": credential["student_code"].(string)}, core.ID()); code != 403 {
		t.Fatal("inactive checkin accepted", code)
	}
	body["status"] = "active"
	body["billing"].(map[string]any)["enabled"] = true
	body["billing"].(map[string]any)["first_month"] = time.Now().In(loc).AddDate(0, 1, 0).Format("2006-01")
	admin.ok("PATCH", prefix+"/students/"+sid, body)
	if code, _ := admin.request("POST", path, map[string]string{"student_code": credential["student_code"].(string)}, core.ID()); code != 403 {
		t.Fatal("personal checkin accepted", code)
	}
	code, record := kiosk.request("POST", path, map[string]string{"student_code": credential["student_code"].(string)}, core.ID())
	if code != 200 || record["membership_id"] != sid {
		t.Fatal("independent checkin", code, record)
	}
	hist := student.ok("GET", prefix+"/me/attendances?page=1", nil)
	if hist["total"] != float64(1) {
		t.Fatal("independent history missing", hist)
	}
	var futureAmount int64
	future := time.Now().In(loc).AddDate(0, 1, 0)
	tx, e := db.Begin(context.Background())
	must(e)
	must(billing.GenerateTx(context.Background(), tx, aid, sid, future))
	must(tx.Commit(context.Background()))
	must(db.QueryRow(context.Background(), "SELECT amount_cents FROM invoices WHERE academy_id=$1 AND student_id=$2 AND to_char(competence,'YYYY-MM')=$3", aid, sid, future.Format("2006-01")).Scan(&futureAmount))
	if futureAmount != 24000 {
		t.Fatal("future amount snapshot", futureAmount)
	}
	// Expired and revoked invitations cannot attach a second profile.
	st2 := admin.ok("POST", prefix+"/students", map[string]any{"birth_date": "2012-04-12", "cpf": testCPF(), "name": "Aluno sem conta", "email": core.ID() + "@no-account.test", "status": "active", "modality_ids": []string{}})
	iv := admin.ok("POST", prefix+"/students/"+st2["id"].(string)+"/invitations", nil)
	admin.ok("DELETE", prefix+"/students/"+st2["id"].(string)+"/invitations", nil)
	if code, _ := kiosk.request("POST", path, map[string]string{"student_code": st2["student_code"].(string)}, core.ID()); code != 200 {
		t.Fatal("student without account cannot check in", code)
	}
	if code, _ := student.request("POST", "/v1/invitations/"+iv["token"].(string)+"/accept", nil, ""); code != 410 {
		t.Fatal("revoked invite accepted")
	}
}
