package billing

import "time"

// Preserve a chosen future month; never start a new contract with an overdue invoice.
func FirstBillingMonth(month string, day int, now time.Time) string {
	parsed, e := time.ParseInLocation("2006-01", month, now.Location())
	if e != nil {
		return month
	}
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	if DueDate(parsed, day).Before(today) {
		parsed = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		if DueDate(parsed, day).Before(today) {
			parsed = parsed.AddDate(0, 1, 0)
		}
	}
	return parsed.Format("2006-01")
}
