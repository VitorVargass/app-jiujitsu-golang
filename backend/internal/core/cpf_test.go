package core

import "testing"

func TestNormalizeCPF(t *testing.T) {
	for _, input := range []string{"52998224725", "529.982.247-25", " 529.982.247-25 "} {
		got, ok := NormalizeCPF(input)
		if !ok || got != "52998224725" {
			t.Fatalf("formatted CPF failed: %q", input)
		}
	}
	for _, input := range []string{"11111111111", "00000000000", "52998224726", "123", "52998224725x", "529982247252", "5299822472１"} {
		if _, ok := NormalizeCPF(input); ok {
			t.Fatalf("invalid CPF accepted: %q", input)
		}
	}
	if got, ok := NormalizeCPF(""); !ok || got != "" {
		t.Fatal("legacy empty CPF rejected")
	}
}
