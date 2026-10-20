package httpapi_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"tatame/backend/internal/core"
	"tatame/backend/internal/database"
	"tatame/backend/internal/httpapi"
	"testing"
	"time"
	_ "time/tzdata"
)

type client struct {
	t          *testing.T
	url, token string
}

func (c client) request(method, path string, body any, key string) (int, map[string]any) {
	c.t.Helper()
	var b bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&b).Encode(body)
	}
	req, e := http.NewRequest(method, c.url+path, &b)
	if e != nil {
		c.t.Fatal(e)
	}
	req.Header.Set("Content-Type", "application/json")
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	if key != "" {
		req.Header.Set("Idempotency-Key", key)
	}
	res, e := http.DefaultClient.Do(req)
	if e != nil {
		c.t.Fatal(e)
	}
	defer res.Body.Close()
	var data map[string]any
	_ = json.NewDecoder(res.Body).Decode(&data)
	return res.StatusCode, data
}
func (c client) ok(method, path string, body any) map[string]any {
	c.t.Helper()
	status, v := c.request(method, path, body, "")
	if status < 200 || status >= 300 {
		c.t.Fatalf("%s %s: %d %v", method, path, status, v)
	}
	return v
}
func (c client) list(path string) []map[string]any {
	c.t.Helper()
	req, _ := http.NewRequest("GET", c.url+path, nil)
	req.Header.Set("Authorization", "Bearer "+c.token)
	res, e := http.DefaultClient.Do(req)
	if e != nil {
		c.t.Fatal(e)
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		c.t.Fatalf("list %s: %d", path, res.StatusCode)
	}
	var out []map[string]any
	if e = json.NewDecoder(res.Body).Decode(&out); e != nil {
		c.t.Fatal(e)
	}
	return out
}
func TestMVP(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("Set TEST_DATABASE_URL to a dedicated PostgreSQL database.")
	}
	ctx := context.Background()
	must := func(e error) {
		t.Helper()
		if e != nil {
			t.Fatal(e)
		}
	}
	must(database.Migrate(url))
	db, e := database.Open(ctx, url)
	must(e)
	defer db.Close()
	server := httptest.NewServer(httpapi.New(db, "http://localhost:8081"))
	defer server.Close()
	base := client{t: t, url: server.URL}
	// All fixtures are unique and live in the dedicated test database.
	register := func(name string) client {
		v := base.ok("POST", "/v1/auth/register", map[string]string{"name": name, "email": core.ID() + "@test.example", "password": "Tatame123!"})
		return client{t: t, url: server.URL, token: v["token"].(string)}
	}
	admin, teacher, student, outsider := register("Gestor"), register("Professor"), register("Aluno"), register("Outra Academia")
	a := admin.ok("POST", "/v1/academies", map[string]string{"name": "Academia de teste"})
	aid := a["id"].(string)
	prefix := "/v1/academies/" + aid
	b := outsider.ok("POST", "/v1/academies", map[string]string{"name": "Academia isolada"})
	bid := b["id"].(string)
	join := func(who client, role string, academy map[string]any, owner client) {
		q := who.ok("POST", "/v1/membership-requests", map[string]string{"academy_code": academy["code"].(string), "role": role})
		if status, _ := who.request("GET", "/v1/academies/"+academy["id"].(string)+"/classes", nil, ""); status != 403 {
			t.Fatalf("pending membership allowed access: %d", status)
		}
		owner.ok("PATCH", "/v1/academies/"+academy["id"].(string)+"/membership-requests/"+q["id"].(string), map[string]string{"status": "approved"})
	}
	join(teacher, "teacher", a, admin)
	join(student, "student", a, admin)
	join(student, "student", b, outsider)
	var mid, teacherID string
	for _, m := range admin.list(prefix + "/members") {
		if m["name"] == "Aluno" {
			mid = m["id"].(string)
		}
		if m["name"] == "Professor" {
			teacherID = m["id"].(string)
		}
	}
	if len(student.list("/v1/me/academies")) != 2 {
		t.Fatal("student should belong to two academies")
	}
	if status, _ := teacher.request("GET", "/v1/academies/"+bid+"/members", nil, ""); status != 403 {
		t.Fatalf("cross-academy access: %d", status)
	}
	if status, _ := student.request("POST", prefix+"/classes", map[string]string{"name": "Fraude", "teacher_membership_id": teacherID}, ""); status != 403 {
		t.Fatalf("student creating classes: %d", status)
	}
	class := admin.ok("POST", prefix+"/classes", map[string]string{"name": "Jiu-Jitsu Adulto", "teacher_membership_id": teacherID})
	cid := class["id"].(string)
	loc, e := time.LoadLocation("America/Sao_Paulo")
	must(e)
	sc := admin.ok("POST", prefix+"/classes/"+cid+"/schedules", map[string]any{"weekday": int(time.Now().In(loc).Weekday()), "start_time": "19:00", "duration_minutes": 60})
	session := teacher.ok("POST", prefix+"/classes/"+cid+"/sessions", map[string]string{"schedule_id": sc["id"].(string)})
	sid := session["id"].(string)
	again := teacher.ok("POST", prefix+"/classes/"+cid+"/sessions", map[string]string{"schedule_id": sc["id"].(string)})
	if again["id"] != sid {
		t.Fatal("duplicate class session")
	}
	credential := student.ok("GET", prefix+"/me/student-credential", nil)
	// Device activation revokes only the current user's session.
	deviceLogin := base.ok("POST", "/v1/auth/login", map[string]string{"email": getEmail(t, db, admin.token), "password": "Tatame123!"})
	provisioner := client{t: t, url: server.URL, token: deviceLogin["token"].(string)}
	device := provisioner.ok("POST", prefix+"/devices", map[string]string{"name": "Tablet A"})
	kiosk := client{t: t, url: server.URL, token: device["token"].(string)}
	if status, _ := provisioner.request("GET", "/v1/me", nil, ""); status != 401 {
		t.Fatalf("personal session retained on kiosk: %d", status)
	}
	if status, _ := kiosk.request("GET", prefix+"/members", nil, ""); status != 403 {
		t.Fatalf("kiosk access to members: %d", status)
	}
	if status, _ := kiosk.request("GET", "/v1/academies/"+bid+"/sessions", nil, ""); status != 403 {
		t.Fatalf("kiosk crossed academy: %d", status)
	}
	path := prefix + "/sessions/" + sid + "/check-ins"
	body := map[string]string{"qr_token": credential["qr_token"].(string)}
	key := core.ID()
	status, first := kiosk.request("POST", path, body, key)
	if status != 200 {
		t.Fatalf("checkin: %d %v", status, first)
	}
	status, replayed := kiosk.request("POST", path, body, key)
	if status != 200 || replayed["id"] != first["id"] {
		t.Fatal("retry was not idempotent")
	}
	if status, _ := kiosk.request("POST", path, map[string]string{"student_code": credential["student_code"].(string)}, key); status != 409 {
		t.Fatalf("changed event data: %d", status)
	}
	var wg sync.WaitGroup
	errs := make(chan string, 12)
	for range 12 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			status, v := kiosk.request("POST", path, body, core.ID())
			if status != 200 || v["id"] != first["id"] {
				errs <- fmt.Sprintf("%d %v", status, v)
			}
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Error(err)
	}
	if n := len(teacher.list(prefix + "/sessions/" + sid + "/attendances")); n != 1 {
		t.Fatalf("concurrent checkins created %d attendances", n)
	}
	if n := len(student.list(prefix + "/me/attendances")); n != 1 {
		t.Fatalf("student history: %d", n)
	}
	if n := len(student.list("/v1/academies/" + bid + "/me/attendances")); n != 0 {
		t.Fatalf("mixed academy history: %d", n)
	}
	admin.ok("PATCH", prefix+"/members/"+mid, map[string]string{"status": "blocked"})
	if status, _ := kiosk.request("POST", path, body, core.ID()); status != 403 {
		t.Fatalf("blocked student: %d", status)
	}
	admin.ok("PATCH", prefix+"/members/"+mid, map[string]string{"status": "active"})
	teacher.ok("PATCH", prefix+"/sessions/"+sid, map[string]string{"status": "closed"})
	if status, _ := kiosk.request("POST", path, body, core.ID()); status != 409 {
		t.Fatalf("closed class: %d", status)
	}
	admin.ok("DELETE", prefix+"/devices/"+device["id"].(string), nil)
	if status, _ := kiosk.request("GET", prefix+"/sessions", nil, ""); status != 401 {
		t.Fatalf("revoked device: %d", status)
	}
	adminMember := a["membership_id"].(string)
	if status, _ := admin.request("PATCH", prefix+"/members/"+adminMember, map[string]string{"status": "blocked"}, ""); status != 409 {
		t.Fatalf("removed last admin: %d", status)
	}
	if status, _ := student.request("POST", "/v1/membership-requests", map[string]string{"academy_code": a["code"].(string), "role": "admin"}, ""); status != 422 {
		t.Fatalf("self admin grant: %d", status)
	}
	if status, _ := student.request("GET", prefix+"/dashboard?role=admin", nil, ""); status != 403 {
		t.Fatalf("ungranted dashboard role: %d", status)
	}
	dash := student.ok("GET", prefix+"/dashboard?role=student", nil)
	if dash["scope"] != "student" || dash["presences_month"] != float64(1) {
		t.Fatalf("student dashboard: %v", dash)
	}
	schedule2 := admin.ok("POST", prefix+"/classes/"+cid+"/schedules", map[string]any{"weekday": int(time.Now().In(loc).Weekday()), "start_time": "20:00", "duration_minutes": 60})
	cancelled := teacher.ok("POST", prefix+"/classes/"+cid+"/sessions", map[string]string{"schedule_id": schedule2["id"].(string)})
	teacher.ok("PATCH", prefix+"/sessions/"+cancelled["id"].(string), map[string]string{"status": "cancelled"})
	if status, _ := teacher.request("POST", prefix+"/sessions/"+cancelled["id"].(string)+"/check-ins", body, core.ID()); status != 403 {
		t.Fatalf("cancelled session: %d", status)
	}
	logoutSession := base.ok("POST", "/v1/auth/login", map[string]string{"email": getEmail(t, db, student.token), "password": "Tatame123!"})
	loggedOut := client{t: t, url: server.URL, token: logoutSession["token"].(string)}
	loggedOut.ok("POST", "/v1/auth/logout", nil)
	if status, _ := loggedOut.request("GET", "/v1/me", nil, ""); status != 401 {
		t.Fatalf("logout revocation: %d", status)
	}
	_, err := db.Exec(ctx, "UPDATE auth_sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1", core.Hash(student.token))
	must(err)
	if status, _ := student.request("GET", "/v1/me", nil, ""); status != 401 {
		t.Fatalf("expired session: %d", status)
	}

}
func getEmail(t *testing.T, db *pgxpool.Pool, token string) string {
	t.Helper()
	var email string
	if e := db.QueryRow(context.Background(), "SELECT p.email FROM users u JOIN people p ON p.id=u.person_id JOIN auth_sessions s ON s.user_id=u.id WHERE s.token_hash=$1", core.Hash(token)).Scan(&email); e != nil {
		t.Fatal(e)
	}
	return email
}
