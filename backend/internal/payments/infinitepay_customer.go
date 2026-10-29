package payments

import (
	"context"
	"net/mail"
	"strings"
	"tatame/backend/internal/billing"
)

// Optional provider fields. CPF, credentials and address are deliberately absent.
type checkoutCustomer struct {
	Name  string `json:"name,omitempty"`
	Email string `json:"email,omitempty"`
	Phone string `json:"phone_number,omitempty"`
}

func (p *InfinitePay) customerForInvoice(ctx context.Context, a string, invoice billing.Invoice) (*checkoutCustomer, error) {
	var studentName, studentCPF, studentEmail, phone, alternate, guardianEmail string
	// Match the invoice's payer, not the manager who requested the checkout.
	// Parent contact is used only through an explicit, active family relationship.
	err := p.DB.QueryRow(ctx, `SELECT s.name,ap.cpf,COALESCE(person.email,''),s.phone,s.alternate_phone,
 COALESCE((SELECT gp_person.email FROM student_guardians g
 JOIN guardian_profiles gp ON gp.academy_id=g.academy_id AND gp.user_id=g.user_id
 JOIN users gu ON gu.id=g.user_id JOIN people gp_person ON gp_person.id=gu.person_id
 JOIN memberships gm ON gm.academy_id=g.academy_id AND gm.user_id=g.user_id
 WHERE g.academy_id=s.academy_id AND g.student_id=s.id AND g.active
 AND gp.cpf=$3 AND gm.status='active'
 AND EXISTS(SELECT 1 FROM membership_roles gr WHERE gr.membership_id=gm.id AND gr.role='guardian')
 ORDER BY g.created_at,g.user_id LIMIT 1),'')
 FROM students s JOIN people person ON person.id=s.person_id
 JOIN academy_participants ap ON ap.academy_id=s.academy_id AND ap.id=s.participant_id
 WHERE s.academy_id=$1 AND s.id=$2`, a, invoice.StudentID, invoice.PayerDocument).Scan(&studentName, &studentCPF, &studentEmail, &phone, &alternate, &guardianEmail)
	if err != nil {
		return nil, err
	}
	own := studentCPF != "" && studentCPF == invoice.PayerDocument
	customer := checkoutCustomer{Name: strings.TrimSpace(invoice.PayerName)}
	if own {
		if customer.Name == "" {
			customer.Name = strings.TrimSpace(studentName)
		}
		customer.Email = checkoutEmail(studentEmail)
		if customer.Email == "" {
			customer.Email = checkoutEmail(guardianEmail)
		}
	} else {
		customer.Email = checkoutEmail(guardianEmail)
	}
	// A legacy minor's telephone/email can belong to the child. Do not mix it
	// with a different payer when no approved guardian relationship exists.
	if own || guardianEmail != "" {
		customer.Phone = checkoutPhone(phone)
		if customer.Phone == "" {
			customer.Phone = checkoutPhone(alternate)
		}
	}
	if customer.Name == "" && customer.Email == "" && customer.Phone == "" {
		return nil, nil
	}
	return &customer, nil
}

func checkoutEmail(value string) string {
	value = strings.TrimSpace(value)
	parsed, err := mail.ParseAddress(value)
	if err != nil || parsed.Address != value || len(value) > 254 {
		return ""
	}
	return value
}

// Local Brazilian numbers become E.164; explicit international numbers retain
// their country code. Unusable values are omitted so checkout stays available.
func checkoutPhone(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	var digits strings.Builder
	international := strings.HasPrefix(value, "+")
	for i, c := range value {
		switch {
		case c >= '0' && c <= '9':
			digits.WriteRune(c)
		case c == '+' && i == 0:
		case c == ' ' || c == '(' || c == ')' || c == '-' || c == '.':
		default:
			return ""
		}
	}
	number := digits.String()
	if international && !strings.HasPrefix(number, "55") {
		if len(number) < 8 || len(number) > 15 || number[0] == '0' {
			return ""
		}
		return "+" + number
	}
	if (len(number) == 12 || len(number) == 13) && strings.HasPrefix(number, "55") {
		number = number[2:]
	}
	if len(number) != 10 && len(number) != 11 {
		return ""
	}
	if number[0] == '0' || number[1] == '0' {
		return ""
	}
	if len(number) == 11 && number[2] != '9' {
		return ""
	}
	if len(number) == 10 && (number[2] < '2' || number[2] > '5') {
		return ""
	}
	if strings.Trim(number, string(number[0])) == "" {
		return ""
	}
	return "+55" + number
}
