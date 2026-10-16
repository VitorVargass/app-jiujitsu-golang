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

func TestStudentAgePayerAndProfileAttendance(t *testing.T) {
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
	register := func(name string) client {
		d := base.ok("POST", "/v1/auth/register", map[string]string{"name": name, "email": core.ID() + "@identity.test", "password": "Tatame123!"})
		return client{t: t, url: server.URL, token: d["token"].(string)}
	}
	admin, outsider, owner := register("Gestor Idade"), register("Outro Gestor"), register("Aluno Vinculado")
	a := admin.ok("POST", "/v1/academies", map[string]string{"name": "Academia Idade"})["id"].(string)
	prefix := "/v1/academies/" + a
	loc, _ := time.LoadLocation("America/Sao_Paulo")
	now := time.Now().In(loc)
	month := now.Format("2006-01")
	adultBirth := now.AddDate(-25, 0, 0).Format("2006-01-02")
	childBirth := now.AddDate(-14, 0, 0).Format("2006-01-02")
	body := func(birth string) map[string]any {
		return map[string]any{"name": "Aluno Teste", "cpf": testCPF(), "birth_date": birth, "status": "active",
			"billing": map[string]any{"enabled": true, "amount_cents": 20000, "due_day": 10, "first_month": month, "payer_name": "Outra Pessoa", "payer_document": "52998224725"}}
	}
	adult := admin.ok("POST", prefix+"/students", body(adultBirth))
	adultID := adult["id"].(string)
	b := adult["billing"].(map[string]any)
	if b["payer_name"] != adult["name"] || b["payer_document"] != adult["cpf"] {
		t.Fatal("adult did not use own identity")
	}
	var originalDoc string
	if err = db.QueryRow(ctx, "SELECT payer_document FROM invoices WHERE academy_id=$1 AND student_id=$2", a, adultID).Scan(&originalDoc); err != nil || originalDoc != adult["cpf"] {
		t.Fatal("adult invoice payer", err)
	}
	for _, birth := range []string{"", now.AddDate(0, 0, 1).Format("2006-01-02"), "2025-02-30", "1899-01-01"} {
		if code, _ := admin.request("POST", prefix+"/students", body(birth), ""); code != 422 {
			t.Fatal("invalid birth accepted", birth, code)
		}
	}
	missing := body(adultBirth)
	delete(missing, "birth_date")
	if code, _ := admin.request("POST", prefix+"/students", missing, ""); code != 422 {
		t.Fatal("birth date required", code)
	}
	bad := body(childBirth)
	bad["billing"].(map[string]any)["payer_document"] = bad["cpf"]
	if code, _ := admin.request("POST", prefix+"/students", bad, ""); code != 422 {
		t.Fatal("child cannot be its own responsible", code)
	}
	child := admin.ok("POST", prefix+"/students", body(childBirth))
	sid := child["id"].(string)
	if child["billing"].(map[string]any)["payer_name"] != "Outra Pessoa" {
		t.Fatal("responsible missing")
	}
	// Omission from a previous client keeps the date and guardian.
	edit := map[string]any{"name": "Menor Editado", "cpf": child["cpf"], "status": "active"}
	changed := admin.ok("PATCH", prefix+"/students/"+sid, edit)
	if changed["birth_date"] != childBirth || changed["billing"].(map[string]any)["payer_document"] != "52998224725" {
		t.Fatal("omitted date changed")
	}
	// On becoming an adult, future emissions use own CPF, while old invoices stay immutable.
	edit["birth_date"] = adultBirth
	admin.ok("PATCH", prefix+"/students/"+sid, edit)
	var oldDoc string
	if err = db.QueryRow(ctx, "SELECT payer_document FROM invoices WHERE academy_id=$1 AND student_id=$2", a, sid).Scan(&oldDoc); err != nil || oldDoc != "52998224725" {
		t.Fatal("issued invoice changed", err)
	}
	// Clock-controlled generation also switches automatically on the 18th birthday.
	nextBirthday := now.AddDate(0, 1, 0)
	teenBirth := nextBirthday.AddDate(-18, 0, 0).Format("2006-01-02")
	teenBody := body(teenBirth)
	teen := admin.ok("POST", prefix+"/students", teenBody)
	teenID := teen["id"].(string)
	tx, err := db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err = billing.GenerateTx(ctx, tx, a, teenID, nextBirthday); err != nil {
		tx.Rollback(ctx)
		t.Fatal(err)
	}
	if err = tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	var generatedDoc string
	if err = db.QueryRow(ctx, "SELECT payer_document FROM invoices WHERE academy_id=$1 AND student_id=$2 AND competence=$3", a, teenID, nextBirthday.Format("2006-01")+"-01").Scan(&generatedDoc); err != nil || generatedDoc != teen["cpf"] {
		t.Fatal("18th birthday future payer", err)
	}
	// Profile history keeps removed classes, archived students, tenant scope and pagination.
	mods := admin.list(prefix + "/modalities")
	mid := mods[0]["id"].(string)
	c := admin.ok("POST", prefix+"/classes", map[string]any{"name": "Treino Perfil", "modality_id": mid, "active": true, "schedules": []any{map[string]any{"weekday": int(now.Weekday()), "start_time": "19:00", "duration_minutes": 60}}})
	cid := c["id"].(string)
	schedule := c["schedules"].([]any)[0].(map[string]any)["id"].(string)
	session := core.ID()
	if _, err = db.Exec(ctx, "INSERT INTO class_sessions(id,academy_id,class_id,schedule_id,starts_at,status) VALUES($1,$2,$3,$4,$5,'closed')", session, a, cid, schedule, now); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 28; i++ {
		sn := session
		if i > 0 {
			sn = core.ID()
			if _, err = db.Exec(ctx, "INSERT INTO class_sessions(id,academy_id,class_id,schedule_id,starts_at,status) VALUES($1,$2,$3,$4,$5,'closed')", sn, a, cid, schedule, now.Add(-time.Duration(i)*time.Hour)); err != nil {
				t.Fatal(err)
			}
		}
		if _, err = db.Exec(ctx, "INSERT INTO attendances(id,academy_id,session_id,membership_id,checked_in_at) VALUES($1,$2,$3,$4,$5)", core.ID(), a, sn, sid, now.Add(-time.Duration(i)*time.Minute)); err != nil {
			t.Fatal(err)
		}
	}
	admin.ok("DELETE", prefix+"/classes/"+cid, nil)
	admin.ok("POST", prefix+"/students/"+sid+"/archive", nil)
	history := prefix + "/attendances?student_id=" + sid + "&page=1&page_size=25"
	page := admin.ok("GET", history, nil)
	if page["total"] != float64(28) || len(page["items"].([]any)) != 25 {
		t.Fatal("profile pagination", page["total"])
	}
	row := page["items"].([]any)[0].(map[string]any)
	if row["student_id"] != sid || row["modality_name"] == nil || row["starts_at"] == nil {
		t.Fatal("history class information missing")
	}
	page2 := admin.ok("GET", prefix+"/attendances?student_id="+sid+"&page=2&page_size=25", nil)
	if len(page2["items"].([]any)) != 3 {
		t.Fatal("second page missing")
	}
	// Month boundaries follow the academy timezone, including UTC midnight offsets.
	for i, stamp := range []string{"2099-02-01T02:59:59Z", "2099-02-01T03:00:00Z"} {
		sn := core.ID()
		instant, _ := time.Parse(time.RFC3339, stamp)
		if _, err = db.Exec(ctx, "INSERT INTO class_sessions(id,academy_id,class_id,schedule_id,starts_at,status) VALUES($1,$2,$3,$4,$5,'closed')", sn, a, cid, schedule, instant.Add(time.Duration(i)*time.Minute)); err != nil {
			t.Fatal(err)
		}
		if _, err = db.Exec(ctx, "INSERT INTO attendances(id,academy_id,session_id,membership_id,checked_in_at) VALUES($1,$2,$3,$4,$5)", core.ID(), a, sn, sid, instant); err != nil {
			t.Fatal(err)
		}
	}
	for _, month := range []string{"2099-01", "2099-02"} {
		p := admin.ok("GET", prefix+"/attendances?student_id="+sid+"&page=1&month="+month, nil)
		if p["total"] != float64(1) {
			t.Fatal("academy month boundary", month, p["total"])
		}
	}
	if code, _ := outsider.request("GET", history, nil, ""); code != 403 {
		t.Fatal("tenant history isolation", code)
	}
	inviteStudent := admin.ok("POST", prefix+"/students", body(adultBirth))
	inv := admin.ok("POST", prefix+"/students/"+inviteStudent["id"].(string)+"/invitations", nil)
	owner.ok("POST", "/v1/invitations/"+inv["token"].(string)+"/accept", nil)
	if code, _ := owner.request("GET", history, nil, ""); code != 403 {
		t.Fatal("student got other student history", code)
	}
	own := owner.ok("GET", prefix+"/me/attendances?page=1&student_id="+sid, nil)
	if own["total"] != float64(0) {
		t.Fatal("own history honored forged student id")
	}
}
