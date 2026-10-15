package academies

import (
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"tatame/backend/internal/core"
)

type Repository struct{ DB *pgxpool.Pool }

func (repo Repository) Create(ctx context.Context, u string, in CreateInput) (Academy, error) {
	a := Academy{ID: core.ID(), Name: in.Name, Code: stringsCode(), Timezone: in.Timezone, MembershipID: core.ID(), Roles: []string{"admin"}, Status: "active", Belt: "Faixa Branca"}
	tx, e := repo.DB.Begin(ctx)
	if e != nil {
		return a, e
	}
	defer tx.Rollback(ctx)
	if _, e = tx.Exec(ctx, "INSERT INTO academies(id,name,code,timezone) VALUES($1,$2,$3,$4)", a.ID, a.Name, a.Code, a.Timezone); e != nil {
		return a, e
	}
	if _, e = tx.Exec(ctx, "INSERT INTO memberships(id,academy_id,user_id,status,student_code,qr_token) VALUES($1,$2,$3,'active',$4,$5)", a.MembershipID, a.ID, u, core.Digits(), core.Token()); e != nil {
		return a, e
	}
	if _, e = tx.Exec(ctx, "INSERT INTO membership_roles VALUES($1,'admin')", a.MembershipID); e != nil {
		return a, e
	}
	for _, name := range []string{"Jiu-Jitsu", "No-Gi", "Muay Thai"} {
		if _, e = tx.Exec(ctx, "INSERT INTO modalities(id,academy_id,name,belt_options) VALUES($1,$2,$3,default_belt_options($3))", core.ID(), a.ID, name); e != nil {
			return a, e
		}
	}
	return a, tx.Commit(ctx)
}
func stringsCode() string { return core.Token()[:10] }
func (repo Repository) List(ctx context.Context, u string) ([]Academy, error) {
	rows, e := repo.DB.Query(ctx, `SELECT a.id,a.name,a.code,a.timezone,m.id,m.status,m.belt,
 COALESCE((SELECT array_agg(role ORDER BY role) FROM membership_roles r WHERE r.membership_id=m.id),'{}'::text[])
 FROM academies a JOIN memberships m ON a.id=m.academy_id WHERE m.user_id=$1 ORDER BY a.name`, u)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []Academy{}
	for rows.Next() {
		var a Academy
		if e = rows.Scan(&a.ID, &a.Name, &a.Code, &a.Timezone, &a.MembershipID, &a.Status, &a.Belt, &a.Roles); e != nil {
			return nil, e
		}
		out = append(out, a)
	}
	return out, rows.Err()
}
