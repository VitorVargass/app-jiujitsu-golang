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

func TestStudentBillingForecast(t *testing.T) {
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
	register := func(name, email string) client {
		data := base.ok("POST", "/v1/auth/register", map[string]string{"name": name, "email": email, "password": "ForecastTest123!"})
		return client{t: t, url: server.URL, token: data["token"].(string)}
	}
	owner := register("Gestor previsão", core.ID()+"@forecast.test")
	outsider := register("Conta externa", core.ID()+"@forecast.test")
	academy := owner.ok("POST", "/v1/academies", map[string]string{"name": "Academia previsão"})["id"].(string)
	prefix := "/v1/academies/" + academy
	email := core.ID() + "@forecast.test"
	student := owner.ok("POST", prefix+"/students", map[string]any{
		"name": "Aluno previsão", "email": email, "cpf": testCPF(), "birth_date": "1990-01-01", "status": "active",
		"billing": map[string]any{"enabled": true, "amount_cents": 15000, "due_day": 31, "first_month": time.Now().Format("2006-01")},
	})
	sid := student["id"].(string)
	invitation := owner.ok("POST", prefix+"/students/"+sid+"/invitations", nil)
	pupil := register("Aluno previsão", email)
	pupil.ok("POST", "/v1/invitations/"+invitation["token"].(string)+"/accept", nil)
	ownPath := prefix + "/me/billing-forecast?student_id=" + sid
	managerPath := prefix + "/students/" + sid + "/billing-forecast"
	if status, _ := outsider.request("GET", ownPath, nil, ""); status != 403 {
		t.Fatal("cross-account forecast", status)
	}
	if status, _ := pupil.request("GET", managerPath, nil, ""); status != 403 {
		t.Fatal("student read manager endpoint", status)
	}
	if _, err = db.Exec(ctx, "UPDATE student_billing SET next_month='2026-02-01' WHERE academy_id=$1 AND student_id=$2", academy, sid); err != nil {
		t.Fatal(err)
	}
	repo := billing.Repository{DB: db}
	now := time.Date(2026, 1, 31, 18, 0, 0, 0, time.UTC)
	values, err := repo.Forecast(ctx, academy, sid, now)
	if err != nil || len(values) != 6 {
		t.Fatal("six projected months", values, err)
	}
	if values[0].Competence != "2026-02" || values[0].DueDate != "2026-02-28" || values[0].AmountCents != 15000 || values[5].Competence != "2026-07" {
		t.Fatal("forecast dates or values", values)
	}
	if _, err = db.Exec(ctx, `INSERT INTO invoices(id,academy_id,student_id,competence,due_date,amount_cents,payer_name,payer_document,status,paid_at,payment_method)
 VALUES($1,$2,$3,'2025-12-01','2025-12-31',15000,'Pagador fictício','52998224725','paid',now(),'cash')`, core.ID(), academy, sid); err != nil {
		t.Fatal(err)
	}
	paidHistory := pupil.ok("GET", prefix+"/me/invoices?student_id="+sid+"&status=paid&page=1", nil)
	if paidHistory["total"] != float64(1) {
		t.Fatal("paid invoice missing from history", paidHistory)
	}
	var beforeInvoices, beforeLinks int
	if err = db.QueryRow(ctx, "SELECT count(*) FROM invoices WHERE academy_id=$1", academy).Scan(&beforeInvoices); err != nil {
		t.Fatal(err)
	}
	if err = db.QueryRow(ctx, "SELECT count(*) FROM checkout_attempts WHERE academy_id=$1", academy).Scan(&beforeLinks); err != nil {
		t.Fatal(err)
	}
	pupil.list(ownPath)
	owner.list(managerPath)
	var afterInvoices, afterLinks int
	if err = db.QueryRow(ctx, "SELECT count(*) FROM invoices WHERE academy_id=$1", academy).Scan(&afterInvoices); err != nil {
		t.Fatal(err)
	}
	if err = db.QueryRow(ctx, "SELECT count(*) FROM checkout_attempts WHERE academy_id=$1", academy).Scan(&afterLinks); err != nil {
		t.Fatal(err)
	}
	if beforeInvoices != afterInvoices || beforeLinks != afterLinks {
		t.Fatal("reading a forecast created invoices or checkout links")
	}
	if _, err = db.Exec(ctx, `INSERT INTO invoices(id,academy_id,student_id,competence,due_date,amount_cents,payer_name,payer_document,status)
 VALUES($1,$2,$3,'2026-03-01','2026-03-31',15000,'Pagador fictício','52998224725','cancelled')`, core.ID(), academy, sid); err != nil {
		t.Fatal(err)
	}
	values, err = repo.Forecast(ctx, academy, sid, now)
	if err != nil || len(values) != 5 {
		t.Fatal("issued month duplicated in forecast", values, err)
	}
	for _, month := range values {
		if month.Competence == "2026-03" {
			t.Fatal("cancelled invoice reappeared as forecast")
		}
	}
	if _, err = db.Exec(ctx, "UPDATE student_billing SET next_month='2026-01-01' WHERE academy_id=$1 AND student_id=$2", academy, sid); err != nil {
		t.Fatal(err)
	}
	values, err = repo.Forecast(ctx, academy, sid, time.Date(2026, 2, 1, 1, 0, 0, 0, time.UTC))
	if err != nil || values[0].Competence != "2026-02" {
		t.Fatal("academy timezone ignored", values, err)
	}
	if _, err = db.Exec(ctx, "UPDATE student_billing SET next_month='2028-02-01' WHERE academy_id=$1 AND student_id=$2", academy, sid); err != nil {
		t.Fatal(err)
	}
	values, err = repo.Forecast(ctx, academy, sid, now)
	if err != nil || values[0].DueDate != "2028-02-29" {
		t.Fatal("scheduled start or leap day ignored", values, err)
	}
	for _, change := range []string{
		"UPDATE student_billing SET enabled=false WHERE academy_id=$1 AND student_id=$2",
		"UPDATE students SET status='inactive' WHERE academy_id=$1 AND id=$2",
		"UPDATE students SET status='inactive',archived_at=now() WHERE academy_id=$1 AND id=$2",
	} {
		if _, err = db.Exec(ctx, "UPDATE student_billing SET enabled=true WHERE academy_id=$1 AND student_id=$2", academy, sid); err != nil {
			t.Fatal(err)
		}
		if _, err = db.Exec(ctx, "UPDATE students SET status='active',archived_at=NULL WHERE academy_id=$1 AND id=$2", academy, sid); err != nil {
			t.Fatal(err)
		}
		if _, err = db.Exec(ctx, change, academy, sid); err != nil {
			t.Fatal(err)
		}
		values, err = repo.Forecast(ctx, academy, sid, now)
		if err != nil || len(values) != 0 {
			t.Fatal("inactive contract forecast", values, err)
		}
	}
}
