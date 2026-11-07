package billing

import (
	"context"
	"time"
)

type ForecastMonth struct {
	Competence  string `json:"competence"`
	DueDate     string `json:"due_date"`
	AmountCents int64  `json:"amount_cents"`
}

// Forecast reads the next six scheduled months without creating invoices or payment links.
func (r Repository) Forecast(ctx context.Context, academyID, studentID string, now time.Time) ([]ForecastMonth, error) {
	result := []ForecastMonth{}
	rows, err := r.DB.Query(ctx, `WITH contract AS (
 SELECT b.amount_cents,b.due_day,
 GREATEST(b.next_month,date_trunc('month',$3::timestamptz AT TIME ZONE a.timezone)::date+interval '1 month') AS first_month
 FROM student_billing b JOIN students s ON s.academy_id=b.academy_id AND s.id=b.student_id
 JOIN academies a ON a.id=b.academy_id
 WHERE b.academy_id=$1 AND b.student_id=$2 AND b.enabled AND s.status='active' AND s.archived_at IS NULL
 )
 SELECT months.month::date,c.due_day,c.amount_cents FROM contract c
 CROSS JOIN LATERAL generate_series(c.first_month,c.first_month+interval '5 months',interval '1 month') AS months(month)
 WHERE NOT EXISTS(SELECT 1 FROM invoices i WHERE i.academy_id=$1 AND i.student_id=$2 AND i.competence=months.month::date)
 ORDER BY months.month`, academyID, studentID, now)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var month time.Time
		var dueDay int
		var value ForecastMonth
		if err = rows.Scan(&month, &dueDay, &value.AmountCents); err != nil {
			return nil, err
		}
		value.Competence = month.Format("2006-01")
		value.DueDate = DueDate(month, dueDay).Format("2006-01-02")
		result = append(result, value)
	}
	return result, rows.Err()
}
