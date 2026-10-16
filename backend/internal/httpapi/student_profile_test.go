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

func TestDirectGraduationAndDeviceExit(t *testing.T) {
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
	email := core.ID() + "@profile.test"
	login := base.ok("POST", "/v1/auth/register", map[string]string{"name": "Gestor Perfil", "email": email, "password": "Tatame123!"})
	admin := client{t: t, url: server.URL, token: login["token"].(string)}
	a := admin.ok("POST", "/v1/academies", map[string]string{"name": "Academia Perfil"})["id"].(string)
	prefix := "/v1/academies/" + a
	ids := map[string]string{}
	for _, m := range admin.list(prefix + "/modalities") {
		ids[m["name"].(string)] = m["id"].(string)
	}
	jj, ng := ids["Jiu-Jitsu"], ids["No-Gi"]
	month := time.Now().In(time.FixedZone("BR", -10800)).Format("2006-01")
	s := admin.ok("POST", prefix+"/students", map[string]any{"birth_date": "2012-04-12", "name": "Aluno Perfil", "cpf": testCPF(), "charge_mode": "modalities", "modality_details": []any{map[string]any{"modality_id": jj, "belt": "Faixa Branca", "degrees": 1, "amount_cents": 15000}, map[string]any{"modality_id": ng, "belt": "Faixa Azul", "degrees": 3, "amount_cents": 7000}}, "billing": map[string]any{"enabled": true, "amount_cents": 22000, "due_day": 10, "first_month": month, "payer_name": "Responsável", "payer_document": "52998224725"}})
	id := s["id"].(string)
	gradePath := prefix + "/students/" + id + "/graduations/" + jj
	var before int
	if err = db.QueryRow(ctx, "SELECT count(*) FROM invoices WHERE academy_id=$1 AND student_id=$2", a, id).Scan(&before); err != nil {
		t.Fatal(err)
	}
	// Even an overdue generation cursor must not be touched by a rank-only edit.
	if _, err = db.Exec(ctx, "UPDATE student_billing SET next_month='2026-01-01' WHERE academy_id=$1 AND student_id=$2", a, id); err != nil {
		t.Fatal(err)
	}
	changed := admin.ok("PATCH", gradePath, map[string]any{"belt": "Faixa Azul", "degrees": 4})
	ranks := map[string]map[string]any{}
	for _, raw := range changed["modality_details"].([]any) {
		d := raw.(map[string]any)
		ranks[d["modality_id"].(string)] = d
	}
	if ranks[jj]["belt"] != "Faixa Azul" || ranks[jj]["degrees"] != float64(4) || ranks[ng]["degrees"] != float64(3) {
		t.Fatal("independent rank edit failed")
	}
	b := changed["billing"].(map[string]any)
	if b["amount_cents"] != float64(22000) || b["due_day"] != float64(10) || b["first_month"] != "2026-01" || b["enabled"] != true {
		t.Fatal("rank edit rewrote contract")
	}
	var after int
	if err = db.QueryRow(ctx, "SELECT count(*) FROM invoices WHERE academy_id=$1 AND student_id=$2", a, id).Scan(&after); err != nil || after != before {
		t.Fatal("rank edit generated invoices", err)
	}
	for _, invalid := range []map[string]any{{"belt": "Faixa inválida", "degrees": 0}, {"belt": "Faixa Azul", "degrees": 5}, {"belt": "Faixa Azul", "degrees": -1}, {"belt": "Faixa Azul", "degrees": 1.5}} {
		if code, _ := admin.request("PATCH", gradePath, invalid, ""); code != 422 && code != 400 {
			t.Fatal("invalid grade accepted", code)
		}
	}
	if code, _ := admin.request("PATCH", prefix+"/students/"+id+"/graduations/"+ids["Muay Thai"], map[string]any{"belt": "", "degrees": 0}, ""); code != 404 {
		t.Fatal("unassigned modality edited", code)
	}
	outsiderData := base.ok("POST", "/v1/auth/register", map[string]string{"name": "Outro Gestor", "email": core.ID() + "@profile.test", "password": "Tatame123!"})
	outsider := client{t: t, url: server.URL, token: outsiderData["token"].(string)}
	if code, _ := outsider.request("PATCH", gradePath, map[string]any{"belt": "Faixa Branca", "degrees": 0}, ""); code != 403 {
		t.Fatal("rank tenant isolation", code)
	}
	admin.ok("POST", prefix+"/students/"+id+"/archive", nil)
	if code, _ := admin.request("PATCH", gradePath, map[string]any{"belt": "Faixa Branca", "degrees": 0}, ""); code != 409 {
		t.Fatal("archived student edited", code)
	}
	// Device credentials may end only their own access in their own academy.
	issue := func(name string) client {
		data := base.ok("POST", "/v1/auth/login", map[string]string{"email": email, "password": "Tatame123!"})
		manager := client{t: t, url: server.URL, token: data["token"].(string)}
		credential := manager.ok("POST", prefix+"/devices", map[string]string{"name": name})
		return client{t: t, url: server.URL, token: credential["token"].(string)}
	}
	first, second := issue("Recepção principal"), issue("Recepção reserva")
	devices := admin.list(prefix + "/devices")
	if len(devices) != 2 {
		t.Fatal("devices missing")
	}
	for _, d := range devices {
		if _, err := time.Parse(time.RFC3339Nano, d["created_at"].(string)); err != nil {
			t.Fatal("device activation date missing", err)
		}
		if _, secret := d["token"]; secret {
			t.Fatal("device secret in listing")
		}
	}
	if code, _ := admin.request("DELETE", prefix+"/devices/current", nil, ""); code != 403 {
		t.Fatal("manager used device exit", code)
	}
	if code, _ := first.request("DELETE", "/v1/academies/"+core.ID()+"/devices/current", nil, ""); code != 403 {
		t.Fatal("device ended another academy access", code)
	}
	if code, _ := first.request("PATCH", gradePath, map[string]any{"belt": "Faixa Branca", "degrees": 0}, ""); code != 403 {
		t.Fatal("device edited rank", code)
	}
	first.ok("DELETE", prefix+"/devices/current", nil)
	if code, _ := first.request("GET", prefix+"/sessions", nil, ""); code != 401 {
		t.Fatal("ended device still authenticated", code)
	}
	second.list(prefix + "/sessions")
	devices = admin.list(prefix + "/devices")
	active := 0
	for _, d := range devices {
		if d["active"] == true {
			active++
		}
	}
	if active != 1 {
		t.Fatal("exit affected another access")
	}
	admin.ok("GET", "/v1/me", nil)
}
