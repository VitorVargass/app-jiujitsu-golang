package payments

import (
	"testing"
	"time"
)

func TestOutdatedCustomerDoesNotReopenLink(t *testing.T) {
	c := checkoutAttempt{CustomerFingerprint: "original", State: "ready", URL: "https://checkout.infinitepay.io/test", Expires: time.Now().Add(time.Hour)}
	if v := c.resultForCustomer("original"); v.Status != "waiting" || v.URL == "" {
		t.Fatal(v)
	}
	for _, saved := range []string{"original", ""} {
		c.CustomerFingerprint = saved
		v := c.resultForCustomer("changed")
		if v.URL != "" || !v.CustomerChanged || v.Retryable || v.Status != "review" {
			t.Fatal(v)
		}
	}
	c.Expires = time.Now().Add(-time.Second)
	if v := c.resultForCustomer("changed"); !v.Expired || !v.Retryable || v.URL != c.URL {
		t.Fatal(v)
	}
	c.State = "paid"
	if v := c.resultForCustomer("changed"); v.Status != "paid" || v.CustomerChanged {
		t.Fatal(v)
	}
}
