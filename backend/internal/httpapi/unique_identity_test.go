package httpapi_test

import (
	"context"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"tatame/backend/internal/core"
	"tatame/backend/internal/database"
	"tatame/backend/internal/httpapi"
	"testing"
)

func TestStrictUniqueStudentIdentity(t *testing.T) {
	address := os.Getenv("TEST_DATABASE_URL")
	if address == "" {
		t.Skip("isolated PostgreSQL required")
	}
	if e := database.Migrate(address); e != nil {
		t.Fatal(e)
	}
	db, e := database.Open(context.Background(), address)
	if e != nil {
		t.Fatal(e)
	}
	defer db.Close()
	server := httptest.NewServer(httpapi.New(db, ""))
	defer server.Close()
	base := client{t: t, url: server.URL}
	adminEmail := core.ID() + "@unique.test"
	account := base.ok("POST", "/v1/auth/register", map[string]string{"name": "Gestor QA", "email": adminEmail, "password": "Tatame123!"})
	admin := client{t: t, url: server.URL, token: account["token"].(string)}
	a := admin.ok("POST", "/v1/academies", map[string]string{"name": "Academia A"})["id"].(string)
	b := admin.ok("POST", "/v1/academies", map[string]string{"name": "Academia B"})["id"].(string)
	prefix := "/v1/academies/" + a
	body := func(email, cpf string) map[string]any {
		return map[string]any{"name": "Aluno único", "email": email, "cpf": cpf, "birth_date": "2000-01-01", "phone": "41988887777"}
	}
	email, cpf := core.ID()+"@unique.test", testCPF()
	original := admin.ok("POST", prefix+"/students", body(email, cpf))
	sid := original["id"].(string)
	for _, academy := range []string{a, b} {
		for _, flag := range []string{"reuse_existing_identity", "use_my_account"} {
			in := body(strings.ToUpper(email), testCPF())
			in[flag] = true
			if code, _ := admin.request("POST", "/v1/academies/"+academy+"/students", in, ""); code != 409 {
				t.Fatal("email bypass", flag, code)
			}
		}
	}
	mine := body(adminEmail, testCPF())
	mine["use_my_account"] = true
	if code, _ := admin.request("POST", prefix+"/students", mine, ""); code != 409 {
		t.Fatal("manager email reused", code)
	}
	if code, _ := admin.request("POST", "/v1/academies/"+b+"/students", body(core.ID()+"@unique.test", cpf), ""); code != 409 {
		t.Fatal("cross-academy CPF duplicate", code)
	}
	// Updating the same record is allowed; shared phone numbers are also allowed.
	admin.ok("PATCH", prefix+"/students/"+sid, body(email, cpf))
	second := admin.ok("POST", prefix+"/students", body(core.ID()+"@unique.test", testCPF()))
	if code, _ := admin.request("PATCH", prefix+"/students/"+second["id"].(string), body(email, second["cpf"].(string)), ""); code != 409 {
		t.Fatal("duplicate email edit", code)
	}
	probe := admin.ok("POST", "/v1/academies/"+b+"/students/check-identity", map[string]string{"email": email, "cpf": cpf})
	if probe["email_exists"] != true || probe["cpf_exists"] != true {
		t.Fatal("preflight not global", probe)
	}
	// Simultaneous claims in different academies must not share a CPF.
	raceCPF := testCPF()
	codes := make(chan int, 2)
	var wg sync.WaitGroup
	for _, academy := range []string{a, b} {
		wg.Add(1)
		go func(a string) {
			defer wg.Done()
			code, _ := admin.request("POST", "/v1/academies/"+a+"/students", body(core.ID()+"@race-unique.test", raceCPF), "")
			codes <- code
		}(academy)
	}
	wg.Wait()
	close(codes)
	success, conflict := 0, 0
	for code := range codes {
		if code == 200 {
			success++
		} else if code == 409 {
			conflict++
		} else {
			t.Fatal("unexpected race result", code)
		}
	}
	if success != 1 || conflict != 1 {
		t.Fatal("CPF race", success, conflict)
	}
	// Archived registrations retain their identity reservation.
	admin.ok("POST", prefix+"/students/"+sid+"/archive", nil)
	if code, _ := admin.request("POST", prefix+"/students", body(core.ID()+"@unique.test", cpf), ""); code != 409 {
		t.Fatal("archived CPF reused", code)
	}
}
