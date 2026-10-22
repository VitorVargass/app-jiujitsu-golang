package httpapi_test

import (
	"context"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"tatame/backend/internal/core"
	"tatame/backend/internal/database"
	"tatame/backend/internal/httpapi"
)

func TestFiveDigitStudentNumbers(t *testing.T) {
	address := os.Getenv("TEST_DATABASE_URL")
	if address == "" {
		t.Skip("dedicated PostgreSQL required")
	}
	if err := database.Migrate(address); err != nil {
		t.Fatal(err)
	}
	db, err := database.Open(context.Background(), address)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	server := httptest.NewServer(httpapi.New(db, "http://localhost:8081"))
	defer server.Close()
	base := client{t: t, url: server.URL}
	register := func(name string) client {
		account := base.ok("POST", "/v1/auth/register", map[string]string{"name": name, "email": core.ID() + "@numbers.test", "password": "Tatame123!"})
		return client{t: t, url: server.URL, token: account["token"].(string)}
	}
	admin, outsider, student := register("Gestor Numeros"), register("Outra Conta"), register("Aluno Numeros")
	academy := admin.ok("POST", "/v1/academies", map[string]string{"name": "Academia Numeros"})
	prefix := "/v1/academies/" + academy["id"].(string)
	created := admin.ok("POST", prefix+"/students", map[string]any{"name": "Aluno Numeros", "email": getEmail(t, db, student.token), "reuse_existing_identity": true, "birth_date": "2012-04-12", "cpf": testCPF()})
	code, id := created["student_code"].(string), created["id"].(string)
	if !core.ValidStudentCode(code) {
		t.Fatal("new student does not have five digits")
	}
	card := admin.ok("GET", prefix+"/students/"+id+"/credential", nil)
	qr := card["qr_token"].(string)
	if card["student_code"] != code {
		t.Fatal("card number differs from registration")
	}
	if status, _ := outsider.request("GET", prefix+"/students/"+id+"/credential", nil, ""); status != 403 {
		t.Fatal("outsider read child card", status)
	}
	found := admin.ok("GET", prefix+"/students?search="+code, nil)
	if found["total"] != float64(1) {
		t.Fatal("search by student number failed")
	}
	invitation := admin.ok("POST", prefix+"/students/"+id+"/invitations", nil)
	student.ok("POST", "/v1/invitations/"+invitation["token"].(string)+"/accept", nil)
	own := student.ok("GET", prefix+"/me/student-credential", nil)
	if own["student_code"] != code || own["qr_token"] != qr {
		t.Fatal("student card differs from manager card")
	}
	class := admin.ok("POST", prefix+"/classes", map[string]string{"name": "Treino Numeros"})
	location, _ := time.LoadLocation("America/Sao_Paulo")
	now := time.Now().In(location)
	schedule := admin.ok("POST", prefix+"/classes/"+class["id"].(string)+"/schedules", map[string]any{"weekday": int(now.Weekday()), "start_time": now.Format("15:04"), "duration_minutes": 60})
	login := base.ok("POST", "/v1/auth/login", map[string]string{"email": getEmail(t, db, admin.token), "password": "Tatame123!"})
	provisioner := client{t: t, url: server.URL, token: login["token"].(string)}
	activated := provisioner.ok("POST", prefix+"/devices", map[string]string{"name": "Tablet Numeros"})
	device := client{t: t, url: server.URL, token: activated["token"].(string)}
	path := prefix + "/check-ins"
	body := map[string]string{"student_code": code, "schedule_id": schedule["id"].(string), "date": now.Format("2006-01-02")}
	key := core.ID()
	first := device.okKey(path, body, key)
	if again := device.okKey(path, body, key); again["id"] != first["id"] {
		t.Fatal("five digit retry not idempotent")
	}
	if status, _ := device.request("GET", prefix+"/students/"+id+"/credential", nil, ""); status != 403 {
		t.Fatal("tablet read card", status)
	}
	for _, invalid := range []string{"1234", "123456", "12345678", "12a45", "１２３４５"} {
		if status, _ := device.request("POST", path, map[string]string{"student_code": invalid}, core.ID()); status != 422 {
			t.Fatal("malformed number accepted", invalid, status)
		}
	}
	if status, _ := device.request("POST", path, map[string]string{"student_code": code, "qr_token": qr}, core.ID()); status != 422 {
		t.Fatal("mixed identifiers accepted", status)
	}
	admin.ok("POST", prefix+"/students/"+id+"/archive", nil)
	if status, _ := device.request("POST", path, body, core.ID()); status != 410 {
		t.Fatal("archived student checked in", status)
	}
	archived := admin.ok("GET", prefix+"/students?search="+code, nil)
	if archived["total"] != float64(1) {
		t.Fatal("archived student cannot be found by number")
	}
	restored := admin.ok("POST", prefix+"/students/"+id+"/restore", nil)
	if restored["student_code"] != code {
		t.Fatal("restoring changed permanent code")
	}
	if card := admin.ok("GET", prefix+"/students/"+id+"/credential", nil); card["qr_token"] != qr {
		t.Fatal("restore changed QR")
	}
	if again := device.okKey(path, map[string]string{"qr_token": qr, "schedule_id": schedule["id"].(string), "date": now.Format("2006-01-02")}, core.ID()); again["id"] != first["id"] {
		t.Fatal("QR produced second attendance")
	}
}
