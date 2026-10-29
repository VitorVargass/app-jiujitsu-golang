package httpapi_test

import (
	"context"
	"net/http/httptest"
	"os"
	"sync"
	"tatame/backend/internal/core"
	"tatame/backend/internal/database"
	"tatame/backend/internal/httpapi"
	"testing"
	"time"
)

func TestSharedEnrollment(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("requires isolated PostgreSQL")
	}
	if e := database.Migrate(url); e != nil {
		t.Fatal(e)
	}
	ctx := context.Background()
	db, e := database.Open(ctx, url)
	if e != nil {
		t.Fatal(e)
	}
	defer db.Close()
	server := httptest.NewServer(httpapi.New(db, ""))
	defer server.Close()
	base := client{t: t, url: server.URL}
	register := func(name string) (client, string) {
		v := base.ok("POST", "/v1/auth/register", map[string]string{"name": name, "email": core.ID() + "@enrollment.example", "password": "Synthetic123!"})
		return client{t: t, url: server.URL, token: v["token"].(string)}, v["user"].(map[string]any)["id"].(string)
	}
	admin, _ := register("Manager QA")
	parent, uid := register("Guardian QA")
	adult, _ := register("Adult QA")
	outsider, _ := register("Unrelated QA")
	academy := admin.ok("POST", "/v1/academies", map[string]string{"name": "Shared Enrollment QA"})
	a := academy["id"].(string)
	prefix := "/v1/academies/" + a
	other := outsider.ok("POST", "/v1/academies", map[string]string{"name": "Other Academy QA"})
	otherPrefix := "/v1/academies/" + other["id"].(string)
	mods := admin.list(prefix + "/modalities")
	mid := mods[0]["id"].(string)
	mod := admin.ok("PATCH", prefix+"/modalities/"+mid, map[string]any{"name": "Jiu-Jitsu QA", "active": true, "amount_cents": 10000, "belt_options": []map[string]any{{"label": "Branca", "colors": []string{"#FFFFFF"}}}})
	_ = mod
	cfg := map[string]any{"enabled": true, "due_day": 10, "modality_ids": []string{mid}, "plan_ids": []string{}}
	settings := admin.ok("PUT", prefix+"/enrollment-link", cfg)
	token := settings["token"].(string)
	path := "/v1/enrollment-links/" + token
	preview := base.ok("GET", path, nil)
	first := preview["first_due"].(string)
	loc, _ := time.LoadLocation("America/Sao_Paulo")
	if first <= time.Now().In(loc).Format("2006-01-02") {
		t.Fatal("first due is not future")
	}
	payload := func(name, cpf, birth string) map[string]any {
		return map[string]any{"name": name, "cpf": cpf, "birth_date": birth, "phone": "41999990000", "alternate_phone": "41988880000", "guardian_cpf": "", "guardian_birth_date": "", "plan_id": "", "modality_details": []map[string]any{{"modality_id": mid, "belt": "Branca", "degrees": 1}}, "expected_amount_cents": 10000}
	}
	guardianCPF := testCPF()
	child := payload("Child One", testCPF(), "2015-01-01")
	child["guardian_cpf"] = guardianCPF
	child["guardian_birth_date"] = "1990-01-01"
	key := core.Token()
	var wg sync.WaitGroup
	results := make(chan map[string]any, 2)
	for range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			code, v := parent.request("POST", path+"/enroll", child, key)
			if code != 200 {
				t.Errorf("concurrent enrollment %d %v", code, v)
			}
			results <- v
		}()
	}
	wg.Wait()
	close(results)
	sid := ""
	for v := range results {
		if v["status"] != "active" {
			t.Fatalf("not active: %v", v)
		}
		if sid != "" && sid != v["student_id"] {
			t.Fatal("duplicate student")
		}
		sid = v["student_id"].(string)
	}
	second := payload("Child Two", testCPF(), "2016-03-01")
	second["guardian_cpf"] = guardianCPF
	second["guardian_birth_date"] = "1990-01-01"
	second["due_day"] = 31
	code, v := parent.request("POST", path+"/enroll", second, core.Token())
	if code != 200 {
		t.Fatalf("second child %d %v", code, v)
	}
	secondStudent := parent.ok("GET", prefix+"/me/student?student_id="+v["student_id"].(string), nil)
	if secondStudent["billing"].(map[string]any)["due_day"] != float64(31) {
		t.Fatal("child-specific due day ignored", secondStudent)
	}
	family := parent.list(prefix + "/me/students")
	if len(family) != 2 {
		t.Fatalf("guardian family %v", family)
	}
	var ownStudents int
	if e = db.QueryRow(ctx, "SELECT count(*) FROM students WHERE academy_id=$1 AND user_id=$2", a, uid).Scan(&ownStudents); e != nil || ownStudents != 0 {
		t.Fatalf("guardian gained phantom student: %d %v", ownStudents, e)
	}
	invoices := parent.ok("GET", prefix+"/me/invoices?student_id="+sid, nil)
	items := invoices["items"].([]any)
	if len(items) != 1 || items[0].(map[string]any)["due_date"] != first {
		t.Fatalf("wrong initial invoice: %v", invoices)
	}
	invoice := items[0].(map[string]any)["id"].(string)
	parent.ok("GET", prefix+"/invoices/"+invoice, nil)
	parent.ok("GET", prefix+"/me/student-credential?student_id="+sid, nil)
	parent.ok("GET", prefix+"/me/attendances?student_id="+sid+"&page=1", nil)
	for _, p := range []string{prefix + "/me/student?student_id=" + sid, prefix + "/invoices/" + invoice, prefix + "/me/attendances?student_id=" + sid + "&page=1"} {
		if c, _ := outsider.request("GET", p, nil, ""); c != 403 {
			t.Fatalf("outsider access %s %d", p, c)
		}
	}
	if c, _ := parent.request("PUT", prefix+"/enrollment-link", cfg, ""); c != 403 {
		t.Fatal("guardian changed settings")
	}
	if c, _ := parent.request("GET", otherPrefix+"/me/student?student_id="+sid, nil, ""); c != 403 {
		t.Fatal("cross academy family access")
	}
	tampered := payload("Bad Price", testCPF(), "1990-01-01")
	tampered["expected_amount_cents"] = 1
	if c, _ := adult.request("POST", path+"/enroll", tampered, core.Token()); c != 409 {
		t.Fatalf("tampered price %d", c)
	}
	if c, _ := parent.request("POST", path+"/enroll", second, key); c != 409 {
		t.Fatalf("key payload conflict %d", c)
	}
	// Existing child: do not mutate its billing or expose its actual name before approval.
	oldCPF := testCPF()
	old := admin.ok("POST", prefix+"/students", map[string]any{"name": "Private Existing Name", "cpf": oldCPF, "birth_date": "2014-01-01", "charge_mode": "custom", "phone": "41999990000"})
	oldID := old["id"].(string)
	request := payload("Name supplied by applicant", oldCPF, "2014-01-01")
	request["guardian_cpf"] = guardianCPF
	request["guardian_birth_date"] = "1990-01-01"
	c, pending := parent.request("POST", path+"/enroll", request, core.Token())
	if c != 200 || pending["status"] != "pending" || pending["student_id"] != nil {
		t.Fatalf("pending data leaked: %d %v", c, pending)
	}
	if c, _ := parent.request("GET", prefix+"/me/student?student_id="+oldID, nil, ""); c != 403 {
		t.Fatal("pending accessed student")
	}
	rid := pending["id"].(string)
	if c, _ := outsider.request("PATCH", prefix+"/enrollment-requests/"+rid, map[string]bool{"approve": true}, ""); c != 403 {
		t.Fatal("outsider approved request")
	}
	admin.ok("PATCH", prefix+"/enrollment-requests/"+rid, map[string]bool{"approve": true})
	got := parent.ok("GET", prefix+"/me/student?student_id="+oldID, nil)
	if got["name"] != "Private Existing Name" {
		t.Fatal("approval overwrote identity")
	}
	var n int
	if e = db.QueryRow(ctx, "SELECT count(*) FROM invoices WHERE academy_id=$1 AND student_id=$2", a, oldID).Scan(&n); e != nil || n != 0 {
		t.Fatal("approval changed billing")
	}
	admin.ok("DELETE", prefix+"/students/"+sid+"/portal-access/"+uid, nil)
	if c, _ := parent.request("GET", prefix+"/invoices/"+invoice, nil, ""); c != 403 {
		t.Fatal("revoked guardian still accesses invoice")
	}
	cfg["rotate"] = true
	newCfg := admin.ok("PUT", prefix+"/enrollment-link", cfg)
	if newCfg["token"] == token {
		t.Fatal("link not rotated")
	}
	if c, _ := base.request("GET", path, nil, ""); c != 404 {
		t.Fatal("old public link remains available")
	}
	cfg["enabled"] = false
	cfg["rotate"] = false
	disabled := admin.ok("PUT", prefix+"/enrollment-link", cfg)
	if c, _ := base.request("GET", "/v1/enrollment-links/"+disabled["token"].(string), nil, ""); c != 410 {
		t.Fatal("suspended link available")
	}
}

func TestSharedEnrollmentAdultPlanAndExistingAccount(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("requires isolated PostgreSQL")
	}
	if e := database.Migrate(url); e != nil {
		t.Fatal(e)
	}
	ctx := context.Background()
	db, e := database.Open(ctx, url)
	if e != nil {
		t.Fatal(e)
	}
	defer db.Close()
	server := httptest.NewServer(httpapi.New(db, ""))
	defer server.Close()
	base := client{t: t, url: server.URL}
	register := func(name string) client {
		v := base.ok("POST", "/v1/auth/register", map[string]string{"name": name, "email": core.ID() + "@adult.example", "password": "Synthetic123!"})
		return client{t: t, url: server.URL, token: v["token"].(string)}
	}
	admin, adult, claim := register("Manager"), register("New Adult"), register("Existing Adult Account")
	acad := admin.ok("POST", "/v1/academies", map[string]string{"name": "Adult Plan QA"})
	prefix := "/v1/academies/" + acad["id"].(string)
	mid := admin.list(prefix + "/modalities")[0]["id"].(string)
	admin.ok("PATCH", prefix+"/modalities/"+mid, map[string]any{"name": "Jiu-Jitsu", "active": true, "amount_cents": 20000, "belt_options": []map[string]any{{"label": "Branca", "colors": []string{"#FFFFFF"}}}})
	plan := admin.ok("POST", prefix+"/plans", map[string]any{"name": "Plano QA", "active": true, "amount_cents": 15000, "modality_ids": []string{mid}})
	cfg := admin.ok("PUT", prefix+"/enrollment-link", map[string]any{"enabled": true, "due_day": 31, "modality_ids": []string{}, "plan_ids": []string{plan["id"].(string)}})
	path := "/v1/enrollment-links/" + cfg["token"].(string) + "/enroll"
	payload := func(name, cpf string) map[string]any {
		return map[string]any{"name": name, "cpf": cpf, "birth_date": "1990-01-01", "phone": "41999990000", "plan_id": plan["id"], "modality_details": []map[string]any{{"modality_id": mid, "belt": "Branca", "degrees": 0}}, "expected_amount_cents": 15000}
	}
	input := payload("New Adult", testCPF())
	code, v := adult.request("POST", path, input, core.Token())
	if code != 200 || v["status"] != "active" {
		t.Fatalf("adult plan: %d %v", code, v)
	}
	own := adult.ok("GET", prefix+"/me/student", nil)
	if own["user_id"] == "" || own["charge_mode"] != "plan" || own["billing"].(map[string]any)["amount_cents"] != float64(15000) {
		t.Fatal("adult plan or own link wrong", own)
	}
	// Removing a live modality makes the whole plan unavailable, not a partial enrollment.
	admin.ok("PATCH", prefix+"/modalities/"+mid, map[string]any{"name": "Jiu-Jitsu", "active": false, "amount_cents": 20000})
	if c, _ := claim.request("POST", path, payload("Unavailable", testCPF()), core.Token()); c != 422 {
		t.Fatalf("inactive plan component accepted %d", c)
	}
	admin.ok("PATCH", prefix+"/modalities/"+mid, map[string]any{"name": "Jiu-Jitsu", "active": true, "amount_cents": 20000})
	cpf := testCPF()
	old := admin.ok("POST", prefix+"/students", map[string]any{"name": "Existing Adult", "cpf": cpf, "birth_date": "1990-01-01", "charge_mode": "custom"})
	c, pending := claim.request("POST", path, payload("Existing Adult", cpf), core.Token())
	if c != 200 || pending["status"] != "pending" {
		t.Fatalf("existing adult pending: %d %v", c, pending)
	}
	admin.ok("PATCH", prefix+"/enrollment-requests/"+pending["id"].(string), map[string]bool{"approve": true})
	found := claim.ok("GET", prefix+"/me/student?student_id="+old["id"].(string), nil)
	if found["id"] != old["id"] || found["person_id"] != old["person_id"] {
		t.Fatal("existing identity changed", found)
	}
	if c, _ := claim.request("GET", prefix+"/me/student?student_id="+own["id"].(string), nil, ""); c != 403 {
		t.Fatal("approved account read someone else")
	}
	if len(claim.list(prefix+"/me/students")) != 1 {
		t.Fatal("existing access created phantom enrollment")
	}
}

func TestSharedEnrollmentChosenDueDay(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("requires isolated PostgreSQL")
	}
	if e := database.Migrate(url); e != nil {
		t.Fatal(e)
	}
	ctx := context.Background()
	db, e := database.Open(ctx, url)
	if e != nil {
		t.Fatal(e)
	}
	defer db.Close()
	server := httptest.NewServer(httpapi.New(db, ""))
	defer server.Close()
	base := client{t: t, url: server.URL}
	register := func(name string) client {
		v := base.ok("POST", "/v1/auth/register", map[string]string{"name": name, "email": core.ID() + "@due-day.example", "password": "Synthetic123!"})
		return client{t: t, url: server.URL, token: v["token"].(string)}
	}
	admin, student, legacy := register("Manager"), register("Choose Due Day"), register("Old Installed Client")
	a := admin.ok("POST", "/v1/academies", map[string]string{"name": "Chosen Due Day QA"})["id"].(string)
	prefix := "/v1/academies/" + a
	mid := admin.list(prefix + "/modalities")[0]["id"].(string)
	admin.ok("PATCH", prefix+"/modalities/"+mid, map[string]any{"name": "Jiu-Jitsu", "active": true, "amount_cents": 15000, "belt_options": []map[string]any{{"label": "Branca", "colors": []string{"#FFFFFF"}}}})
	token := admin.ok("PUT", prefix+"/enrollment-link", map[string]any{"enabled": true, "due_day": 10, "modality_ids": []string{mid}, "plan_ids": []string{}})["token"].(string)
	link := "/v1/enrollment-links/" + token
	preview := base.ok("GET", link+"?due_day=20", nil)
	if preview["due_day"] != float64(20) {
		t.Fatal("preview ignored chosen day")
	}
	first := preview["first_due"].(string)
	if first[8:] != "20" {
		t.Fatal("wrong chosen-day date", first)
	}
	for _, bad := range []string{"0", "32", "oops"} {
		if code, _ := base.request("GET", link+"?due_day="+bad, nil, ""); code != 422 {
			t.Fatalf("bad preview day %s: %d", bad, code)
		}
	}
	input := map[string]any{"name": "Choose Due Day", "cpf": testCPF(), "birth_date": "1990-01-01", "phone": "41999990000", "plan_id": "", "modality_details": []map[string]any{{"modality_id": mid, "belt": "Branca", "degrees": 0}}, "expected_amount_cents": 15000, "due_day": 20}
	for _, bad := range []int{0, 32, -1} {
		input["due_day"] = bad
		if code, _ := student.request("POST", link+"/enroll", input, core.Token()); code != 422 {
			t.Fatalf("bad enrollment day %d: %d", bad, code)
		}
	}
	input["due_day"] = 20
	key := core.Token()
	code, result := student.request("POST", link+"/enroll", input, key)
	if code != 200 || result["status"] != "active" || result["first_due"] != first {
		t.Fatalf("chosen day enrollment: %d %v", code, result)
	}
	own := student.ok("GET", prefix+"/me/student", nil)
	b := own["billing"].(map[string]any)
	if b["due_day"] != float64(20) {
		t.Fatal("academy default overrode student choice", b)
	}
	invoices := student.ok("GET", prefix+"/me/invoices", nil)["items"].([]any)
	if len(invoices) != 1 || invoices[0].(map[string]any)["due_date"] != first {
		t.Fatal("first invoice mismatch", invoices)
	}
	code, replay := student.request("POST", link+"/enroll", input, key)
	if code != 200 || replay["student_id"] != result["student_id"] || replay["first_due"] != first {
		t.Fatal("retry changed due date", code, replay)
	}
	input["due_day"] = 21
	if code, _ = student.request("POST", link+"/enroll", input, key); code != 409 {
		t.Fatal("key reused with a different due day", code)
	}
	// Existing student editing remains available to the manager for future invoices.
	updated := admin.ok("PATCH", prefix+"/students/"+own["id"].(string), map[string]any{"name": own["name"], "email": own["email"], "cpf": own["cpf"], "birth_date": own["birth_date"], "status": "active", "phone": own["phone"], "charge_mode": "modalities", "modality_details": []map[string]any{{"modality_id": mid, "belt": "Branca", "degrees": 0, "amount_cents": 15000}}, "billing": map[string]any{"enabled": true, "amount_cents": 15000, "due_day": 25, "first_month": b["first_month"]}})
	if updated["billing"].(map[string]any)["due_day"] != float64(25) {
		t.Fatal("manager correction ignored")
	}
	if got := admin.ok("GET", prefix+"/invoices/"+invoices[0].(map[string]any)["id"].(string), nil)["due_date"]; got != first {
		t.Fatal("existing issued invoice was silently rewritten", got)
	}
	// Backward compatibility for previously installed apps that omit the new field.
	delete(input, "due_day")
	input["name"] = "Old Installed Client"
	input["cpf"] = testCPF()
	if code, v := legacy.request("POST", link+"/enroll", input, core.Token()); code != 200 || v["status"] != "active" {
		t.Fatal("old client rejected", code, v)
	}
	if got := legacy.ok("GET", prefix+"/me/student", nil)["billing"].(map[string]any)["due_day"]; got != float64(10) {
		t.Fatal("legacy default changed", got)
	}
}
