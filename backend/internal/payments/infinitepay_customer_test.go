package payments

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestCheckoutPhone(t *testing.T) {
	for _, tc := range []struct{ input, want string }{{"(41) 99999-0000", "+5541999990000"}, {"41999990000", "+5541999990000"}, {"5541999990000", "+5541999990000"}, {"+55 (41) 99999-0000", "+5541999990000"}, {"(11) 3333-4444", "+551133334444"}, {"+1 (202) 555-0123", "+12025550123"}, {"", ""}, {"não informado", ""}, {"119999", ""}, {"00000000000", ""}, {"+55", ""}, {"041999990000", ""}, {"4198888888", ""}, {"tel:41999990000", ""}, {"+5501999990000", ""}, {"++5541999990000", ""}, {"+01234567890", ""}} {
		if got := checkoutPhone(tc.input); got != tc.want {
			t.Errorf("phone %q: got %q, want %q", tc.input, got, tc.want)
		}
	}
}
func TestCheckoutCustomerOptionalFields(t *testing.T) {
	for _, email := range []string{"", "invalido", "Nome <someone@example.test>", strings.Repeat("a", 250) + "@example.test"} {
		if checkoutEmail(email) != "" {
			t.Errorf("invalid email accepted: %q", email)
		}
	}
	if checkoutEmail(" student@example.test ") != "student@example.test" {
		t.Fatal("valid email rejected")
	}
	raw, err := json.Marshal(checkoutCustomer{Name: "Pagador"})
	if err != nil || string(raw) != `{"name":"Pagador"}` {
		t.Fatalf("empty optional fields sent: %s %v", raw, err)
	}
}
