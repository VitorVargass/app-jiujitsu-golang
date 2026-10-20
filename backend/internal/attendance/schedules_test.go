package attendance

import (
	"testing"
	"time"
)

func TestAttendanceWindow(t *testing.T) {
	loc, _ := time.LoadLocation("America/Sao_Paulo")
	start := time.Date(2026, 10, 19, 23, 30, 0, 0, loc)
	end := start.Add(90 * time.Minute)
	for _, v := range []struct {
		name string
		at   time.Time
		want bool
	}{
		{"too early", start.Add(-15*time.Minute - time.Nanosecond), false},
		{"early boundary", start.Add(-15 * time.Minute), true},
		{"class start", start, true},
		{"cross midnight", start.Add(45 * time.Minute), true},
		{"last instant", end.Add(-time.Nanosecond), true},
		{"class end", end, false},
	} {
		t.Run(v.name, func(t *testing.T) {
			if got := withinLesson(v.at, start, end); got != v.want {
				t.Fatalf("got %v want %v", got, v.want)
			}
		})
	}
}
