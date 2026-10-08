package core

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDecodeRejectsExtraJSON(t *testing.T) {
	for _, body := range []string{`{"value":"ok"} {"value":"extra"}`, `{"unknown":"x"}`, `{"value":`} {
		r := httptest.NewRequest("POST", "/", strings.NewReader(body))
		var v struct {
			Value string `json:"value"`
		}
		if Decode(httptest.NewRecorder(), r, &v) == nil {
			t.Fatalf("accepted %q", body)
		}
	}
}
func TestRandomIdentifiers(t *testing.T) {
	a, b := ID(), ID()
	if !ValidID(a) || a == b {
		t.Fatal("invalid identifiers")
	}
	if len(Token()) != 64 || len(Digits()) != 8 {
		t.Fatal("invalid credential length")
	}
}
