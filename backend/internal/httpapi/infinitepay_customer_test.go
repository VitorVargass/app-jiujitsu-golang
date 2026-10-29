package httpapi_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"tatame/backend/internal/core"
	"tatame/backend/internal/database"
	"tatame/backend/internal/httpapi"
	"tatame/backend/internal/payments"
	"testing"
)

func TestInfinitePayCustomerPrefill(t *testing.T) {
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
	captures := make(chan map[string]any, 10)
	bank := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/links" {
			t.Error("unexpected provider operation")
			w.WriteHeader(404)
			return
		}
		var payload map[string]any
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Error(err)
		}
		captures <- payload
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"url":"https://checkout.infinitepay.io/customer-fixture"}`))
	}))
	defer bank.Close()
	manager := payments.New(db, nil)
	manager.Infinite = &payments.InfinitePay{DB: db, Key: bytes.Repeat([]byte{4}, 32), PublicURL: "https://fixture.example", Enabled: true, BaseURL: bank.URL, HTTP: bank.Client()}
	server := httptest.NewServer(httpapi.NewWithPayments(db, "", manager))
	defer server.Close()
	base := client{t: t, url: server.URL}
	register := func(name, email string) (client, string) {
		v := base.ok("POST", "/v1/auth/register", map[string]string{"name": name, "email": email, "password": "Synthetic-Checkout-42!"})
		return client{t: t, url: server.URL, token: v["token"].(string)}, v["user"].(map[string]any)["id"].(string)
	}
	adminEmail := core.ID() + "@manager.example.test"
	guardianEmail := core.ID() + "@guardian.example.test"
	admin, _ := register("Manager is not the buyer", adminEmail)
	parent, parentID := register("Responsible Parent", guardianEmail)
	academy := admin.ok("POST", "/v1/academies", map[string]string{"name": "Checkout Customer Fixture"})
	a := academy["id"].(string)
	prefix := "/v1/academies/" + a
	admin.ok("PUT", prefix+"/payment-integration", map[string]any{"handle": "fixture", "api_key": "inchk_synthetic_customer_fixture"})
	createStudent := func(name, email, cpf, birth, phone, alternate string) string {
		v := admin.ok("POST", prefix+"/students", map[string]any{"name": name, "email": email, "cpf": cpf, "birth_date": birth, "phone": phone, "alternate_phone": alternate, "status": "active"})
		return v["id"].(string)
	}
	sequence := 0
	invoice := func(student, name, doc string) string {
		sequence++
		id := core.ID()
		_, err := db.Exec(ctx, `INSERT INTO invoices(id,academy_id,student_id,competence,due_date,amount_cents,payer_name,payer_document) VALUES($1,$2,$3,(date_trunc('month',now())+($4::int*interval '1 month'))::date,current_date,15000,$5,$6)`, id, a, student, sequence, name, doc)
		if err != nil {
			t.Fatal(err)
		}
		return id
	}
	check := func(who client, id string, want map[string]any) {
		// Even an input body cannot override the server-resolved buyer.
		got := who.ok("POST", prefix+"/invoices/"+id+"/checkout", map[string]any{"customer": map[string]string{"name": "Forged", "email": adminEmail}})
		if got["status"] != "waiting" {
			t.Fatalf("checkout not ready: %v", got)
		}
		payload := <-captures
		customer, ok := payload["customer"].(map[string]any)
		if !ok {
			t.Fatal("missing customer")
		}
		if len(customer) != len(want) {
			t.Fatalf("unexpected customer keys: %v want %v", customer, want)
		}
		for key, value := range want {
			if customer[key] != value {
				t.Fatalf("customer %s: %v want %v", key, customer[key], value)
			}
		}
		if payload["address"] != nil || customer["cpf"] != nil {
			t.Fatal("unnecessary personal fields transmitted")
		}
	}
	adultCPF := testCPF()
	adultEmail := core.ID() + "@adult.example.test"
	adultID := createStudent("Adult Student", adultEmail, adultCPF, "1990-01-01", "(41) 99999-0000", "")
	adultInvoice := invoice(adultID, "Adult Student", adultCPF)
	check(admin, adultInvoice, map[string]any{"name": "Adult Student", "email": adultEmail, "phone_number": "+5541999990000"})
	// Updating a contact must not create another bank link for the same invoice.
	_, e = db.Exec(ctx, "UPDATE students SET phone='41988887777' WHERE academy_id=$1 AND id=$2", a, adultID)
	if e != nil {
		t.Fatal(e)
	}
	admin.ok("POST", prefix+"/invoices/"+adultInvoice+"/checkout", nil)
	if len(captures) != 0 {
		t.Fatal("contact update reissued checkout")
	}
	childEmail := core.ID() + "@child.example.test"
	childID := createStudent("Child Student", childEmail, testCPF(), "2015-01-01", "(41) 98888-7777", "")
	parentCPF := testCPF()
	membershipID := core.ID()
	for _, step := range []struct {
		sql  string
		args []any
	}{
		{"INSERT INTO guardian_profiles(academy_id,user_id,cpf,birth_date) VALUES($1,$2,$3,'1990-01-01')", []any{a, parentID, parentCPF}},
		{"INSERT INTO memberships(id,academy_id,user_id,status,student_code,qr_token) VALUES($1,$2,$3,'active',$4,$5)", []any{membershipID, a, parentID, core.Digits(), core.Token()}},
		{"INSERT INTO membership_roles(membership_id,role) VALUES($1,'guardian')", []any{membershipID}},
		{"INSERT INTO student_guardians(academy_id,student_id,user_id) VALUES($1,$2,$3)", []any{a, childID, parentID}},
	} {
		if _, err := db.Exec(ctx, step.sql, step.args...); err != nil {
			t.Fatal(err)
		}
	}
	check(parent, invoice(childID, "Responsible Parent", parentCPF), map[string]any{"name": "Responsible Parent", "email": guardianEmail, "phone_number": "+5541988887777"})
	// A revoked relationship does not provide parent contact to new links.
	admin.ok("DELETE", prefix+"/students/"+childID+"/portal-access/"+parentID, nil)
	check(admin, invoice(childID, "Responsible Parent", parentCPF), map[string]any{"name": "Responsible Parent"})
	legacy := createStudent("Legacy Child", core.ID()+"@legacy-child.example.test", testCPF(), "2016-01-01", "41977776666", "")
	check(admin, invoice(legacy, "Legacy Responsible", testCPF()), map[string]any{"name": "Legacy Responsible"})
	incompleteCPF := testCPF()
	incomplete := createStudent("Incomplete Adult", "", incompleteCPF, "1990-01-01", "not-a-phone", "(11) 3333-4444")
	check(admin, invoice(incomplete, "Incomplete Adult", incompleteCPF), map[string]any{"name": "Incomplete Adult", "phone_number": "+551133334444"})
}
