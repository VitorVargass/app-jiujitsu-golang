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

func TestStudentStartDate(t *testing.T) {
	address := os.Getenv("TEST_DATABASE_URL")
	if address == "" {
		t.Skip("dedicated PostgreSQL required")
	}
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	ctx := context.Background()
	must(database.Migrate(address))
	db, err := database.Open(ctx, address)
	must(err)
	defer db.Close()
	server := httptest.NewServer(httpapi.New(db, ""))
	defer server.Close()
	base := client{t: t, url: server.URL}
	register := func(name string) client {
		v := base.ok("POST", "/v1/auth/register", map[string]string{"name": name, "email": core.ID() + "@test.example", "password": "Tatame123!"})
		return client{t: t, url: server.URL, token: v["token"].(string)}
	}
	admin, other, student := register("Gestor início"), register("Outro gestor"), register("Faixa preta")
	academy := admin.ok("POST", "/v1/academies", map[string]string{"name": "Início"})
	prefix := "/v1/academies/" + academy["id"].(string)
	aid := academy["id"].(string)
	foreign := other.ok("POST", "/v1/academies", map[string]string{"name": "Outra"})
	mods := admin.list(prefix + "/modalities")
	jj := mods[0]["id"].(string)
	loc, _ := time.LoadLocation("America/Sao_Paulo")
	now := time.Now().In(loc)
	first := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, loc)
	cpf := testCPF()
	body := map[string]any{"name": "Faixa preta", "email": getEmail(t, db, student.token), "reuse_existing_identity": true, "cpf": cpf, "birth_date": "1990-04-12", "started_on": "2015-03-10", "status": "active",
		"modality_details": []any{map[string]any{"modality_id": jj, "belt": "Faixa Preta", "degrees": 2, "amount_cents": 20000}},
		"billing":          map[string]any{"enabled": true, "amount_cents": 20000, "due_day": 10, "first_month": first.Format("2006-01"), "payer_name": "Faixa preta", "payer_document": cpf}}
	created := legacyStudent(t, db, admin, aid, body)
	path := prefix + "/students/" + created["id"].(string)
	if created["started_on"] != "2015-03-10" {
		t.Fatal("start date not saved", created)
	}
	progress := func() map[string]any { return admin.ok("GET", path+"/progress", nil) }
	before := progress()
	joined := before["joined_at"]
	tracked := before["tracking_started_at"]
	active := before["active_days"]
	snapshot := func() string {
		var value string
		must(db.QueryRow(ctx, `SELECT md5(jsonb_build_object('billing',(SELECT to_jsonb(b) FROM student_billing b WHERE academy_id=$1 AND student_id=$2),'invoices',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM invoices i WHERE academy_id=$1 AND student_id=$2),'periods',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM student_active_periods p WHERE academy_id=$1 AND student_id=$2),'ranks',(SELECT jsonb_agg(to_jsonb(h) ORDER BY sequence) FROM student_graduation_events h WHERE academy_id=$1 AND student_id=$2))::text)`, aid, created["id"]).Scan(&value))
		return value
	}
	unchanged := snapshot()
	update := map[string]string{"started_on": "2012-08-20", "expected_started_on": "2015-03-10"}
	admin.ok("PATCH", path+"/start-date", update)
	admin.ok("PATCH", path+"/start-date", update) // Lost response retry is harmless.
	after := progress()
	today, _ := time.Parse("2006-01-02", now.Format("2006-01-02"))
	start, _ := time.Parse("2006-01-02", "2012-08-20")
	if after["started_on"] != "2012-08-20" || after["tenure_days"] != today.Sub(start).Hours()/24 || after["joined_at"] != joined || after["tracking_started_at"] != tracked || after["active_days"] != active || snapshot() != unchanged {
		t.Fatal("correction changed unrelated history, contract or dates", after)
	}
	if page := admin.ok("GET", prefix+"/invoices", nil); page["total"] != float64(1) {
		t.Fatal("retroactive debts created", page)
	}
	if status, _ := admin.request("PATCH", path+"/start-date", map[string]string{"started_on": "2013-01-01", "expected_started_on": "2015-03-10"}, ""); status != 409 {
		t.Fatal("stale date accepted", status)
	}
	for _, date := range []string{"", "2024-02-30", "1899-12-31", "1989-01-01", now.AddDate(0, 0, 1).Format("2006-01-02")} {
		if status, _ := admin.request("PATCH", path+"/start-date", map[string]string{"started_on": date, "expected_started_on": "2012-08-20"}, ""); status != 422 {
			t.Fatal("invalid start date accepted", date, status)
		}
	}
	// Legacy clients omit this field without resetting it.
	delete(body, "started_on")
	admin.ok("PATCH", path, body)
	if progress()["started_on"] != "2012-08-20" {
		t.Fatal("omitted date was reset")
	}
	body["started_on"] = "2014-01-01"
	body["expected_started_on"] = "2012-08-20"
	admin.ok("PATCH", path, body)
	if progress()["started_on"] != "2014-01-01" {
		t.Fatal("full edit missed start date")
	}
	body["expected_started_on"] = "2012-08-20"
	body["started_on"] = "2016-01-01"
	if status, _ := admin.request("PATCH", path, body, ""); status != 409 {
		t.Fatal("stale complete edit accepted", status)
	}
	// Student and other academy cannot change the date.
	invite := admin.ok("POST", path+"/invitations", nil)
	student.ok("POST", "/v1/invitations/"+invite["token"].(string)+"/accept", nil)
	for _, who := range []client{student, other} {
		if status, _ := who.request("PATCH", path+"/start-date", map[string]string{"started_on": "2010-01-01", "expected_started_on": "2014-01-01"}, ""); status != 403 {
			t.Fatal("non-manager edited start date", status)
		}
	}
	foreignPath := "/v1/academies/" + foreign["id"].(string) + "/students/" + created["id"].(string) + "/start-date"
	if status, _ := other.request("PATCH", foreignPath, map[string]string{"started_on": "2010-01-01", "expected_started_on": "2014-01-01"}, ""); status != 404 {
		t.Fatal("cross tenant access", status)
	}
	admin.ok("POST", path+"/archive", nil)
	if status, _ := admin.request("PATCH", path+"/start-date", map[string]string{"started_on": "2010-01-01", "expected_started_on": "2014-01-01"}, ""); status != 409 {
		t.Fatal("archived date edited", status)
	}
	admin.ok("POST", path+"/restore", nil)
	if progress()["started_on"] != "2014-01-01" {
		t.Fatal("restoration reset start")
	}
	// Local calendar date is used, including a timezone ahead of UTC.
	_, err = db.Exec(ctx, "UPDATE academies SET timezone='Pacific/Kiritimati' WHERE id=$1", aid)
	must(err)
	far, _ := time.LoadLocation("Pacific/Kiritimati")
	fresh := map[string]any{"name": "Início padrão", "cpf": testCPF(), "birth_date": "1990-01-01", "status": "active", "modality_ids": []string{}}
	def := admin.ok("POST", prefix+"/students", fresh)
	if def["started_on"] != time.Now().In(far).Format("2006-01-02") {
		t.Fatal("default start ignores academy timezone", def)
	}
	bad := map[string]any{"name": "Não criar", "cpf": testCPF(), "birth_date": "1990-01-01", "started_on": "1980-01-01", "status": "active", "modality_ids": []string{}}
	if status, _ := admin.request("POST", prefix+"/students", bad, ""); status != 422 {
		t.Fatal("invalid enrollment created", status)
	}
}
