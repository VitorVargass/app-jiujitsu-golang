package httpapi_test

import (
	"context"
	"golang.org/x/crypto/bcrypt"
	"net/http/httptest"
	"os"
	"sync"
	"tatame/backend/internal/core"
	"tatame/backend/internal/database"
	"tatame/backend/internal/httpapi"
	"testing"
)

func TestTemporaryStudentAccess(t *testing.T) {
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
		value := base.ok("POST", "/v1/auth/register", map[string]string{"name": name, "email": core.ID() + "@temporary.test", "password": "ExistingAccount123!"})
		return client{t: t, url: server.URL, token: value["token"].(string)}
	}
	admin, other := register("Gestor"), register("Outro gestor")
	academy := admin.ok("POST", "/v1/academies", map[string]string{"name": "Acesso temporário"})["id"].(string)
	prefix := "/v1/academies/" + academy
	createStudent := func(email, birth string) map[string]any {
		return admin.ok("POST", prefix+"/students", map[string]any{"name": "Aluno temporário", "email": email, "cpf": testCPF(), "birth_date": birth, "status": "active"})
	}
	student := createStudent(core.ID()+"@temporary.test", "1990-01-01")
	path := prefix + "/students/" + student["id"].(string) + "/temporary-access"
	if status, _ := other.request("POST", path, nil, ""); status != 403 {
		t.Fatal("tenant isolation", status)
	}
	issued := admin.ok("POST", path, nil)
	email, password := issued["email"].(string), issued["temporary_password"].(string)
	if len(password) < 16 || issued["expires_at"] == nil {
		t.Fatal("missing temporary credential")
	}
	if status, _ := admin.request("POST", path, nil, ""); status != 409 {
		t.Fatal("duplicate issuance", status)
	}
	var hash string
	var legal int
	if err = db.QueryRow(ctx, "SELECT password_hash FROM users u JOIN people p ON p.id=u.person_id WHERE p.email=$1", email).Scan(&hash); err != nil {
		t.Fatal(err)
	}
	if hash == password || bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil {
		t.Fatal("password was not hashed")
	}
	if err = db.QueryRow(ctx, "SELECT count(*) FROM account_legal_acceptances l JOIN users u ON u.id=l.user_id JOIN people p ON p.id=u.person_id WHERE p.email=$1", email).Scan(&legal); err != nil || legal != 0 {
		t.Fatal("manager accepted legal terms for student", err)
	}
	login := base.ok("POST", "/v1/auth/login", map[string]string{"email": email, "password": password})
	if login["user"].(map[string]any)["password_change_required"] != true {
		t.Fatal("first access flag missing")
	}
	pending := client{t: t, url: server.URL, token: login["token"].(string)}
	if status, _ := pending.request("GET", "/v1/me/academies", nil, ""); status != 403 {
		t.Fatal("temporary account accessed portal", status)
	}
	body := map[string]string{"password": "MyNewPassword123!", "password_confirmation": "MyNewPassword123!", "terms_version": core.LegalVersion, "privacy_version": core.LegalVersion}
	if status, _ := base.request("POST", "/v1/auth/first-access", body, ""); status != 401 {
		t.Fatal("unauthenticated password change", status)
	}
	body["password_confirmation"] = "mismatch"
	if status, _ := pending.request("POST", "/v1/auth/first-access", body, ""); status != 422 {
		t.Fatal("mismatch accepted", status)
	}
	body["password_confirmation"] = body["password"]
	body["terms_version"] = "old"
	if status, _ := pending.request("POST", "/v1/auth/first-access", body, ""); status != 422 {
		t.Fatal("outdated terms accepted", status)
	}
	body["terms_version"] = core.LegalVersion
	body["password"] = password
	body["password_confirmation"] = password
	if status, _ := pending.request("POST", "/v1/auth/first-access", body, ""); status != 422 {
		t.Fatal("unchanged temporary password accepted", status)
	}
	body["password"] = "MyNewPassword123!"
	body["password_confirmation"] = body["password"]
	activated := pending.ok("POST", "/v1/auth/first-access", body)
	if activated["user"].(map[string]any)["password_change_required"] != false {
		t.Fatal("account remains pending")
	}
	active := client{t: t, url: server.URL, token: activated["token"].(string)}
	if status, _ := pending.request("GET", "/v1/me", nil, ""); status != 401 {
		t.Fatal("temporary session survived activation", status)
	}
	if status, _ := base.request("POST", "/v1/auth/login", map[string]string{"email": email, "password": password}, ""); status != 401 {
		t.Fatal("temporary password survived activation", status)
	}
	base.ok("POST", "/v1/auth/login", map[string]string{"email": email, "password": body["password"]})
	active.list("/v1/me/academies")
	if status, _ := active.request("POST", "/v1/auth/first-access", body, ""); status != 409 {
		t.Fatal("normal account reset through first access", status)
	}

	minor := createStudent(core.ID()+"@temporary.test", "2015-01-01")
	if status, _ := admin.request("POST", prefix+"/students/"+minor["id"].(string)+"/temporary-access", nil, ""); status != 422 {
		t.Fatal("minor account issued", status)
	}
	missingEmail := createStudent("", "1990-01-01")
	if status, _ := admin.request("POST", prefix+"/students/"+missingEmail["id"].(string)+"/temporary-access", nil, ""); status != 422 {
		t.Fatal("missing email accepted", status)
	}

	existingEmail := core.ID() + "@temporary.test"
	existing := createStudent(existingEmail, "1990-01-01")
	base.ok("POST", "/v1/auth/register", map[string]string{"name": "Conta existente", "email": existingEmail, "password": "ExistingAccount123!"})
	if status, _ := admin.request("POST", prefix+"/students/"+existing["id"].(string)+"/temporary-access", nil, ""); status != 409 {
		t.Fatal("existing account overwritten", status)
	}
	base.ok("POST", "/v1/auth/login", map[string]string{"email": existingEmail, "password": "ExistingAccount123!"})

	racing := createStudent(core.ID()+"@temporary.test", "1990-01-01")
	var wg sync.WaitGroup
	statuses := make(chan int, 2)
	for range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			status, _ := admin.request("POST", prefix+"/students/"+racing["id"].(string)+"/temporary-access", nil, "")
			statuses <- status
		}()
	}
	wg.Wait()
	close(statuses)
	counts := map[int]int{}
	for status := range statuses {
		counts[status]++
	}
	if counts[201] != 1 || counts[409] != 1 {
		t.Fatal("concurrent issuance", counts)
	}

	expired := createStudent(core.ID()+"@temporary.test", "1990-01-01")
	credential := admin.ok("POST", prefix+"/students/"+expired["id"].(string)+"/temporary-access", nil)
	expLogin := base.ok("POST", "/v1/auth/login", map[string]string{"email": credential["email"].(string), "password": credential["temporary_password"].(string)})
	if _, err = db.Exec(ctx, "UPDATE users SET temporary_password_expires_at=now()-interval '1 second' WHERE person_id=$1", expired["person_id"]); err != nil {
		t.Fatal(err)
	}
	if status, _ := base.request("POST", "/v1/auth/login", map[string]string{"email": credential["email"].(string), "password": credential["temporary_password"].(string)}, ""); status != 401 {
		t.Fatal("expired password accepted", status)
	}
	expClient := client{t: t, url: server.URL, token: expLogin["token"].(string)}
	if status, _ := expClient.request("GET", "/v1/me", nil, ""); status != 401 {
		t.Fatal("expired temporary session accepted", status)
	}
}
