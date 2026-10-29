package access

import (
	"context"
	"tatame/backend/internal/core"
)

// Guardian rights require both an active relationship and an active membership.
const studentAccess = `(s.user_id=$2::uuid OR EXISTS(SELECT 1 FROM student_guardians g JOIN memberships m ON m.academy_id=g.academy_id AND m.user_id=g.user_id JOIN membership_roles r ON r.membership_id=m.id AND r.role='guardian' WHERE g.academy_id=s.academy_id AND g.student_id=s.id AND g.user_id=$2::uuid AND g.active AND m.status='active'))`

type FamilyStudent struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Status string `json:"status"`
}

func (s Service) Students(ctx context.Context, a string) ([]FamilyStudent, error) {
	u := core.P(ctx).UserID
	out := []FamilyStudent{}
	if !core.ValidID(a) || !core.ValidID(u) {
		return out, core.E(403, "forbidden", "Conta pessoal necessária.")
	}
	rows, e := s.DB.Query(ctx, "SELECT s.id,s.name,s.status FROM students s WHERE s.academy_id=$1 AND "+studentAccess+" ORDER BY s.name,s.id", a, u)
	if e != nil {
		return out, e
	}
	defer rows.Close()
	for rows.Next() {
		var v FamilyStudent
		if e = rows.Scan(&v.ID, &v.Name, &v.Status); e != nil {
			return out, e
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
func (s Service) Student(ctx context.Context, a, id string) (string, error) {
	u := core.P(ctx).UserID
	if !core.ValidID(a) || !core.ValidID(u) || (id != "" && !core.ValidID(id)) {
		return "", core.E(403, "forbidden", "Acesso ao aluno não autorizado.")
	}
	var result string
	e := s.DB.QueryRow(ctx, "SELECT s.id FROM students s WHERE s.academy_id=$1 AND "+studentAccess+" AND ($3='' OR s.id=NULLIF($3,'')::uuid) ORDER BY s.name,s.id LIMIT 1", a, u, id).Scan(&result)
	if e != nil {
		return "", core.E(403, "forbidden", "Acesso ao aluno não autorizado.")
	}
	return result, nil
}
