package httpapi_test

import (
	"context"
	"net/http/httptest"
	"os"
	"tatame/backend/internal/core"
	"tatame/backend/internal/database"
	"tatame/backend/internal/httpapi"
	"tatame/backend/internal/payments"
	"tatame/backend/internal/subscriptions"
	"testing"
	"time"
)

func TestOnboardingContract(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("Set isolated TEST_DATABASE_URL")
	}
	if err := database.Migrate(url); err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	db, err := database.Open(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	bank := payments.New(db, nil)
	bank.Subscriptions = subscriptions.New(db, subscriptions.Config{Enabled: true})
	server := httptest.NewServer(httpapi.NewWithPayments(db, "", bank))
	defer server.Close()
	c := client{t: t, url: server.URL}
	email := core.ID() + "@onboarding.test"
	input := map[string]string{"name": "Gestor teste", "email": email, "password": "Test-Password-42!", "password_confirmation": "different", "terms_version": core.LegalVersion, "privacy_version": core.LegalVersion}
	if code, _ := c.request("POST", "/v1/auth/register", input, ""); code != 422 {
		t.Fatal("password mismatch accepted", code)
	}
	input["password_confirmation"] = input["password"]
	input["privacy_version"] = ""
	if code, _ := c.request("POST", "/v1/auth/register", input, ""); code != 422 {
		t.Fatal("privacy acknowledgement missing", code)
	}
	var count int
	if err = db.QueryRow(ctx, "SELECT count(*) FROM people WHERE email=$1", email).Scan(&count); err != nil || count != 0 {
		t.Fatal("invalid request persisted account", count, err)
	}
	input["privacy_version"] = core.LegalVersion
	code, result := c.request("POST", "/v1/auth/register", input, "")
	if code != 201 {
		t.Fatal(code, result)
	}
	c.token = result["token"].(string)
	id := result["user"].(map[string]any)["id"].(string)
	var terms, privacy string
	var accepted time.Time
	if err = db.QueryRow(ctx, "SELECT terms_version,privacy_version,accepted_at FROM account_legal_acceptances WHERE user_id=$1", id).Scan(&terms, &privacy, &accepted); err != nil || terms != core.LegalVersion || privacy != core.LegalVersion || accepted.IsZero() {
		t.Fatal("acknowledgement not durable", err)
	}
	if code, _ = c.request("POST", "/v1/academies", map[string]string{"name": "Sem plano", "terms_version": core.LegalVersion}, ""); code != 422 {
		t.Fatal("missing plan accepted", code)
	}
	if code, _ = c.request("POST", "/v1/academies", map[string]string{"name": "Sem aceite", "plan_id": "professional"}, ""); code != 422 {
		t.Fatal("subscription acceptance missing", code)
	}
	before := time.Now()
	academy := c.ok("POST", "/v1/academies", map[string]string{"name": "Teste profissional", "plan_id": "professional"})
	a := academy["id"].(string)
	base := "/v1/academies/" + a
	status := c.ok("GET", base+"/subscription", nil)
	if status["status"] != "trial" || status["amount_cents"] != float64(25000) || status["selected_plan_id"] != "professional" || status["restricted"] != false {
		t.Fatal(status)
	}
	end, err := time.Parse(time.RFC3339Nano, status["trial_ends_at"].(string))
	if err != nil || end.Sub(before) < 5*24*time.Hour-time.Minute || end.Sub(before) > 5*24*time.Hour+time.Minute {
		t.Fatal("trial length", end, err)
	}
	cycle := status["cycle"].(map[string]any)
	if cycle["amount_cents"] != float64(25000) || cycle["active_students"] != float64(0) {
		t.Fatal("selected plan must not inflate student count", cycle)
	}
	if _, err = db.Exec(ctx, "UPDATE platform_subscriptions SET trial_ends_at=now()-interval '1 second',paid_until=now()-interval '1 second' WHERE academy_id=$1", a); err != nil {
		t.Fatal(err)
	}
	status = c.ok("GET", base+"/subscription", nil)
	if status["status"] != "overdue" || status["restricted"] != true {
		t.Fatal("trial received extra grace", status)
	}
	if code, _ = c.request("POST", base+"/classes", map[string]string{"name": "Restrita"}, ""); code != 402 {
		t.Fatal("unpaid trial can mutate", code)
	}
	c.ok("GET", base+"/classes", nil)
}
