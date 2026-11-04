package config

import "testing"

func TestPaymentOrigins(t *testing.T) {
	for _, tc := range []struct {
		name, legacy, portal, api, wantPortal, wantAPI string
		invalid bool
	}{
		{name: "disabled and unset"},
		{name: "legacy deployment", legacy: "https://old.example/", wantPortal: "https://old.example", wantAPI: "https://old.example"},
		{name: "split deployment", legacy: "https://old.example", portal: "https://www.tatamemix.com.br/", api: "https://api.example/", wantPortal: "https://www.tatamemix.com.br", wantAPI: "https://api.example"},
		{name: "HTTP callback rejected", portal: "https://portal.example", api: "http://api.example", invalid: true},
		{name: "callback path rejected", api: "https://api.example/v1", invalid: true},
		{name: "credentials rejected", portal: "https://user:secret@portal.example", invalid: true},
		{name: "query rejected", portal: "https://portal.example?x=1", invalid: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("PAYMENTS_PUBLIC_URL", tc.legacy)
			t.Setenv("PAYMENTS_PORTAL_URL", tc.portal)
			t.Setenv("PAYMENTS_API_URL", tc.api)
			portal, api, err := PaymentOrigins()
			if tc.invalid { if err == nil { t.Fatal("invalid origin accepted") }; return }
			if err != nil || portal != tc.wantPortal || api != tc.wantAPI { t.Fatalf("got %q %q, error %v", portal, api, err) }
		})
	}
}
