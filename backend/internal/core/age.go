package core

import "time"

// AgeOn compares calendar dates in the academy's timezone. Leap-day birthdays
// reach the next age on March 1 in a non-leap year.
func AgeOn(birth, today time.Time) int {
	age := today.Year() - birth.Year()
	anniversary := time.Date(today.Year(), birth.Month(), birth.Day(), 0, 0, 0, 0, today.Location())
	date := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, today.Location())
	if date.Before(anniversary) {
		age--
	}
	return age
}
