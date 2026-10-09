package access

import (
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"tatame/backend/internal/core"
)

type Membership struct {
	ID        string   `json:"id"`
	AcademyID string   `json:"academy_id"`
	UserID    string   `json:"user_id"`
	Name      string   `json:"name"`
	Status    string   `json:"status"`
	Belt      string   `json:"belt"`
	Roles     []string `json:"roles"`
}
type Service struct{ DB *pgxpool.Pool }

func (s Service) Membership(ctx context.Context, a, u string) (Membership, error) {
	m := Membership{Roles: []string{}}
	if !core.ValidID(a) || !core.ValidID(u) {
		return m, core.E(404, "not_found", "Academia não encontrada.")
	}
	err := s.DB.QueryRow(ctx, `SELECT m.id,m.academy_id,m.user_id,u.name,m.status,m.belt,
 COALESCE((SELECT array_agg(role ORDER BY role) FROM membership_roles r WHERE r.membership_id=m.id),'{}'::text[])
 FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.academy_id=$1 AND m.user_id=$2`, a, u).
		Scan(&m.ID, &m.AcademyID, &m.UserID, &m.Name, &m.Status, &m.Belt, &m.Roles)
	if err != nil {
		return m, core.E(403, "forbidden", "Você não tem acesso a esta academia.")
	}
	return m, nil
}
func Has(roles []string, role string) bool {
	for _, v := range roles {
		if v == role {
			return true
		}
	}
	return false
}
func (s Service) Require(ctx context.Context, a string, roles ...string) (Membership, error) {
	p := core.P(ctx)
	if p.UserID == "" {
		return Membership{}, core.E(403, "forbidden", "Conta pessoal necessária.")
	}
	m, e := s.Membership(ctx, a, p.UserID)
	if e != nil {
		return m, e
	}
	if m.Status != "active" {
		return m, core.E(403, "membership_blocked", "Seu vínculo com a academia está bloqueado.")
	}
	if len(roles) == 0 {
		return m, nil
	}
	for _, r := range roles {
		if Has(m.Roles, r) {
			return m, nil
		}
	}
	return m, core.E(403, "forbidden", "Você não tem permissão para esta operação.")
}
func (s Service) Class(ctx context.Context, a, c string) (Membership, error) {
	m, e := s.Require(ctx, a, "admin", "teacher")
	if e != nil {
		return m, e
	}
	if !core.ValidID(c) {
		return m, core.E(404, "not_found", "Turma não encontrada.")
	}
	var teacher string
	if e = s.DB.QueryRow(ctx, "SELECT COALESCE(teacher_membership_id::text,'') FROM classes WHERE academy_id=$1 AND id=$2", a, c).Scan(&teacher); e != nil {
		return m, core.E(404, "not_found", "Turma não encontrada.")
	}
	if !Has(m.Roles, "admin") && teacher != m.ID {
		return m, core.E(403, "forbidden", "Esta turma está sob responsabilidade de outro professor.")
	}
	return m, nil
}
