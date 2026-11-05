package payments

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
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

func (p *InfinitePay) customerForInvoice(ctx context.Context, a string, invoice billing.Invoice) (*checkoutCustomer, string, error) {
	var studentName, studentCPF, studentEmail, phone, alternate, guardianEmail, guardianName, payerName, payerDocument, birth string
	// Resolve the current billing payer, falling back to the invoice snapshot.
	// Never prefill the manager who requested checkout as the buyer.
	// Parent contact is used only through an explicit, active family relationship.
	err := p.DB.QueryRow(ctx, `SELECT s.name,ap.cpf,COALESCE(person.email,''),s.phone,s.alternate_phone,
 COALESCE(guardian.email,''),COALESCE(guardian.name,''),COALESCE(NULLIF(b.payer_name,''),$4),COALESCE(NULLIF(b.payer_document,''),$3),COALESCE(to_char(s.birth_date,'YYYY-MM-DD'),'')
 FROM students s JOIN people person ON person.id=s.person_id
 JOIN academy_participants ap ON ap.academy_id=s.academy_id AND ap.id=s.participant_id
 LEFT JOIN student_billing b ON b.academy_id=s.academy_id AND b.student_id=s.id
 LEFT JOIN LATERAL (SELECT gp_person.email,gu.name FROM student_guardians g
 JOIN guardian_profiles gp ON gp.academy_id=g.academy_id AND gp.user_id=g.user_id
 JOIN users gu ON gu.id=g.user_id JOIN people gp_person ON gp_person.id=gu.person_id
 JOIN memberships gm ON gm.academy_id=g.academy_id AND gm.user_id=g.user_id
 WHERE g.academy_id=s.academy_id AND g.student_id=s.id AND g.active
 AND gp.cpf=COALESCE(NULLIF(b.payer_document,''),$3) AND gm.status='active'
 AND EXISTS(SELECT 1 FROM membership_roles gr WHERE gr.membership_id=gm.id AND gr.role='guardian')
 ORDER BY g.created_at,g.user_id LIMIT 1) guardian ON true
 WHERE s.academy_id=$1 AND s.id=$2`, a, invoice.StudentID, invoice.PayerDocument, invoice.PayerName).Scan(&studentName, &studentCPF, &studentEmail, &phone, &alternate, &guardianEmail, &guardianName, &payerName, &payerDocument, &birth)
	if err != nil {
		return nil, "", err
	}
	own := studentCPF != "" && studentCPF == payerDocument
	customer := checkoutCustomer{Name: strings.TrimSpace(payerName)}
	if own {
		customer.Name = strings.TrimSpace(studentName)
		customer.Email = checkoutEmail(studentEmail)
		if customer.Email == "" {
			customer.Email = checkoutEmail(guardianEmail)
		}
	} else {
		if guardianName != "" {
			customer.Name = strings.TrimSpace(guardianName)
		}
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
	raw, err := json.Marshal([]any{customer, studentName, studentCPF, studentEmail, phone, alternate, guardianEmail, guardianName, payerName, payerDocument, birth})
	if err != nil {
		return nil, "", err
	}
	hash := sha256.Sum256(raw)
	fingerprint := hex.EncodeToString(hash[:])
	if customer.Name == "" && customer.Email == "" && customer.Phone == "" {
		return nil, fingerprint, nil
	}
	return &customer, fingerprint, nil
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
