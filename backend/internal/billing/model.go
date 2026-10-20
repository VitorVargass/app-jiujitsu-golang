package billing

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

type Invoice struct {
	ID                  string     `json:"id"`
	StudentID           string     `json:"student_id"`
	StudentName         string     `json:"student_name"`
	Competence          string     `json:"competence"`
	DueDate             string     `json:"due_date"`
	AmountCents         int64      `json:"amount_cents"`
	OriginalAmountCents int64      `json:"original_amount_cents"`
	DiscountCents       int64      `json:"discount_cents"`
	DiscountReason      string     `json:"discount_reason"`
	PaymentMethod       string     `json:"payment_method"`
	Status              string     `json:"status"`
	PaidAt              *time.Time `json:"paid_at"`
	PayerName           string     `json:"-"`
	PayerDocument       string     `json:"-"`
}

func DueDate(month time.Time, day int) time.Time {
	last := time.Date(month.Year(), month.Month()+1, 0, 0, 0, 0, 0, month.Location()).Day()
	if day > last {
		day = last
	}
	return time.Date(month.Year(), month.Month(), day, 0, 0, 0, 0, month.Location())
}
func Decimal(cents int64) string { return fmt.Sprintf("%d.%02d", cents/100, cents%100) }
func Cents(s string) (int64, error) {
	if len(s) > 20 {
		return 0, fmt.Errorf("invalid money")
	}
	parts := strings.Split(s, ".")
	if len(parts) > 2 {
		return 0, fmt.Errorf("invalid money")
	}
	a, e := strconv.ParseInt(parts[0], 10, 64)
	if e != nil || a < 0 || a > 1000000000 {
		return 0, fmt.Errorf("invalid money")
	}
	b := int64(0)
	if len(parts) == 2 {
		if len(parts[1]) < 1 || len(parts[1]) > 2 {
			return 0, fmt.Errorf("invalid precision")
		}
		v := parts[1]
		if len(v) == 1 {
			v += "0"
		}
		b, e = strconv.ParseInt(v, 10, 64)
		if e != nil || b < 0 || b > 99 {
			return 0, fmt.Errorf("invalid money")
		}
	}
	return a*100 + b, nil
}
func ValidDocument(s string) bool {
	if len(s) != 11 && len(s) != 14 {
		return false
	}
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	if strings.Trim(s, string(s[0])) == "" {
		return false
	}
	calc := func(base string, weights []int) byte {
		sum := 0
		for i, w := range weights {
			sum += int(base[i]-'0') * w
		}
		d := 11 - sum%11
		if d >= 10 {
			d = 0
		}
		return byte(d) + '0'
	}
	if len(s) == 11 {
		return s[9] == calc(s[:9], []int{10, 9, 8, 7, 6, 5, 4, 3, 2}) && s[10] == calc(s[:10], []int{11, 10, 9, 8, 7, 6, 5, 4, 3, 2})
	}
	return s[12] == calc(s[:12], []int{5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2}) && s[13] == calc(s[:13], []int{6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2})
}
