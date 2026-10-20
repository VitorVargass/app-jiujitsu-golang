package httpapi_test

import (
	"context"
	"net/http/httptest"
	"os"
	"sync"
	"testing"

	"tatame/backend/internal/core"
	"tatame/backend/internal/database"
	"tatame/backend/internal/httpapi"
)

func TestInvitationRestrictions(t *testing.T) {
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
	register := func(email string) client {
		v := base.ok("POST", "/v1/auth/register", map[string]string{"name": "Conta de teste", "email": email, "password": "Tatame123!"})
		return client{t: t, url: server.URL, token: v["token"].(string)}
	}
	adminEmail := core.ID() + "@invitation.test"
	admin := register(adminEmail)
	outsider := register(core.ID() + "@invitation.test")
	a := admin.ok("POST", "/v1/academies", map[string]string{"name": "Academia do convite"})["id"].(string)
	prefix := "/v1/academies/" + a
	b := outsider.ok("POST", "/v1/academies", map[string]string{"name": "Outra academia"})["id"].(string)
	fixture := func(missingCPF bool) (client, map[string]any, string) {
		email := core.ID() + "@invitation.test"
		st := admin.ok("POST", prefix+"/students", map[string]any{"name": "Aluno convidado", "email": email, "cpf": testCPF(), "birth_date": "1995-04-12", "status": "active"})
		if missingCPF {
			// Legacy records may have no CPF, without active billing.
			if _, err := db.Exec(ctx, "UPDATE academy_participants SET cpf='' WHERE academy_id=$1 AND id=$2", a, st["participant_id"]); err != nil {
				t.Fatal(err)
			}
		}
		who := register(email)
		invite := admin.ok("POST", prefix+"/students/"+st["id"].(string)+"/invitations", nil)
		return who, st, invite["token"].(string)
	}
	expect := func(who client, method, path string, body any, expected int) map[string]any {
		t.Helper()
		code, data := who.request(method, path, body, "")
		if code != expected {
			t.Fatalf("invitation status: got %d, want %d (%v)", code, expected, data)
		}
		return data
	}
	untouched := func(st map[string]any, token string) {
		t.Helper()
		var unlinked, pending bool
		if err := db.QueryRow(ctx, "SELECT s.user_id IS NULL,i.accepted_at IS NULL FROM students s JOIN student_invitations i ON i.academy_id=s.academy_id AND i.student_id=s.id WHERE s.academy_id=$1 AND s.id=$2 AND i.token_hash=$3", a, st["id"], core.Hash(token)).Scan(&unlinked, &pending); err != nil || !unlinked || !pending {
			t.Fatal("failed acceptance changed enrollment or consumed link", err)
		}
	}
	t.Run("identity scope and existing CPF", func(t *testing.T) {
		who, st, token := fixture(false)
		path := "/v1/invitations/" + token
		expect(base, "GET", path, nil, 401)
		response := expect(outsider, "GET", path, nil, 403)
		if response["academy_name"] != nil || response["student_name"] != nil {
			t.Fatal("preview disclosed student details to another identity")
		}
		expect(outsider, "POST", path+"/accept", nil, 403)
		preview := who.ok("GET", path, nil)
		if preview["academy_id"] != a || preview["student_name"] != "Aluno convidado" || preview["cpf_registered"] != true || preview["cpf"] != nil {
			t.Fatal("incorrect or excessive invitation preview", preview)
		}
		expect(who, "POST", path+"/accept", map[string]string{"academy_id": b}, 400)
		expect(who, "POST", path+"/accept", map[string]string{"cpf": "11111111111"}, 422)
		expect(who, "POST", path+"/accept", map[string]string{"cpf": testCPF()}, 409)
		untouched(st, token)
		linked := who.ok("POST", path+"/accept", nil)
		if linked["academy_id"] != a || linked["id"] != st["id"] || linked["cpf"] != st["cpf"] || linked["user_id"] == "" {
			t.Fatal("link changed identity, academy or CPF")
		}
		expect(who, "POST", path+"/accept", nil, 410)
		expect(who, "GET", path, nil, 410)
		expect(who, "GET", "/v1/academies/"+b+"/me/participation", nil, 403)
	})
	t.Run("optional CPF and rollback", func(t *testing.T) {
		who, st, token := fixture(true)
		path := "/v1/invitations/" + token
		if preview := who.ok("GET", path, nil); preview["cpf_registered"] != false {
			t.Fatal("missing CPF cannot be completed")
		}
		_, other, _ := fixture(false)
		expect(who, "POST", path+"/accept", map[string]string{"cpf": other["cpf"].(string)}, 409)
		expect(who, "POST", path+"/accept", map[string]string{"cpf": ""}, 422)
		untouched(st, token)
		cpf := testCPF()
		masked := cpf[:3] + "." + cpf[3:6] + "." + cpf[6:9] + "-" + cpf[9:]
		linked := who.ok("POST", path+"/accept", map[string]string{"cpf": masked})
		if linked["cpf"] != cpf || linked["id"] != st["id"] {
			t.Fatal("CPF not normalized on invited enrollment")
		}
		var invoices int
		if err := db.QueryRow(ctx, "SELECT count(*) FROM invoices WHERE academy_id=$1 AND student_id=$2", a, st["id"]).Scan(&invoices); err != nil || invoices != 0 {
			t.Fatal("invitation created unexpected billing", err)
		}
		without, legacy, token2 := fixture(true)
		got := without.ok("POST", "/v1/invitations/"+token2+"/accept", map[string]any{})
		if got["id"] != legacy["id"] || got["cpf"] != "" {
			t.Fatal("optional CPF became mandatory")
		}
	})
	t.Run("expired revoked replaced archived and device", func(t *testing.T) {
		for _, kind := range []string{"expired", "revoked", "replaced", "archived"} {
			who, st, token := fixture(false)
			switch kind {
			case "expired":
				_, err = db.Exec(ctx, "UPDATE student_invitations SET expires_at=now()-interval '1 second' WHERE token_hash=$1", core.Hash(token))
			case "revoked":
				admin.ok("DELETE", prefix+"/students/"+st["id"].(string)+"/invitations", nil)
			case "replaced":
				admin.ok("POST", prefix+"/students/"+st["id"].(string)+"/invitations", nil)
			case "archived":
				admin.ok("POST", prefix+"/students/"+st["id"].(string)+"/archive", nil)
			}
			if err != nil {
				t.Fatal(err)
			}
			path := "/v1/invitations/" + token
			expect(who, "GET", path, nil, 410)
			expect(who, "POST", path+"/accept", nil, 410)
			untouched(st, token)
		}
		_, _, token := fixture(false)
		login := base.ok("POST", "/v1/auth/login", map[string]string{"email": adminEmail, "password": "Tatame123!"})
		issuer := client{t: t, url: server.URL, token: login["token"].(string)}
		device := issuer.ok("POST", prefix+"/devices", map[string]string{"name": "Tablet de teste"})
		kiosk := client{t: t, url: server.URL, token: device["token"].(string)}
		expect(kiosk, "GET", "/v1/invitations/"+token, nil, 403)
		expect(kiosk, "POST", "/v1/invitations/"+token+"/accept", nil, 403)
	})
	t.Run("concurrent acceptance is single use", func(t *testing.T) {
		who, st, token := fixture(true)
		cpf := testCPF()
		var wg sync.WaitGroup
		codes := make(chan int, 2)
		for i := 0; i < 2; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				code, _ := who.request("POST", "/v1/invitations/"+token+"/accept", map[string]string{"cpf": cpf}, "")
				codes <- code
			}()
		}
		wg.Wait()
		close(codes)
		success, gone := 0, 0
		for code := range codes {
			switch code {
			case 200:
				success++
			case 410:
				gone++
			default:
				t.Fatalf("concurrent acceptance status %d", code)
			}
		}
		if success != 1 || gone != 1 {
			t.Fatal("invitation not single use", success, gone)
		}
		var roles int
		err := db.QueryRow(ctx, "SELECT count(*) FROM memberships m JOIN membership_roles r ON r.membership_id=m.id JOIN students s ON s.academy_id=m.academy_id AND s.user_id=m.user_id WHERE s.academy_id=$1 AND s.id=$2 AND r.role='student'", a, st["id"]).Scan(&roles)
		if err != nil || roles != 1 {
			t.Fatal("duplicate or missing student access", err)
		}
	})
}
