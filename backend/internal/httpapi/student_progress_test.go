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

func TestStudentProgressAndFutureFirstInvoice(t *testing.T) {
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
	server := httptest.NewServer(httpapi.New(db, ""))
	defer server.Close()
	base := client{t: t, url: server.URL}
	register := func(name string) client {
		v := base.ok("POST", "/v1/auth/register", map[string]string{"name": name, "email": core.ID() + "@test.example", "password": "Tatame123!"})
		return client{t: t, url: server.URL, token: v["token"].(string)}
	}
	admin, outsider, owner := register("Gestor da evolução"), register("Outro gestor"), register("Aluno da evolução")
	a := admin.ok("POST", "/v1/academies", map[string]string{"name": "Evolução"})
	aid := a["id"].(string)
	prefix := "/v1/academies/" + aid
	mods := admin.list(prefix + "/modalities")
	jj := mods[0]["id"].(string)
	loc, _ := time.LoadLocation("America/Sao_Paulo")
	now := time.Now().In(loc)
	first := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, loc)
	contract := map[string]any{"enabled": true, "amount_cents": 21000, "due_day": 10, "first_month": first.Format("2006-01"), "payer_name": "Responsável", "payer_document": "52998224725"}
	body := map[string]any{"name": "Aluno da evolução", "email": getEmail(t, db, owner.token), "reuse_existing_identity": true, "cpf": testCPF(), "birth_date": "2012-04-12", "status": "active", "modality_details": []any{map[string]any{"modality_id": jj, "belt": "Faixa Branca", "degrees": 0, "amount_cents": 0}}, "billing": contract}
	s := admin.ok("POST", prefix+"/students", body)
	id := s["id"].(string)
	studentPath := prefix + "/students/" + id
	page := admin.ok("GET", prefix+"/invoices?month="+first.Format("2006-01"), nil)
	items := page["items"].([]any)
	if len(items) != 1 {
		t.Fatal("first future invoice is missing", page)
	}
	inv := items[0].(map[string]any)
	if inv["due_date"] != first.AddDate(0, 0, 9).Format("2006-01-02") || inv["amount_cents"] != float64(21000) {
		t.Fatal("future due date/amount", inv)
	}
	iid := inv["id"].(string)
	// Background generation and identical edits do not issue later future months.
	for range 3 {
		must((billing.Repository{DB: db}).Generate(ctx))
	}
	admin.ok("PATCH", studentPath, body)
	if v := admin.ok("GET", prefix+"/invoices", nil); v["total"] != float64(1) {
		t.Fatal("future invoice generation ran ahead", v)
	}
	progress := func() map[string]any { return admin.ok("GET", studentPath+"/progress?page=1&page_size=10", nil) }
	p := progress()
	history := p["history"].(map[string]any)
	if history["total"] != float64(1) || p["active_since"] == nil {
		t.Fatal("initial progress", p)
	}
	initial := history["items"].([]any)[0].(map[string]any)
	if initial["kind"] != "initial" || initial["occurred_at"] != nil {
		t.Fatal("invented award date", initial)
	}
	rankPath := studentPath + "/graduations/" + jj
	admin.ok("PATCH", rankPath, map[string]any{"belt": "Faixa Branca", "degrees": 1})
	admin.ok("PATCH", rankPath, map[string]any{"belt": "Faixa Branca", "degrees": 1})
	p = progress()
	history = p["history"].(map[string]any)
	h := history["items"].([]any)[0].(map[string]any)
	if history["total"] != float64(2) || h["previous_degrees"] != float64(0) || h["degrees"] != float64(1) || h["actor_name"] != "Gestor da evolução" || h["occurred_at"] == nil {
		t.Fatal("degree history or retry", p)
	}
	at, e := time.Parse(time.RFC3339, h["occurred_at"].(string))
	must(e)
	if at.In(loc).Format("2006-01-02") != now.Format("2006-01-02") {
		t.Fatal("wrong award day", at)
	}
	// Full enrollment edits and financial edits keep a single rank history.
	body["modality_details"].([]any)[0].(map[string]any)["degrees"] = 1
	admin.ok("PATCH", studentPath, body)
	body["modality_details"].([]any)[0].(map[string]any)["degrees"] = 2
	admin.ok("PATCH", studentPath, body)
	if v := progress()["history"].(map[string]any); v["total"] != float64(3) {
		t.Fatal("full enrollment history", v)
	}
	// Validation failure does not leave an audit entry or a partial rank.
	bad := map[string]any{"name": "Aluno da evolução", "status": "active", "modality_details": []any{map[string]any{"modality_id": jj, "belt": "Faixa Azul", "degrees": 2, "amount_cents": 0}}, "billing": map[string]any{"enabled": true, "amount_cents": 0, "due_day": 10, "first_month": first.Format("2006-01"), "payer_name": "Responsável", "payer_document": "52998224725"}}
	if code, _ := admin.request("PATCH", studentPath, bad, ""); code != 422 {
		t.Fatal("invalid edit accepted", code)
	}
	if v := progress()["history"].(map[string]any); v["total"] != float64(3) {
		t.Fatal("failed edit left history")
	}
	// Simulate an older active interval, then pause/archive/restore.
	_, e = db.Exec(ctx, "UPDATE student_active_periods SET started_at=now()-interval '12 days 2 hours' WHERE academy_id=$1 AND student_id=$2", aid, id)
	must(e)
	contract["enabled"] = false
	body["status"] = "inactive"
	admin.ok("PATCH", studentPath, body)
	p = progress()
	if p["active_since"] != nil || p["active_days"] != float64(12) {
		t.Fatal("inactive time was counted", p)
	}
	admin.ok("POST", studentPath+"/archive", nil)
	admin.ok("POST", studentPath+"/archive", nil)
	admin.ok("POST", studentPath+"/restore", nil)
	admin.ok("POST", studentPath+"/restore", nil)
	var periods int
	must(db.QueryRow(ctx, "SELECT count(*) FROM student_active_periods WHERE academy_id=$1 AND student_id=$2", aid, id).Scan(&periods))
	if periods != 2 {
		t.Fatal("duplicate lifecycle period", periods)
	}
	p = progress()
	if p["active_days"] != float64(12) || p["active_since"] == nil {
		t.Fatal("restoration lost active time", p)
	}
	// Removing/rejoining a modality preserves awards without inventing a repeat.
	body["status"] = "active"
	contract["enabled"] = false
	body["modality_details"] = []any{}
	admin.ok("PATCH", studentPath, body)
	body["modality_details"] = []any{map[string]any{"modality_id": jj, "belt": "Faixa Branca", "degrees": 2, "amount_cents": 0}}
	admin.ok("PATCH", studentPath, body)
	if v := progress()["history"].(map[string]any); v["total"] != float64(3) {
		t.Fatal("modality return invented progress", v)
	}
	// Reactivating billing for a later future month also issues its first invoice now.
	later := first.AddDate(0, 2, 0)
	contract["enabled"] = true
	contract["first_month"] = later.Format("2006-01")
	admin.ok("PATCH", studentPath, body)
	if v := admin.ok("GET", prefix+"/invoices?month="+later.Format("2006-01"), nil); v["total"] != float64(1) {
		t.Fatal("reactivation future invoice missing", v)
	}
	old := admin.ok("GET", prefix+"/invoices/"+iid, nil)
	if old["amount_cents"] != float64(21000) {
		t.Fatal("original invoice changed", old)
	}
	invite := admin.ok("POST", studentPath+"/invitations", nil)
	owner.ok("POST", "/v1/invitations/"+invite["token"].(string)+"/accept", nil)
	if code, _ := owner.request("GET", studentPath+"/progress", nil, ""); code != 403 {
		t.Fatal("student read administrative history", code)
	}
	if code, _ := outsider.request("GET", studentPath+"/progress", nil, ""); code != 403 {
		t.Fatal("tenant history leak", code)
	}
	// Repair a first future invoice scheduled by the previous version.
	legacyContract := map[string]any{"enabled": false, "amount_cents": 18000, "due_day": 10, "first_month": first.Format("2006-01"), "payer_name": "Responsável", "payer_document": "52998224725"}
	legacy := admin.ok("POST", prefix+"/students", map[string]any{"name": "Primeira cobrança antiga", "cpf": testCPF(), "birth_date": "2012-04-12", "status": "active", "modality_ids": []string{jj}, "billing": legacyContract})
	legacyID := legacy["id"].(string)
	_, e = db.Exec(ctx, "UPDATE student_billing SET enabled=true WHERE academy_id=$1 AND student_id=$2", aid, legacyID)
	must(e)
	must((billing.Repository{DB: db}).Generate(ctx))
	must((billing.Repository{DB: db}).Generate(ctx))
	repair := admin.ok("GET", prefix+"/invoices?student_id="+legacyID+"&month="+first.Format("2006-01"), nil)
	if repair["total"] != float64(1) {
		t.Fatal("previously scheduled first invoice was not repaired", repair)
	}
	if total := admin.ok("GET", prefix+"/invoices?student_id="+legacyID, nil)["total"]; total != float64(1) {
		t.Fatal("repair issued extra future invoices", total)
	}
	// Pagination and modality filters retain total and newest-first ordering.
	filtered := admin.ok("GET", studentPath+"/progress?modality_id="+jj+"&page=2&page_size=1", nil)["history"].(map[string]any)
	if filtered["total"] != float64(3) || len(filtered["items"].([]any)) != 1 {
		t.Fatal("history pagination", filtered)
	}
}
