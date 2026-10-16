package httpapi_test

import (
	"context"
	"net/http/httptest"
	"os"
	"tatame/backend/internal/billing"
	"tatame/backend/internal/core"
	"tatame/backend/internal/database"
	"tatame/backend/internal/httpapi"
	"testing"
	"time"
)

func TestStudentWizardRanksAndPricing(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("dedicated PostgreSQL required")
	}
	ctx := context.Background()
	if err := database.Migrate(url); err != nil {
		t.Fatal(err)
	}
	db, err := database.Open(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	server := httptest.NewServer(httpapi.New(db, ""))
	defer server.Close()
	base := client{t: t, url: server.URL}
	register := func(name string) client {
		v := base.ok("POST", "/v1/auth/register", map[string]string{"name": name, "email": core.ID() + "@wizard.test", "password": "Tatame123!"})
		return client{t: t, url: server.URL, token: v["token"].(string)}
	}
	admin, outsider := register("Gestor Etapas"), register("Gestor Outra")
	academy := admin.ok("POST", "/v1/academies", map[string]string{"name": "Academia Etapas"})
	other := outsider.ok("POST", "/v1/academies", map[string]string{"name": "Outra Etapas"})
	a := academy["id"].(string)
	prefix := "/v1/academies/" + a
	catalogs := admin.list(prefix + "/modalities")
	ids := map[string]string{}
	for _, m := range catalogs {
		ids[m["name"].(string)] = m["id"].(string)
	}
	jj, ng := ids["Jiu-Jitsu"], ids["No-Gi"]
	if jj == "" || ng == "" {
		t.Fatal("missing defaults")
	}
	opts := []any{map[string]any{"label": "Faixa Azul", "colors": []string{"#386DCE"}}, map[string]any{"label": "Faixa Roxa", "colors": []string{"#885BB0"}}}
	for _, c := range []struct {
		id, name string
		amount   int
	}{{jj, "Jiu-Jitsu", 15000}, {ng, "No-Gi", 10000}} {
		v := admin.ok("PATCH", prefix+"/modalities/"+c.id, map[string]any{"name": c.name, "active": true, "amount_cents": c.amount, "belt_options": opts})
		if int(v["amount_cents"].(float64)) != c.amount {
			t.Fatal("catalog price lost")
		}
	}
	plan := admin.ok("POST", prefix+"/plans", map[string]any{"name": "Combo", "active": true, "amount_cents": 20000, "modality_ids": []string{jj, ng}})
	loc, _ := time.LoadLocation("America/Sao_Paulo")
	now := time.Now().In(loc)
	month := now.Format("2006-01")
	body := func(mode string) map[string]any {
		p := ""
		if mode == "plan" {
			p = plan["id"].(string)
		}
		return map[string]any{"birth_date": "2012-04-12", "cpf": testCPF(), "name": "Aluno em etapas", "phone": "41999990000", "alternate_phone": "4133332222", "status": "active", "charge_mode": mode, "plan_id": p, "modality_ids": []string{jj, ng},
			"modality_details": []any{map[string]any{"modality_id": jj, "belt": "Faixa Azul", "amount_cents": 15000}, map[string]any{"modality_id": ng, "belt": "Faixa Roxa", "amount_cents": 10000}},
			"billing":          map[string]any{"enabled": true, "amount_cents": 20000, "due_day": 31, "first_month": month, "payer_name": "Responsável Etapas", "payer_document": "52998224725"}}
	}
	student := admin.ok("POST", prefix+"/students", body("modalities"))
	sid := student["id"].(string)
	if student["alternate_phone"] != "4133332222" || student["charge_mode"] != "modalities" {
		t.Fatal("student fields lost")
	}
	if student["billing"].(map[string]any)["amount_cents"].(float64) != 25000 {
		t.Fatal("server did not calculate modality sum")
	}
	grades := map[string]string{}
	for _, v := range student["modality_details"].([]any) {
		d := v.(map[string]any)
		grades[d["modality_id"].(string)] = d["belt"].(string)
	}
	if grades[jj] != "Faixa Azul" || grades[ng] != "Faixa Roxa" {
		t.Fatal("ranks were flattened")
	}
	var invoiceID string
	var initialAmount int64
	if err = db.QueryRow(ctx, "SELECT id,amount_cents FROM invoices WHERE academy_id=$1 AND student_id=$2", a, sid).Scan(&invoiceID, &initialAmount); err != nil || initialAmount != 25000 {
		t.Fatal("wrong first invoice", err)
	}
	if _, err = db.Exec(ctx, "UPDATE invoices SET status='paid',paid_at=now() WHERE id=$1", invoiceID); err != nil {
		t.Fatal(err)
	}
	changed := body("modalities")
	changed["modality_details"].([]any)[0].(map[string]any)["amount_cents"] = 17000
	updated := admin.ok("PATCH", prefix+"/students/"+sid, changed)
	if updated["billing"].(map[string]any)["amount_cents"].(float64) != 27000 {
		t.Fatal("new agreed total not saved")
	}
	var oldAmount int64
	var oldStatus string
	if err = db.QueryRow(ctx, "SELECT amount_cents,status FROM invoices WHERE id=$1", invoiceID).Scan(&oldAmount, &oldStatus); err != nil || oldAmount != 25000 || oldStatus != "paid" {
		t.Fatal("issued invoice was changed", err)
	}
	tx, err := db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err = billing.GenerateTx(ctx, tx, a, sid, now.AddDate(0, 1, 0)); err != nil {
		tx.Rollback(ctx)
		t.Fatal(err)
	}
	if err = tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	var nextAmount int64
	if err = db.QueryRow(ctx, "SELECT amount_cents FROM invoices WHERE academy_id=$1 AND student_id=$2 ORDER BY competence DESC LIMIT 1", a, sid).Scan(&nextAmount); err != nil || nextAmount != 27000 {
		t.Fatal("future invoice has wrong total", err)
	}
	bundled := admin.ok("POST", prefix+"/students", body("plan"))
	if bundled["billing"].(map[string]any)["amount_cents"].(float64) != 20000 {
		t.Fatal("bundle incorrectly priced as sum")
	}
	bad := body("plan")
	bad["modality_ids"] = []string{jj}
	bad["modality_details"] = bad["modality_details"].([]any)[:1]
	if code, _ := admin.request("POST", prefix+"/students", bad, ""); code != 422 {
		t.Fatalf("plan mismatch accepted: %d", code)
	}
	bad = body("modalities")
	bad["modality_details"].([]any)[0].(map[string]any)["belt"] = "Inventada"
	if code, _ := admin.request("POST", prefix+"/students", bad, ""); code != 422 {
		t.Fatalf("unknown belt accepted: %d", code)
	}
	bad = body("modalities")
	bad["modality_details"].([]any)[0].(map[string]any)["amount_cents"] = -100
	if code, _ := admin.request("POST", prefix+"/students", bad, ""); code != 422 {
		t.Fatalf("negative price accepted: %d", code)
	}
	foreign := outsider.list("/v1/academies/" + other["id"].(string) + "/modalities")[0]["id"].(string)
	bad = body("modalities")
	bad["modality_ids"] = []string{foreign}
	bad["modality_details"] = []any{map[string]any{"modality_id": foreign, "belt": "Faixa Azul", "amount_cents": 100}}
	if code, _ := admin.request("POST", prefix+"/students", bad, ""); code != 422 {
		t.Fatalf("foreign modality accepted: %d", code)
	}
	if code, _ := outsider.request("GET", prefix+"/students/"+sid, nil, ""); code != 403 {
		t.Fatalf("cross-academy access: %d", code)
	}
	// Check-in and attendance use the rank of the class modality, not the legacy primary belt.
	course := admin.ok("POST", prefix+"/classes", map[string]string{"name": "No-Gi por graduação", "modality_id": ng})
	schedule := admin.ok("POST", prefix+"/classes/"+course["id"].(string)+"/schedules", map[string]any{"weekday": int(now.Weekday()), "start_time": "19:00", "duration_minutes": 60})
	session := admin.ok("POST", prefix+"/classes/"+course["id"].(string)+"/sessions", map[string]string{"schedule_id": schedule["id"].(string)})
	login := base.ok("POST", "/v1/auth/login", map[string]string{"email": getEmail(t, db, admin.token), "password": "Tatame123!"})
	provisioner := client{t: t, url: server.URL, token: login["token"].(string)}
	device := provisioner.ok("POST", prefix+"/devices", map[string]string{"name": "Tablet de graduação"})
	kiosk := client{t: t, url: server.URL, token: device["token"].(string)}
	checkPath := prefix + "/sessions/" + session["id"].(string) + "/check-ins"
	if code, v := kiosk.request("POST", checkPath, map[string]string{"student_code": student["student_code"].(string)}, core.ID()); code != 200 || v["belt"] != "Faixa Roxa" {
		t.Fatalf("check-in used wrong modality belt: %d %v", code, v)
	}
	rows := admin.list(prefix + "/sessions/" + session["id"].(string) + "/attendances")
	if len(rows) != 1 || rows[0]["belt"] != "Faixa Roxa" {
		t.Fatal("attendance used legacy primary belt", rows)
	}
	history := admin.ok("GET", prefix+"/attendances?page=1", nil)
	if history["items"].([]any)[0].(map[string]any)["belt"] != "Faixa Roxa" {
		t.Fatal("paged history used legacy primary belt")
	}
	// An academy can retire a grade without deleting a student's previous rank.
	admin.ok("PATCH", prefix+"/modalities/"+ng, map[string]any{"name": "No-Gi", "active": true, "amount_cents": 10000, "belt_options": opts[:1]})
	admin.ok("PATCH", prefix+"/students/"+sid, changed)
	if code, _ := admin.request("POST", prefix+"/students", body("modalities"), ""); code != 422 {
		t.Fatalf("retired grade assigned to new student: %d", code)
	}
	free := body("modalities")
	free["modality_ids"] = []string{jj}
	free["modality_details"] = []any{map[string]any{"modality_id": jj, "belt": "Faixa Azul", "amount_cents": 0}}
	free["billing"].(map[string]any)["enabled"] = false
	free["billing"].(map[string]any)["payer_document"] = ""
	noCharge := admin.ok("POST", prefix+"/students", free)
	var count int
	if err = db.QueryRow(ctx, "SELECT count(*) FROM invoices WHERE student_id=$1", noCharge["id"]).Scan(&count); err != nil || count != 0 {
		t.Fatal("disabled billing generated invoice", err)
	}
}
