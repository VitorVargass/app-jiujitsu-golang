package subscriptions

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"tatame/backend/internal/core"
	"tatame/backend/internal/database"
	"testing"
	"time"
)

func TestSubscriptionPlanDatabase(t *testing.T) {
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
	a := core.ID()
	if _, err = db.Exec(ctx, "INSERT INTO academies(id,name,code) VALUES($1,'Plan test',$2)", a, a); err != nil {
		t.Fatal(err)
	}
	// Test-only identities: no real accounts or provider calls.
	_, err = db.Exec(ctx, `WITH persons AS (
	 INSERT INTO people(id) SELECT gen_random_uuid() FROM generate_series(1,1002) RETURNING id
	), participants AS (
	 INSERT INTO academy_participants(id,academy_id,person_id,student_code,qr_token)
	 SELECT id,$1,id,'',id::text FROM persons RETURNING id,person_id
	) INSERT INTO students(id,academy_id,person_id,participant_id,name,status)
	 SELECT id,$1,person_id,id,'Plan test','inactive' FROM participants`, a)
	if err != nil {
		t.Fatal(err)
	}
	m := New(db, Config{Enabled: true})
	for _, tc := range []struct {
		count int
		price int64
	}{{200, 15000}, {201, 25000}, {999, 25000}, {1000, 45000}, {200, 15000}} {
		_, err = db.Exec(ctx, `UPDATE students SET status='inactive',archived_at=NULL WHERE academy_id=$1`, a)
		if err != nil {
			t.Fatal(err)
		}
		_, err = db.Exec(ctx, `UPDATE students SET status='active' WHERE id IN(SELECT id FROM students WHERE academy_id=$1 ORDER BY id LIMIT $2)`, a, tc.count+1)
		if err != nil {
			t.Fatal(err)
		}
		// An archived enrollment must not increase the billed count.
		_, err = db.Exec(ctx, `UPDATE students SET status='inactive',archived_at=now() WHERE id=(SELECT id FROM students WHERE academy_id=$1 AND status='active' ORDER BY id DESC LIMIT 1)`, a)
		if err != nil {
			t.Fatal(err)
		}
		v, err := m.snapshot(ctx, a, true)
		if err != nil {
			t.Fatal(err)
		}
		if v.ActiveStudents != tc.count || v.Price != tc.price || v.Cycle.Amount != tc.price {
			t.Fatalf("%+v", v)
		}
	}
	v, err := m.snapshot(ctx, a, true)
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(ctx, `INSERT INTO platform_subscription_attempts(id,academy_id,cycle_id,reference,receiver_handle,amount_cents,state,expires_at) VALUES($1,$2,$3,$4,'test',15000,'ready',now()+interval '1 day')`, core.ID(), a, v.Cycle.ID, core.ID())
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(ctx, "UPDATE students SET status='active',archived_at=NULL WHERE academy_id=$1", a)
	if err != nil {
		t.Fatal(err)
	}
	v, err = m.snapshot(ctx, a, true)
	if err != nil {
		t.Fatal(err)
	}
	if v.Price != 45000 || v.Cycle.Amount != 15000 || v.Checkout.Amount != 15000 {
		t.Fatalf("issued price changed: %+v", v)
	}
	// A new period uses the updated tier; the issued period stays immutable.
	_, err = db.Exec(ctx, "UPDATE platform_subscriptions SET paid_until=paid_until+interval '1 month' WHERE academy_id=$1", a)
	if err != nil {
		t.Fatal(err)
	}
	v, err = m.snapshot(ctx, a, true)
	if err != nil {
		t.Fatal(err)
	}
	if v.Cycle.Amount != 45000 || v.Cycle.Plan != "large" {
		t.Fatal(v.Cycle)
	}
}

func TestTrialPaymentPreservesFreeDays(t *testing.T) {
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
	a, cycle, ref, attemptID := core.ID(), core.ID(), core.ID(), core.ID()
	now := time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC)
	end := now.Add(5 * 24 * time.Hour)
	if _, err = db.Exec(ctx, "INSERT INTO academies(id,name,code) VALUES($1,'Early payment',$2)", a, a); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, "INSERT INTO platform_subscriptions(academy_id,selected_plan_id,trial_ends_at,paid_until,billing_day) VALUES($1,'professional',$2,$2,9)", a, end); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, "INSERT INTO platform_subscription_cycles(id,academy_id,period_start,period_end,amount_cents,plan_id,active_students) VALUES($1,$2,$3,$4,25000,'professional',0)", cycle, a, end, nextMonth(end)); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, "INSERT INTO platform_subscription_attempts(id,academy_id,cycle_id,reference,receiver_handle,amount_cents,state,expires_at) VALUES($1,$2,$3,$4,'platform',25000,'ready',$5)", attemptID, a, cycle, ref, now.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"paid":true,"amount":25000,"paid_amount":25000,"capture_method":"pix"}`))
	}))
	defer provider.Close()
	m := New(db, Config{Enabled: true, APIKey: "test-only", Handle: "platform"})
	m.Now = func() time.Time { return now }
	m.Bank.BaseURL = provider.URL
	c, err := scanAttempt(db.QueryRow(ctx, "SELECT "+columns+" FROM platform_subscription_attempts WHERE id=$1", attemptID))
	if err != nil {
		t.Fatal(err)
	}
	if err = m.verify(ctx, c, Event{Order: ref, Transaction: core.ID(), Slug: "test"}); err != nil {
		t.Fatal(err)
	}
	status, err := m.snapshot(ctx, a, true)
	if err != nil {
		t.Fatal(err)
	}
	if status.State != "active" || !status.PaidUntil.Equal(nextMonth(end)) {
		t.Fatalf("free trial consumed by early payment: %+v", status)
	}
	var receipt int64
	if err = db.QueryRow(ctx, "SELECT amount_cents FROM platform_subscription_receipts WHERE attempt_id=$1", attemptID).Scan(&receipt); err != nil || receipt != 25000 {
		t.Fatal(receipt, err)
	}
}
