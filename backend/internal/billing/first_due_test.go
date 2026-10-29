package billing

import (
	"testing"
	"time"
)

func TestFirstBillingMonth(t *testing.T) {
	loc, _ := time.LoadLocation("America/Sao_Paulo")
	for _, c := range []struct {
		month string
		day   int
		now   string
		want  string
	}{
		{"2026-10", 15, "2026-10-28", "2026-11"},
		{"2026-11", 15, "2026-10-28", "2026-11"},
		{"2026-12", 15, "2026-10-28", "2026-12"},
		{"2026-10", 28, "2026-10-28", "2026-10"},
		{"2026-12", 1, "2026-12-31", "2027-01"},
		{"2028-02", 31, "2028-02-29", "2028-02"},
	} {
		now, _ := time.ParseInLocation("2006-01-02", c.now, loc)
		if got := FirstBillingMonth(c.month, c.day, now); got != c.want {
			t.Errorf("%+v got %s", c, got)
		}
	}
}
