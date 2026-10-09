package billing

import (
	"testing"
	"time"
)

func TestMoneyAndDueDate(t *testing.T) {
	cases := map[string]int64{"200.50": 20050, "0.01": 1, "200": 20000}
	for raw, want := range cases {
		got, e := Cents(raw)
		if e != nil || got != want {
			t.Fatalf("%s: %d %v", raw, got, e)
		}
	}
	for _, raw := range []string{"1.001", "-10", "NaN", "1e2"} {
		if _, e := Cents(raw); e == nil {
			t.Errorf("accepted %s", raw)
		}
	}
	for _, year := range []int{2024, 2025} {
		date := DueDate(time.Date(year, 2, 1, 0, 0, 0, 0, time.UTC), 31)
		want := 28
		if year == 2024 {
			want = 29
		}
		if date.Day() != want {
			t.Fatal(date)
		}
	}
	if !ValidDocument("52998224725") || !ValidDocument("11222333000181") || ValidDocument("11111111111") {
		t.Fatal("payer document validation")
	}
}
