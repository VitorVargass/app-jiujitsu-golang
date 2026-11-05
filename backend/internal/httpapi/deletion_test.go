package httpapi_test

import (
	"context"
	"net/http/httptest"
	"os"
	"sync"
	"tatame/backend/internal/auth"
	"tatame/backend/internal/core"
	"tatame/backend/internal/database"
	"tatame/backend/internal/httpapi"
	"testing"
)

func TestAccountDeletion(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("requires disposable TEST_DATABASE_URL")
	}
	ctx := context.Background()
	if e := database.Migrate(url); e != nil {
		t.Fatal(e)
	}
	db, e := database.Open(ctx, url)
	if e != nil {
		t.Fatal(e)
	}
	defer db.Close()
	server := httptest.NewServer(httpapi.New(db, ""))
	defer server.Close()
	base := client{t: t, url: server.URL}
	register := func() (client, string, string) {
		email := core.ID() + "@test.example"
		v := base.ok("POST", "/v1/auth/register", map[string]string{"name": "Teste exclusão", "email": email, "password": "Deletion123!"})
		return client{t: t, url: server.URL, token: v["token"].(string)}, v["user"].(map[string]any)["id"].(string), email
	}
	user, uid, email := register()
	other, _, _ := register()
	path := "/v1/auth/deletion-requests"
	input := map[string]any{"password": "Deletion123!", "confirm": true}
	if status, _ := base.request("POST", path, input, ""); status != 401 {
		t.Fatalf("anonymous: %d", status)
	}
	if status, _ := user.request("POST", path, map[string]any{"password": "wrong", "confirm": true}, ""); status != 403 {
		t.Fatalf("password: %d", status)
	}
	if status, _ := user.request("POST", path, map[string]any{"password": "Deletion123!", "confirm": false}, ""); status != 422 {
		t.Fatalf("confirmation: %d", status)
	}
	if status, _ := other.request("POST", path, map[string]any{"password": "Deletion123!", "confirm": true, "user_id": uid}, ""); status != 400 {
		t.Fatalf("third party ID: %d", status)
	}
	first := user.ok("POST", path, input)
	rid := first["id"].(string)
	var wg sync.WaitGroup
	for i := 0; i < 3; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			v := user.ok("POST", path, input)
			if v["id"] != rid {
				t.Error("duplicate protocol")
			}
		}()
	}
	wg.Wait()
	var count int
	if e = db.QueryRow(ctx, "SELECT count(*) FROM account_deletion_requests WHERE user_id=$1", uid).Scan(&count); e != nil || count != 1 {
		t.Fatalf("request count %d: %v", count, e)
	}
	// Multiple academies: no creator ownership assumption, each role reviewed.
	a := user.ok("POST", "/v1/academies", map[string]string{"name": "Primeira"})["id"].(string)
	b := user.ok("POST", "/v1/academies", map[string]string{"name": "Segunda"})["id"].(string)
	if _, e = db.Exec(ctx, "UPDATE account_deletion_requests SET status='reviewing' WHERE id=$1", rid); e != nil {
		t.Fatal(e)
	}
	finish := func() error {
		_, e := db.Exec(ctx, "SELECT complete_account_deletion($1,'test-case-reviewed')", rid)
		return e
	}
	if finish() == nil {
		t.Fatal("sole manager completed")
	}
	user.ok("POST", "/v1/academies/"+a+"/managers", map[string]string{"name": "Novo gestor", "email": core.ID() + "@test.example", "password": "Deletion123!"})
	if finish() == nil {
		t.Fatal("multiple managers must require explicit transfer")
	}
	// Manual operator transfer: leave another manager responsible for academy A.
	if _, e = db.Exec(ctx, `DELETE FROM membership_roles r USING memberships m WHERE r.membership_id=m.id AND m.user_id=$1 AND m.academy_id=$2 AND r.role='admin'`, uid, a); e != nil {
		t.Fatal(e)
	}
	if finish() == nil {
		t.Fatal("second academy still needs transfer")
	}
	user.ok("POST", "/v1/academies/"+b+"/managers", map[string]string{"name": "Gestor segunda", "email": core.ID() + "@test.example", "password": "Deletion123!"})
	if _, e = db.Exec(ctx, `DELETE FROM membership_roles r USING memberships m WHERE r.membership_id=m.id AND m.user_id=$1 AND m.academy_id=$2 AND r.role='admin'`, uid, b); e != nil {
		t.Fatal(e)
	}
	device, token := core.ID(), core.Token()
	if _, e = db.Exec(ctx, `INSERT INTO devices(id,academy_id,name,token_hash) VALUES($1,$2,'Compartilhado',$3)`, device, a, core.Hash(token)); e != nil {
		t.Fatal(e)
	}
	deviceClient := client{t: t, url: server.URL, token: token}
	if status, _ := deviceClient.request("POST", path, input, ""); status != 403 {
		t.Fatalf("device requested personal deletion: %d", status)
	}
	// Two academy enrollments retain their own reviewed history, without login.
	if _, e = db.Exec(ctx, `INSERT INTO students(id,academy_id,user_id,person_id,participant_id,name)
	 SELECT gen_random_uuid(),p.academy_id,u.id,u.person_id,p.id,'Nome conservado por decisão da academia'
	 FROM users u JOIN academy_participants p ON p.person_id=u.person_id WHERE u.id=$1`, uid); e != nil {
		t.Fatal(e)
	}
	if e = finish(); e != nil {
		t.Fatal(e)
	}
	if e = finish(); e != nil {
		t.Fatal("repeat completion", e)
	}
	if status, _ := user.request("GET", "/v1/me", nil, ""); status != 401 {
		t.Fatalf("session survived %d", status)
	}
	if status, _ := base.request("POST", "/v1/auth/login", map[string]string{"email": email, "password": "Deletion123!"}, ""); status != 401 {
		t.Fatalf("login survived %d", status)
	}
	repo := auth.Repository{DB: db}
	if _, e = repo.Session(ctx, uid); e == nil {
		t.Fatal("new session on tombstone")
	}
	if _, e = repo.Principal(ctx, token); e != nil {
		t.Fatal("shared device revoked", e)
	}
	if e = db.QueryRow(ctx, `SELECT count(*) FROM students s JOIN users u ON u.person_id=s.person_id WHERE u.id=$1 AND s.user_id IS NULL`, uid).Scan(&count); e != nil || count != 2 {
		t.Fatalf("academy histories not preserved/detached: %d %v", count, e)
	}
	// Ordinary user without academy can complete after review.
	plain, pid, _ := register()
	req := plain.ok("POST", path, input)
	if _, e = db.Exec(ctx, "UPDATE account_deletion_requests SET status='reviewing' WHERE id=$1", req["id"]); e != nil {
		t.Fatal(e)
	}
	if _, e = db.Exec(ctx, "SELECT complete_account_deletion($1,'ordinary-case-reviewed')", req["id"]); e != nil {
		t.Fatal(e)
	}
	if e = db.QueryRow(ctx, "SELECT count(*) FROM auth_sessions WHERE user_id=$1", pid).Scan(&count); e != nil || count != 0 {
		t.Fatalf("sessions: %d %v", count, e)
	}
}
