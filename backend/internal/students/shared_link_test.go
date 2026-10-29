package students

import (
	"testing"
	"time"
)

func TestNextEnrollmentDue(t *testing.T) {
	for _, tc := range []struct {
		today string
		day   int
		want  string
	}{{"2026-10-01", 10, "2026-10-10"}, {"2026-10-19", 20, "2026-10-20"}, {"2026-10-20", 20, "2026-11-20"}, {"2026-10-28", 20, "2026-11-20"}, {"2026-10-10", 10, "2026-11-10"}, {"2026-10-28", 10, "2026-11-10"}, {"2026-02-27", 31, "2026-02-28"}, {"2026-02-28", 31, "2026-03-31"}, {"2028-02-28", 31, "2028-02-29"}, {"2026-12-31", 31, "2027-01-31"}} {
		now, _ := time.Parse("2006-01-02", tc.today)
		if got := nextEnrollmentDue(now, tc.day).Format("2006-01-02"); got != tc.want {
			t.Errorf("%s day %d: %s, want %s", tc.today, tc.day, got, tc.want)
		}
	}
}
