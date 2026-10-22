package attendance

import "testing"

func TestCheckInIdentifier(t *testing.T) {
	for _, code := range []string{"00000", "00007", "48271", "99999"} {
		in := Input{StudentCode: code}
		if err := normalizeIdentifier(&in); err != nil {
			t.Fatal(code, err)
		}
	}
	for _, code := range []string{"", "1234", "123456", "12345678", "12a45", "１２３４５", "12345\n", " 12345"} {
		if err := normalizeIdentifier(&Input{StudentCode: code}); err == nil {
			t.Fatalf("accepted %q", code)
		}
	}
	if err := normalizeIdentifier(&Input{StudentCode: "12345", QRToken: "tatame:test"}); err == nil {
		t.Fatal("mixed identifiers")
	}
	if err := normalizeIdentifier(&Input{QRToken: "tatame:test"}); err != nil {
		t.Fatal(err)
	}
}
