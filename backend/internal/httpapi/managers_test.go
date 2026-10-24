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
)

func TestAcademyManagers(t *testing.T) {
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
	password := "Test-Mat-42!"
	register := func(name string) (client, string, string) {
		email := core.ID() + "@manager.test"
		v := base.ok("POST", "/v1/auth/register", map[string]string{"name": name, "email": email, "password": password})
		return client{t: t, url: server.URL, token: v["token"].(string)}, email, v["user"].(map[string]any)["id"].(string)
	}
	owner, _, ownerID := register("Primeiro gestor")
	outsider, existingEmail, existingID := register("Conta existente")
	student, _, _ := register("Aluno sem permissão")
	academy := owner.ok("POST", "/v1/academies", map[string]string{"name": "Equipe gestores"})
	a := academy["id"].(string)
	prefix := "/v1/academies/" + a
	other := outsider.ok("POST", "/v1/academies", map[string]string{"name": "Outra academia"})
	request := student.ok("POST", "/v1/membership-requests", map[string]string{"academy_code": academy["code"].(string), "role": "student"})
	owner.ok("PATCH", prefix+"/membership-requests/"+request["id"].(string), map[string]string{"status": "approved"})
	input := map[string]any{"name": "Nova gestora", "email": core.ID() + "@manager.test", "password": password}
	for _, who := range []client{student, outsider} {
		if status, _ := who.request("POST", prefix+"/managers", input, ""); status != 403 {
			t.Fatalf("unauthorized creation: %d", status)
		}
		if status, _ := who.request("GET", prefix+"/managers", nil, ""); status != 403 {
			t.Fatalf("unauthorized list: %d", status)
		}
	}
	if status, _ := base.request("POST", prefix+"/managers", input, ""); status != 401 {
		t.Fatalf("anonymous creation: %d", status)
	}
	deviceToken := core.Token()
	if _, err = db.Exec(ctx, "INSERT INTO devices(id,academy_id,name,token_hash) VALUES($1,$2,'Dispositivo teste',$3)", core.ID(), a, core.Hash(deviceToken)); err != nil {
		t.Fatal(err)
	}
	device := client{t: t, url: server.URL, token: deviceToken}
	if status, _ := device.request("POST", prefix+"/managers", input, ""); status != 403 {
		t.Fatalf("device creation: %d", status)
	}
	created := owner.ok("POST", prefix+"/managers", input)
	if created["email"] != input["email"] || created["user_id"] == ownerID || created["password"] != nil || created["password_hash"] != nil || created["token"] != nil {
		t.Fatalf("unexpected manager response: %v", created)
	}
	login := base.ok("POST", "/v1/auth/login", map[string]string{"email": input["email"].(string), "password": password})
	newManager := client{t: t, url: server.URL, token: login["token"].(string)}
	if len(newManager.list(prefix+"/managers")) != 2 {
		t.Fatal("new manager cannot see shared academy")
	}
	if len(newManager.list("/v1/me/academies")) != 1 {
		t.Fatal("new manager gained unrelated academy")
	}
	var enrollments int
	if err = db.QueryRow(ctx, "SELECT count(*) FROM students WHERE academy_id=$1 AND user_id=$2", a, created["user_id"]).Scan(&enrollments); err != nil || enrollments != 0 {
		t.Fatal("manager created unwanted student enrollment", enrollments, err)
	}
	if status, _ := owner.request("POST", prefix+"/managers", map[string]any{"email": input["email"], "link_existing": true}, ""); status != 409 {
		t.Fatalf("duplicate manager: %d", status)
	}
	if status, _ := owner.request("POST", prefix+"/managers", map[string]any{"name": "Do not replace", "email": existingEmail, "password": "Changed-Password!"}, ""); status != 409 {
		t.Fatalf("existing account needs confirmation: %d", status)
	}
	if status, _ := owner.request("POST", prefix+"/managers", map[string]any{"email": existingEmail, "link_existing": true, "password": "Changed-Password!"}, ""); status != 422 {
		t.Fatalf("existing password must not be accepted: %d", status)
	}
	linked := owner.ok("POST", prefix+"/managers", map[string]any{"email": existingEmail, "link_existing": true})
	if linked["user_id"] != existingID || linked["name"] != "Conta existente" {
		t.Fatal("existing identity was replaced")
	}
	base.ok("POST", "/v1/auth/login", map[string]string{"email": existingEmail, "password": password})
	if status, _ := base.request("POST", "/v1/auth/login", map[string]string{"email": existingEmail, "password": "Changed-Password!"}, ""); status != 401 {
		t.Fatal("existing password changed")
	}
	if len(outsider.list("/v1/me/academies")) != 2 {
		t.Fatal("existing memberships were lost")
	}
	missing := core.ID() + "@manager.test"
	if status, _ := owner.request("POST", prefix+"/managers", map[string]any{"email": missing, "link_existing": true}, ""); status != 404 {
		t.Fatalf("missing account: %d", status)
	}
	var count int
	if err = db.QueryRow(ctx, "SELECT count(*) FROM people WHERE email=$1", missing).Scan(&count); err != nil || count != 0 {
		t.Fatal("failed linking left orphan identity", err)
	}
	for _, bad := range []map[string]any{
		{"name": "Test", "email": "invalid", "password": password},
		{"name": "Test", "email": core.ID() + "@manager.test", "password": "short"},
		{"name": "Test", "email": core.ID() + "@manager.test", "password": password, "role": "student"},
	} {
		status, _ := owner.request("POST", prefix+"/managers", bad, "")
		if status != 422 && status != 400 {
			t.Fatalf("invalid input: %d", status)
		}
	}
	// Reuse a canonical person that does not have login credentials yet.
	personEmail := core.ID() + "@manager.test"
	personID := core.ID()
	if _, err = db.Exec(ctx, "INSERT INTO people(id,email) VALUES($1,$2)", personID, personEmail); err != nil {
		t.Fatal(err)
	}
	reused := owner.ok("POST", prefix+"/managers", map[string]any{"name": "Pessoa já cadastrada", "email": personEmail, "password": password})
	var savedPerson string
	if err = db.QueryRow(ctx, "SELECT person_id FROM users WHERE id=$1", reused["user_id"]).Scan(&savedPerson); err != nil || savedPerson != personID {
		t.Fatal("canonical identity was duplicated", err)
	}
	// Concurrent submissions produce exactly one account and membership.
	concurrentEmail := core.ID() + "@manager.test"
	codes := make(chan int, 2)
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			status, _ := owner.request("POST", prefix+"/managers", map[string]any{"name": "Envio simultâneo", "email": concurrentEmail, "password": password}, "")
			codes <- status
		}()
	}
	wg.Wait()
	close(codes)
	success, conflict := 0, 0
	for status := range codes {
		if status == 201 {
			success++
		} else if status == 409 {
			conflict++
		} else {
			t.Fatalf("concurrent status: %d", status)
		}
	}
	if success != 1 || conflict != 1 {
		t.Fatal("concurrent grant duplicated", success, conflict)
	}
	if err = db.QueryRow(ctx, `SELECT count(*) FROM memberships m JOIN users u ON u.id=m.user_id JOIN people p ON p.id=u.person_id WHERE m.academy_id=$1 AND p.email=$2`, a, concurrentEmail).Scan(&count); err != nil || count != 1 {
		t.Fatal("duplicate membership", count, err)
	}
	// The pre-existing protection for the final active manager remains intact.
	if status, _ := outsider.request("PATCH", "/v1/academies/"+other["id"].(string)+"/members/"+other["membership_id"].(string), map[string]string{"status": "blocked"}, ""); status != 409 {
		t.Fatalf("last manager was removed: %d", status)
	}
}
