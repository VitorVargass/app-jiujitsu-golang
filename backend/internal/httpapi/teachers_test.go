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

func assertAcademicResponse(t *testing.T, value any) {
	t.Helper()
	switch v := value.(type) {
	case map[string]any:
		for key, item := range v {
			switch key {
			case "billing", "amount_cents", "charge_mode", "plan_id", "payer_document", "payer_name", "received_month_cents", "open_cents":
				t.Fatalf("academic response leaked %s", key)
			}
			assertAcademicResponse(t, item)
		}
	case []any:
		for _, item := range v {
			assertAcademicResponse(t, item)
		}
	}
}

func TestTeachersAcademicAccess(t *testing.T) {
	address := os.Getenv("TEST_DATABASE_URL")
	if address == "" {
		t.Skip("dedicated PostgreSQL required")
	}
	if err := database.Migrate(address); err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	db, err := database.Open(ctx, address)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	server := httptest.NewServer(httpapi.New(db, ""))
	defer server.Close()
	base := client{t: t, url: server.URL}
	password := "Professor42!"
	register := func(name string) (client, string) {
		email := core.ID() + "@teachers.test"
		v := base.ok("POST", "/v1/auth/register", map[string]string{"name": name, "email": email, "password": password})
		return client{t: t, url: server.URL, token: v["token"].(string)}, email
	}
	owner, _ := register("Dono professores")
	outsider, outsiderEmail := register("Professor existente")
	academy := owner.ok("POST", "/v1/academies", map[string]string{"name": "Academia professores"})
	a := academy["id"].(string)
	prefix := "/v1/academies/" + a
	other := outsider.ok("POST", "/v1/academies", map[string]string{"name": "Outra academia"})
	otherPrefix := "/v1/academies/" + other["id"].(string)
	created := owner.ok("POST", prefix+"/teachers", map[string]string{"name": "Professor novo", "email": core.ID() + "@teachers.test", "password": password})
	login := base.ok("POST", "/v1/auth/login", map[string]string{"email": created["email"].(string), "password": password})
	teacher := client{t: t, url: server.URL, token: login["token"].(string)}
	if created["password"] != nil || created["token"] != nil {
		t.Fatal("credentials leaked")
	}
	if status, _ := owner.request("POST", prefix+"/teachers", map[string]any{"email": created["email"], "link_existing": true}, ""); status != 409 {
		t.Fatal("duplicate teacher", status)
	}
	if status, _ := owner.request("POST", prefix+"/teachers", map[string]any{"name": "Do not change", "email": outsiderEmail, "password": "Changed123!"}, ""); status != 409 {
		t.Fatal("existing account confirmation", status)
	}
	linked := owner.ok("POST", prefix+"/teachers", map[string]any{"email": outsiderEmail, "link_existing": true})
	base.ok("POST", "/v1/auth/login", map[string]string{"email": outsiderEmail, "password": password})
	if len(outsider.list("/v1/me/academies")) != 2 {
		t.Fatal("other academy lost")
	}
	mods := owner.list(prefix + "/modalities")
	modality := mods[0]["id"].(string)
	student := owner.ok("POST", prefix+"/students", map[string]any{"name": "Aluno acadêmico", "cpf": testCPF(), "email": core.ID() + "@teachers.test", "status": "active", "birth_date": "2000-01-01", "modality_ids": []string{modality}, "billing": map[string]any{"enabled": true, "amount_cents": 12345, "due_day": 10, "first_month": "2030-01", "payer_name": "Pagador privado", "payer_document": "52998224725"}})
	sid := student["id"].(string)
	var invoicesBefore int
	if err = db.QueryRow(ctx, "SELECT count(*) FROM invoices WHERE academy_id=$1", a).Scan(&invoicesBefore); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"/academic/students?page=1", "/academic/students/" + sid, "/students/" + sid + "/progress?page=1", "/dashboard?role=teacher"} {
		assertAcademicResponse(t, teacher.ok("GET", prefix+path, nil))
	}
	for _, m := range teacher.list(prefix + "/academic/modalities") {
		assertAcademicResponse(t, m)
	}
	graduation := teacher.ok("PATCH", prefix+"/academic/students/"+sid+"/graduations/"+modality, map[string]any{"belt": "Faixa Azul", "degrees": 2})
	assertAcademicResponse(t, graduation)
	assertAcademicResponse(t, teacher.ok("PATCH", prefix+"/students/"+sid+"/graduations/"+modality, map[string]any{"belt": "Faixa Azul", "degrees": 3}))
	full := owner.ok("GET", prefix+"/students/"+sid, nil)
	if full["billing"] == nil {
		t.Fatal("manager lost financial data")
	}
	var invoicesAfter int
	if err = db.QueryRow(ctx, "SELECT count(*) FROM invoices WHERE academy_id=$1", a).Scan(&invoicesAfter); err != nil || invoicesAfter != invoicesBefore {
		t.Fatal("graduation changed invoice count", err)
	}
	if full["billing"].(map[string]any)["amount_cents"] != float64(12345) {
		t.Fatal("graduation changed the financial contract")
	}
	progress := teacher.ok("GET", prefix+"/students/"+sid+"/progress?page=1", nil)
	found := false
	for _, raw := range progress["history"].(map[string]any)["items"].([]any) {
		if raw.(map[string]any)["actor_name"] == "Professor novo" {
			found = true
		}
	}
	if !found {
		t.Fatal("graduation actor missing")
	}
	// This class belongs to another professor, and manual entry must still work.
	class := owner.ok("POST", prefix+"/classes", map[string]string{"name": "Turma de outro professor", "teacher_membership_id": linked["id"].(string), "modality_id": modality})
	loc, _ := time.LoadLocation("America/Sao_Paulo")
	day := time.Now().In(loc).AddDate(0, 0, -1)
	schedule := owner.ok("POST", prefix+"/classes/"+class["id"].(string)+"/schedules", map[string]any{"weekday": int(day.Weekday()), "start_time": "10:00", "duration_minutes": 60})
	input := map[string]string{"student_id": sid, "schedule_id": schedule["id"].(string), "date": day.Format("2006-01-02")}
	first := teacher.okKey(prefix+"/attendances", input, core.ID())
	second := teacher.okKey(prefix+"/attendances", input, core.ID())
	if first["id"] != second["id"] {
		t.Fatal("duplicate attendance")
	}
	teacher.list(prefix + "/sessions/" + first["session_id"].(string) + "/attendances")
	// All prohibited actions must be rejected even when requested directly.
	for _, test := range []struct {
		method, path string
		body         any
	}{
		{"GET", "/invoices", nil}, {"GET", "/payment-integration", nil}, {"GET", "/subscription", nil}, {"GET", "/subscription/history", nil}, {"GET", "/students/" + sid + "/billing-forecast", nil}, {"GET", "/students/" + sid, nil}, {"GET", "/plans", nil}, {"GET", "/modalities", nil}, {"GET", "/teachers", nil}, {"GET", "/managers", nil},
		{"POST", "/teachers", map[string]any{"email": outsiderEmail, "link_existing": true}}, {"DELETE", "/teachers/" + linked["id"].(string), nil}, {"PATCH", "/members/" + created["id"].(string), map[string]any{"roles": []string{"admin"}}}, {"POST", "/students", map[string]string{"name": "Proibido"}}, {"PATCH", "/students/" + sid, map[string]string{"name": "Proibido"}}, {"POST", "/students/" + sid + "/archive", nil}, {"POST", "/classes", map[string]string{"name": "Proibido"}},
	} {
		if status, _ := teacher.request(test.method, prefix+test.path, test.body, ""); status != 403 {
			t.Fatalf("%s %s: %d", test.method, test.path, status)
		}
	}
	if status, _ := teacher.request("GET", otherPrefix+"/academic/students", nil, ""); status != 403 {
		t.Fatal("cross academy", status)
	}
	owner.ok("POST", prefix+"/students/"+sid+"/archive", nil)
	archived := teacher.ok("GET", prefix+"/academic/students?status=archived&page=1", nil)
	if archived["total"].(float64) != 1 {
		t.Fatal("archived student unavailable")
	}
	if status, _ := teacher.request("PATCH", prefix+"/academic/students/"+sid+"/graduations/"+modality, map[string]any{"belt": "Faixa Azul", "degrees": 1}, ""); status != 409 {
		t.Fatal("archived graduation", status)
	}
	if status, _ := teacher.request("POST", prefix+"/attendances", input, core.ID()); status != 410 {
		t.Fatal("archived attendance", status)
	}
	owner.ok("PATCH", prefix+"/members/"+created["id"].(string), map[string]string{"status": "blocked"})
	if status, _ := teacher.request("GET", prefix+"/academic/students", nil, ""); status != 403 {
		t.Fatal("blocked teacher", status)
	}
	owner.ok("PATCH", prefix+"/members/"+created["id"].(string), map[string]string{"status": "active"})
	// An ordinary manager can administer teachers, and removing the teacher role preserves admin.
	owner.ok("POST", prefix+"/managers", map[string]any{"email": created["email"], "link_existing": true})
	assertAcademicResponse(t, teacher.ok("GET", prefix+"/academic/students/"+sid, nil))
	teacher.ok("DELETE", prefix+"/teachers/"+linked["id"].(string), nil)
	outsider.ok("GET", otherPrefix+"/managers", nil)
	if status, _ := outsider.request("GET", prefix+"/academic/students", nil, ""); status != 403 {
		t.Fatal("removed teacher access", status)
	}
	owner.ok("DELETE", prefix+"/teachers/"+created["id"].(string), nil)
	teacher.list(prefix + "/managers")
}
