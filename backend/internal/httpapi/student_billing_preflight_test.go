package httpapi_test

import (
	"context"
	"net/http/httptest"
	"os"
	"tatame/backend/internal/core"
	"tatame/backend/internal/database"
	"tatame/backend/internal/httpapi"
	"testing"
	"time"
)

func TestStudentIdentityPreflightAndFutureBilling(t *testing.T) {
	address := os.Getenv("TEST_DATABASE_URL")
	if address == "" {
		t.Skip("isolated PostgreSQL required")
	}
	if e := database.Migrate(address); e != nil {
		t.Fatal(e)
	}
	db, e := database.Open(context.Background(), address)
	if e != nil {
		t.Fatal(e)
	}
	defer db.Close()
	server := httptest.NewServer(httpapi.New(db, ""))
	defer server.Close()
	base := client{t: t, url: server.URL}
	register := func() client {
		v := base.ok("POST", "/v1/auth/register", map[string]string{"name": "Gestor QA", "email": core.ID() + "@preflight.test", "password": "Tatame123!"})
		return client{t: t, url: server.URL, token: v["token"].(string)}
	}
	admin, other := register(), register()
	a := admin.ok("POST", "/v1/academies", map[string]string{"name": "Academia QA"})["id"].(string)
	prefix := "/v1/academies/" + a
	loc, _ := time.LoadLocation("America/Sao_Paulo")
	now := time.Now().In(loc)
	next := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, loc).Format("2006-01")
	cpf, email := testCPF(), core.ID()+"@student.test"
	body := map[string]any{"name": "Aluno QA", "cpf": cpf, "email": email, "phone": "(41) 99999-8765", "birth_date": "2000-01-01", "status": "active", "billing": map[string]any{"enabled": true, "amount_cents": 16000, "due_day": 15, "first_month": next}}
	student := admin.ok("POST", prefix+"/students", body)
	sid := student["id"].(string)
	list := admin.ok("GET", prefix+"/invoices?student_id="+sid, nil)
	items := list["items"].([]any)
	if len(items) != 1 {
		t.Fatal("expected one future invoice", list)
	}
	invoice := items[0].(map[string]any)
	if invoice["competence"] != next || invoice["due_date"] != next+"-15" || invoice["status"] != "open" {
		t.Fatal("wrong first due", invoice)
	}
	probe := map[string]string{"email": email, "cpf": cpf, "phone": "+55 41 99999-8765"}
	result := admin.ok("POST", prefix+"/students/check-identity", probe)
	if result["email_exists"] != true || result["cpf_exists"] != true || result["phone_exists"] != true {
		t.Fatal("missed duplicate", result)
	}
	probe["student_id"] = sid
	result = admin.ok("POST", prefix+"/students/check-identity", probe)
	if result["email_exists"] != false || result["cpf_exists"] != false || result["phone_exists"] != false {
		t.Fatal("self edit conflict", result)
	}
	if code, _ := other.request("POST", prefix+"/students/check-identity", probe, ""); code != 403 {
		t.Fatal("cross academy access", code)
	}
	delete(probe, "student_id")
	probe["cpf"] = "11111111111"
	if code, _ := admin.request("POST", prefix+"/students/check-identity", probe, ""); code != 422 {
		t.Fatal("invalid CPF", code)
	}
	// A newly enabled contract on a day already passed must not produce arrears.
	if now.Day() > 1 {
		body["cpf"], body["email"] = testCPF(), core.ID()+"@student.test"
		body["billing"].(map[string]any)["first_month"] = now.Format("2006-01")
		body["billing"].(map[string]any)["due_day"] = 1
		second := admin.ok("POST", prefix+"/students", body)
		list = admin.ok("GET", prefix+"/invoices?student_id="+second["id"].(string), nil)
		first := list["items"].([]any)[0].(map[string]any)
		if first["competence"] != next || first["status"] != "open" {
			t.Fatal("new invoice born overdue", first)
		}
	}
}
