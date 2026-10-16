package core

import (
	"testing"
	"time"
)

func TestAgeOnCalendarDate(t *testing.T) {
	for _, v := range []struct {
		birth, today string
		want         int
	}{
		{"2008-10-15", "2026-10-14", 17}, {"2008-10-15", "2026-10-15", 18}, {"2008-10-15", "2026-10-16", 18},
		{"2008-02-29", "2026-02-28", 17}, {"2008-02-29", "2026-03-01", 18},
	} {
		b, _ := time.Parse("2006-01-02", v.birth)
		d, _ := time.Parse("2006-01-02", v.today)
		if got := AgeOn(b, d); got != v.want {
			t.Fatalf("%s on %s: got %d want %d", v.birth, v.today, got, v.want)
		}
	}
}
