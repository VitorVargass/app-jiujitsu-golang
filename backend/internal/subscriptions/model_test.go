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
	if PriceCents != 45000 {
		t.Fatal("Preço alterado")
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
