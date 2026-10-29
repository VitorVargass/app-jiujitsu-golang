package httpapi_test

import (
	"context"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"tatame/backend/internal/core"
	"tatame/backend/internal/database"
	"tatame/backend/internal/httpapi"
	"testing"
	"time"
)

func TestPeopleAndUniversalAttendance(t *testing.T) {
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
	register := func(name, email string) client {
		v := base.ok("POST", "/v1/auth/register", map[string]string{"name": name, "email": email, "password": "Tatame123!"})
		return client{t: t, url: server.URL, token: v["token"].(string)}
	}
	email := core.ID() + "@people.test"
	admin := register("Gestor que treina", email)
	outsider := register("Conta diferente", core.ID()+"@people.test")
	a := admin.ok("POST", "/v1/academies", map[string]string{"name": "Participação"})["id"].(string)
	prefix := "/v1/academies/" + a
	if code, _ := admin.request("POST", prefix+"/students", map[string]any{"name": "Contato inválido", "cpf": testCPF(), "birth_date": "1990-01-01", "email": "Alias <" + email + ">"}, ""); code != 422 {
		t.Fatal("display-name email bypassed canonical identity", code)
	}
	profile := admin.ok("GET", prefix+"/me/participation", nil)
	part := profile["participant_id"].(string)
	if profile["cpf"] != "" || profile["has_student_registration"] != false || profile["can_check_in"] != true {
		t.Fatal("manager participation unexpectedly enrolled", profile)
	}
	if p := admin.ok("GET", prefix+"/me/attendances?page=1", nil); p["total"] != float64(0) {
		t.Fatal("new manager history not empty")
	}
	cpf := testCPF()
	admin.ok("PATCH", prefix+"/me/participation", map[string]string{"cpf": cpf})
	if code, _ := outsider.request("GET", prefix+"/me/participation", nil, ""); code != 403 {
		t.Fatal("participation tenant isolation", code)
	}
	if code, _ := admin.request("PATCH", prefix+"/me/participation", map[string]string{"cpf": "11111111111"}, ""); code != 422 {
		t.Fatal("invalid CPF accepted", code)
	}
	var count int
	if err = db.QueryRow(ctx, "SELECT count(*) FROM students WHERE academy_id=$1", a).Scan(&count); err != nil || count != 0 {
		t.Fatal("manager got a student enrollment", err)
	}
	if err = db.QueryRow(ctx, "SELECT count(*) FROM invoices WHERE academy_id=$1", a).Scan(&count); err != nil || count != 0 {
		t.Fatal("manager got invoices", err)
	}
	mods := admin.list(prefix + "/modalities")
	mid := mods[0]["id"].(string)
	loc, _ := time.LoadLocation("America/Sao_Paulo")
	now := time.Now().In(loc)
	c := admin.ok("POST", prefix+"/classes", map[string]any{"name": "Treino de todos", "modality_id": mid, "active": true, "schedules": []any{map[string]any{"weekday": int(now.Weekday()), "start_time": "19:00", "duration_minutes": 60}}})
	schedule := c["schedules"].([]any)[0].(map[string]any)["id"].(string)
	session := admin.ok("POST", prefix+"/classes/"+c["id"].(string)+"/sessions", map[string]string{"schedule_id": schedule})["id"].(string)
	issue := func(name string) client {
		v := base.ok("POST", "/v1/auth/login", map[string]string{"email": email, "password": "Tatame123!"})
		manager := client{t: t, url: server.URL, token: v["token"].(string)}
		d := manager.ok("POST", prefix+"/devices", map[string]string{"name": name})
		return client{t: t, url: server.URL, token: d["token"].(string)}
	}
	kiosk, second := issue("Tablet principal"), issue("Tablet reserva")
	path := prefix + "/sessions/" + session + "/check-ins"
	key := core.ID()
	first := kiosk.okKey(path, map[string]string{"cpf": cpf}, key)
	if first["participant_id"] != part || first["student_id"] != nil {
		t.Fatal("staff identified as enrolled student")
	}
	if got := kiosk.okKey(path, map[string]string{"cpf": cpf}, key); got["id"] != first["id"] {
		t.Fatal("staff retry changed attendance")
	}
	if got := second.okKey(path, map[string]string{"qr_token": profile["qr_token"].(string)}, core.ID()); got["id"] != first["id"] {
		t.Fatal("two devices duplicated staff presence")
	}
	if code, _ := kiosk.request("PATCH", prefix+"/me/participation", map[string]string{"cpf": testCPF()}, ""); code != 403 {
		t.Fatal("device changed personal data", code)
	}
	history := admin.ok("GET", prefix+"/me/attendances?page=1", nil)
	if history["total"] != float64(1) {
		t.Fatal("manager history unavailable")
	}
	studentBody := map[string]any{"name": "Gestor que treina", "email": strings.ToUpper(" " + email + " "), "cpf": cpf, "birth_date": "1990-04-12", "status": "active"}
	if code, _ := admin.request("POST", prefix+"/students", studentBody, ""); code != 409 {
		t.Fatal("existing identity reused silently", code)
	}
	studentBody["use_my_account"] = true
	if code, _ := admin.request("POST", prefix+"/students", studentBody, ""); code != 409 {
		t.Fatal("own-account flag bypassed duplicate email", code)
	}
	st := legacyStudent(t, db, admin, a, studentBody)
	sid := st["id"].(string)
	if st["participant_id"] != part || st["user_id"] == "" {
		t.Fatal("self enrollment duplicated participation")
	}
	if got := kiosk.okKey(path, map[string]string{"cpf": cpf}, core.ID()); got["id"] != first["id"] {
		t.Fatal("enrollment duplicated earlier manager presence")
	}
	if h := admin.ok("GET", prefix+"/attendances?student_id="+sid+"&page=1", nil); h["total"] != float64(1) {
		t.Fatal("history lost after enrollment")
	}
	if code, _ := admin.request("POST", prefix+"/students", studentBody, ""); code != 409 {
		t.Fatal("duplicate financial enrollment", code)
	}
	studentBody["email"] = core.ID() + "@changed.test"
	if code, _ := admin.request("PATCH", prefix+"/students/"+sid, studentBody, ""); code != 422 {
		t.Fatal("student form changed login identity", code)
	}
	studentBody["email"] = email
	admin.ok("POST", prefix+"/students/"+sid+"/archive", nil)
	// An active manager still trains independently of archived commercial enrollment.
	prof := admin.ok("GET", prefix+"/me/participation", nil)
	if prof["can_check_in"] != true {
		t.Fatal("archive removed active manager participation")
	}
	admin.ok("POST", prefix+"/students/"+sid+"/restore", nil)
	if err = db.QueryRow(ctx, "SELECT count(*) FROM invoices WHERE academy_id=$1", a).Scan(&count); err != nil || count != 0 {
		t.Fatal("self enrollment enabled billing")
	}
	// A pending student contact can create a login, but gets no academy access before its own invitation.
	pendingEmail := core.ID() + "@pending.test"
	body := map[string]any{"name": "Pessoa convidada", "email": pendingEmail, "cpf": testCPF(), "birth_date": "1995-01-10", "status": "active"}
	invited := admin.ok("POST", prefix+"/students", body)
	owner := register("Pessoa convidada", pendingEmail)
	if code, _ := owner.request("GET", prefix+"/me/attendances?page=1", nil, ""); code != 403 {
		t.Fatal("registration granted pending participation", code)
	}
	inv := admin.ok("POST", prefix+"/students/"+invited["id"].(string)+"/invitations", nil)
	acceptPath := "/v1/invitations/" + inv["token"].(string) + "/accept"
	if code, _ := outsider.request("POST", acceptPath, nil, ""); code != 403 {
		t.Fatal("wrong account accepted invitation", code)
	}
	linked := owner.ok("POST", acceptPath, nil)
	if linked["person_id"] != invited["person_id"] || linked["user_id"] == "" {
		t.Fatal("invitation duplicated identity")
	}
	if code, _ := owner.request("POST", acceptPath, nil, ""); code != 410 {
		t.Fatal("invitation reused", code)
	}
	if h := owner.ok("GET", prefix+"/me/attendances?page=1&participant_id="+part, nil); h["total"] != float64(0) {
		t.Fatal("own endpoint honored forged participant")
	}
	if code, _ := owner.request("GET", prefix+"/attendances?participant_id="+part+"&page=1", nil, ""); code != 403 {
		t.Fatal("student read staff history", code)
	}
	// A second administrative registration cannot reuse an existing identity.
	b := outsider.ok("POST", "/v1/academies", map[string]string{"name": "Segunda academia"})["id"].(string)
	body["reuse_existing_identity"] = true
	if code, _ := outsider.request("POST", "/v1/academies/"+b+"/students", body, ""); code != 409 {
		t.Fatal("duplicate identity accepted", code)
	}
	if code, _ := owner.request("GET", "/v1/academies/"+b+"/me/participation", nil, ""); code != 403 {
		t.Fatal("duplicate email granted access", code)
	}
	// Database-level race protection: two creation attempts cannot store two identities.
	raceEmail := core.ID() + "@race.test"
	var wg sync.WaitGroup
	codes := make(chan int, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			payload := map[string]any{"name": "Concorrente", "email": raceEmail, "cpf": testCPF(), "birth_date": "1990-01-01", "status": "active"}
			code, _ := admin.request("POST", prefix+"/students", payload, "")
			codes <- code
		}()
	}
	wg.Wait()
	close(codes)
	ok, conflict := 0, 0
	for code := range codes {
		if code == 200 {
			ok++
		} else if code == 409 {
			conflict++
		} else {
			t.Fatal("unexpected concurrent create", code)
		}
	}
	if ok != 1 || conflict != 1 {
		t.Fatal("concurrent identity duplication", ok, conflict)
	}
	if err = db.QueryRow(ctx, "SELECT count(*) FROM people WHERE email=$1", raceEmail).Scan(&count); err != nil || count != 1 {
		t.Fatal("duplicate canonical email", err)
	}
	if err = db.QueryRow(ctx, "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND column_name='email'").Scan(&count); err != nil || count != 1 {
		t.Fatal("email has multiple database sources", err)
	}
}
