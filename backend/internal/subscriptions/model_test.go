package subscriptions

import (
	"testing"
	"time"
)

func TestMonthlyPeriodAndGrace(t *testing.T) {
	jan := time.Date(2028, 1, 31, 12, 0, 0, 0, time.UTC)
	if got := nextMonth(jan); got.Day() != 29 || got.Month() != time.February {
		t.Fatal(got)
	}
	if got := nextMonth(time.Date(2027, 1, 31, 12, 0, 0, 0, time.UTC)); got.Day() != 28 {
		t.Fatal(got)
	}
	for _, v := range []struct {
		delta   time.Duration
		renew   bool
		state   string
		blocked bool
	}{
		{-time.Second, true, "active", false}, {0, true, "grace", false}, {Grace - time.Second, true, "grace", false}, {Grace, true, "overdue", true}, {0, false, "cancelled", true}, {-time.Second, false, "active", false},
	} {
		s, b := accessState(jan, jan.Add(v.delta), v.renew)
		if s != v.state || b != v.blocked {
			t.Fatalf("%+v -> %s %v", v, s, b)
		}
	}
	if got := nextMonthOn(nextMonth(jan), 31); got.Month() != time.March || got.Day() != 31 {
		t.Fatal("Billing day drift", got)
	}
}

func TestPlanBoundaries(t *testing.T) {
	for _, tc := range []struct {
		count  int
		plan   string
		amount int64
	}{
		{0, "essential", 15000}, {199, "essential", 15000}, {200, "essential", 15000},
		{201, "professional", 25000}, {300, "professional", 25000}, {999, "professional", 25000},
		{1000, "large", 45000}, {1001, "large", 45000}, {10000, "large", 45000},
	} {
		p := PlanForStudents(tc.count)
		if p.ID != tc.plan || p.Amount != tc.amount {
			t.Fatalf("%d students: %+v", tc.count, p)
		}
	}
}

func TestSelectedPlanAndTrial(t *testing.T) {
	for _, tc := range []struct {
		count    int
		selected string
		want     int64
	}{
		{0, "professional", 25000}, {200, "essential", 15000}, {201, "essential", 25000},
		{1000, "professional", 45000}, {0, "large", 45000}, {0, "", 15000},
	} {
		if got := EffectivePlan(tc.count, tc.selected); got.Amount != tc.want {
			t.Fatal(tc, got)
		}
	}
	now := time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC)
	end := now.Add(5 * 24 * time.Hour)
	if state, restricted := subscriptionAccess(end, now, true, &end, false); state != "trial" || restricted {
		t.Fatal(state, restricted)
	}
	if state, restricted := subscriptionAccess(end, end, true, &end, false); state != "overdue" || !restricted {
		t.Fatal("trial must not acquire another grace period", state, restricted)
	}
	if state, restricted := subscriptionAccess(end.AddDate(0, 1, 0), end, true, &end, true); state != "active" || restricted {
		t.Fatal(state, restricted)
	}
}

func TestCheckoutPreservesIssuedAmount(t *testing.T) {
	for _, amount := range []int64{15000, 25000, 45000} {
		c := attempt{Amount: amount, State: "ready", URL: "https://checkout.infinitepay.io/test", Expires: time.Now().Add(time.Hour)}
		if c.result(time.Now()).Amount != amount {
			t.Fatal("issued amount changed")
		}
	}
}
func TestCheckoutUncertaintyAndURL(t *testing.T) {
	now := time.Now()
	for _, state := range []string{"creating", "uncertain", "review"} {
		c := attempt{State: state, URL: "https://checkout.infinitepay.io/a/b", Expires: now.Add(time.Hour)}
		v := c.result(now)
		if v.URL != "" || v.Status != "review" {
			t.Fatal(v)
		}
	}
	if v := (attempt{State: "rejected"}).result(now); !v.Retryable {
		t.Fatal("Definite rejection must allow retry after configuration fix")
	}
	if validURL("https://checkout.infinitepay.io.evil.test/x") || validURL("http://checkout.infinitepay.io/x") || validURL("https://user@checkout.infinitepay.io/x") {
		t.Fatal("Unsafe checkout URL")
	}
	if !validURL("https://checkout.infinitepay.io/owner/link") {
		t.Fatal("Valid URL refused")
	}
}
