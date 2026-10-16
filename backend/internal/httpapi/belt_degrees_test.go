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

func TestBeltDegreesPersistValidateAndAppearInAttendance(t *testing.T) {
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
	adminEmail := core.ID() + "@degrees.test"
	account := base.ok("POST", "/v1/auth/register", map[string]string{"name": "Gestor Graus", "email": adminEmail, "password": "Tatame123!"})
	admin := client{t: t, url: server.URL, token: account["token"].(string)}
	a := admin.ok("POST", "/v1/academies", map[string]string{"name": "Academia Graus"})["id"].(string)
	prefix := "/v1/academies/" + a
	ids := map[string]string{}
	for _, m := range admin.list(prefix + "/modalities") {
		ids[m["name"].(string)] = m["id"].(string)
	}
	jj, ng := ids["Jiu-Jitsu"], ids["No-Gi"]
	body := func(j, n any) map[string]any {
		return map[string]any{
			"birth_date": "2012-04-12", "cpf": testCPF(), "name": "Aluno com graus", "status": "active", "charge_mode": "modalities", "modality_ids": []string{jj, ng},
			"modality_details": []any{
				map[string]any{"modality_id": jj, "belt": "Faixa Branca", "degrees": j, "amount_cents": 0},
				map[string]any{"modality_id": ng, "belt": "Faixa Azul", "degrees": n, "amount_cents": 0},
			},
		}
	}
	ranks := func(s map[string]any) map[string]int {
		t.Helper()
		out := map[string]int{}
		for _, raw := range s["modality_details"].([]any) {
			d := raw.(map[string]any)
			out[d["modality_id"].(string)] = int(d["degrees"].(float64))
		}
		return out
	}
	s := admin.ok("POST", prefix+"/students", body(2, 4))
	sid := s["id"].(string)
	if got := ranks(s); got[jj] != 2 || got[ng] != 4 {
		t.Fatal("independent degrees lost", got)
	}
	if got := ranks(admin.ok("GET", prefix+"/students/"+sid, nil)); got[jj] != 2 || got[ng] != 4 {
		t.Fatal("reload lost degrees", got)
	}

	studentLogin := base.ok("POST", "/v1/auth/register", map[string]string{"name": "Aluno Graus", "email": core.ID() + "@degrees.test", "password": "Tatame123!"})
	student := client{t: t, url: server.URL, token: studentLogin["token"].(string)}
	invite := admin.ok("POST", prefix+"/students/"+sid+"/invitations", nil)
	student.ok("POST", "/v1/invitations/"+invite["token"].(string)+"/accept", nil)
	if qr := student.ok("GET", prefix+"/me/student-credential", nil); qr["belt"] != "Faixa Branca • 2 graus" {
		t.Fatal("QR rank omitted degrees", qr)
	}

	loc, _ := time.LoadLocation("America/Sao_Paulo")
	now := time.Now().In(loc)
	course := admin.ok("POST", prefix+"/classes", map[string]string{"name": "No-Gi Graus", "modality_id": ng})
	schedule := admin.ok("POST", prefix+"/classes/"+course["id"].(string)+"/schedules", map[string]any{"weekday": int(now.Weekday()), "start_time": "19:00", "duration_minutes": 60})
	session := admin.ok("POST", prefix+"/classes/"+course["id"].(string)+"/sessions", map[string]string{"schedule_id": schedule["id"].(string)})
	otherLogin := base.ok("POST", "/v1/auth/login", map[string]string{"email": adminEmail, "password": "Tatame123!"})
	provisioner := client{t: t, url: server.URL, token: otherLogin["token"].(string)}
	device := provisioner.ok("POST", prefix+"/devices", map[string]string{"name": "Tablet Graus"})
	kiosk := client{t: t, url: server.URL, token: device["token"].(string)}
	checkPath := prefix + "/sessions/" + session["id"].(string) + "/check-ins"
	checkBody := map[string]string{"student_code": s["student_code"].(string)}
	key := core.ID()
	if code, result := kiosk.request("POST", checkPath, checkBody, key); code != 200 || result["belt"] != "Faixa Azul • 4 graus" {
		t.Fatal("check-in rank wrong", code, result)
	}
	if rows := admin.list(prefix + "/sessions/" + session["id"].(string) + "/attendances"); len(rows) != 1 || rows[0]["belt"] != "Faixa Azul • 4 graus" {
		t.Fatal("attendance rank wrong", rows)
	}
	if history := student.ok("GET", prefix+"/me/attendances?page=1", nil); history["items"].([]any)[0].(map[string]any)["belt"] != "Faixa Azul • 4 graus" {
		t.Fatal("student history rank wrong", history)
	}

	admin.ok("PATCH", prefix+"/students/"+sid, body(3, 1))
	legacy := body(0, 0)
	for _, raw := range legacy["modality_details"].([]any) {
		delete(raw.(map[string]any), "degrees")
	}
	kept := admin.ok("PATCH", prefix+"/students/"+sid, legacy)
	if got := ranks(kept); got[jj] != 3 || got[ng] != 1 {
		t.Fatal("older client erased degrees", got)
	}
	legacy["modality_details"].([]any)[0].(map[string]any)["belt"] = "Faixa Azul"
	if got := ranks(admin.ok("PATCH", prefix+"/students/"+sid, legacy)); got[jj] != 0 || got[ng] != 1 {
		t.Fatal("new belt inherited degrees", got)
	}
	if code, result := kiosk.request("POST", checkPath, checkBody, key); code != 200 || result["belt"] != "Faixa Azul • 4 graus" {
		t.Fatal("idempotent result changed", code, result)
	}
	if got := ranks(admin.ok("PATCH", prefix+"/students/"+sid, body(0, 0))); got[jj] != 0 || got[ng] != 0 {
		t.Fatal("explicit zero not saved", got)
	}

	for _, invalid := range []any{-1, 5, 1.5, "2"} {
		code, _ := admin.request("POST", prefix+"/students", body(invalid, 0), "")
		if code != 400 && code != 422 {
			t.Fatalf("invalid degree %v accepted: %d", invalid, code)
		}
	}
	if _, err = db.Exec(ctx, "UPDATE student_modalities SET degrees=5 WHERE academy_id=$1 AND student_id=$2", a, sid); err == nil {
		t.Fatal("database accepted invalid degrees")
	}

	noBelt := admin.ok("POST", prefix+"/modalities", map[string]any{"name": "Funcional", "active": true, "amount_cents": 0, "belt_options": []any{}})
	free := map[string]any{"birth_date": "2012-04-12", "cpf": testCPF(), "name": "Aluno sem faixa", "status": "active", "charge_mode": "modalities", "modality_ids": []string{noBelt["id"].(string)}, "modality_details": []any{map[string]any{"modality_id": noBelt["id"], "belt": "", "degrees": 1, "amount_cents": 0}}}
	if code, _ := admin.request("POST", prefix+"/students", free, ""); code != 422 {
		t.Fatal("no-belt modality accepted degree", code)
	}
	free["modality_details"].([]any)[0].(map[string]any)["degrees"] = 0
	admin.ok("POST", prefix+"/students", free)
	var invoices int
	if err = db.QueryRow(ctx, "SELECT count(*) FROM invoices WHERE academy_id=$1", a).Scan(&invoices); err != nil || invoices != 0 {
		t.Fatal("degree updates created invoices", invoices, err)
	}
}
