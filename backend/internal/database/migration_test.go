package database

import (
	"context"
	"database/sql"
	"github.com/pressly/goose/v3"
	"os"
	"tatame/backend/internal/core"
	"testing"
)

func TestLegacyMigrationPreservesAttendance(t *testing.T) {
	url := os.Getenv("MIGRATION_DATABASE_URL")
	if url == "" {
		t.Skip("fresh dedicated migration database required")
	}
	db, e := sql.Open("pgx", url)
	if e != nil {
		t.Fatal(e)
	}
	defer db.Close()
	goose.SetBaseFS(migrations)
	if e = goose.SetDialect("postgres"); e != nil {
		t.Fatal(e)
	}
	if e = goose.UpTo(db, "migrations", 1); e != nil {
		t.Fatal(e)
	}
	u, a, m, c, s, p, sc := core.ID(), core.ID(), core.ID(), core.ID(), core.ID(), core.ID(), core.ID()
	qr := core.Token()
	ctx := context.Background()
	tx, e := db.BeginTx(ctx, nil)
	if e != nil {
		t.Fatal(e)
	}
	statements := []struct {
		q    string
		args []any
	}{
		{"INSERT INTO users(id,name,email,password_hash) VALUES($1,'Migrado',$2,'hash')", []any{u, u + "@test.example"}},
		{"INSERT INTO academies(id,name,code) VALUES($1,'Legada',$2)", []any{a, core.Token()[:10]}},
		{"INSERT INTO memberships(id,academy_id,user_id,status,student_code,qr_token) VALUES($1,$2,$3,'active','12345678',$4)", []any{m, a, u, qr}},
		{"INSERT INTO membership_roles VALUES($1,'student')", []any{m}},
		{"INSERT INTO classes(id,academy_id,name,teacher_membership_id) VALUES($1,$2,'Legada',$3)", []any{c, a, m}},
		{"INSERT INTO class_schedules(id,academy_id,class_id,weekday,start_time,duration_minutes) VALUES($1,$2,$3,1,'19:00',60)", []any{sc, a, c}},
		{"INSERT INTO class_sessions(id,academy_id,class_id,schedule_id,starts_at,status) VALUES($1,$2,$3,$4,now(),'closed')", []any{s, a, c, sc}},
		{"INSERT INTO attendances(id,academy_id,session_id,membership_id) VALUES($1,$2,$3,$4)", []any{p, a, s, m}},
	}
	for _, st := range statements {
		if _, e = tx.ExecContext(ctx, st.q, st.args...); e != nil {
			_ = tx.Rollback()
			t.Fatal(e)
		}
	}
	if e = tx.Commit(); e != nil {
		t.Fatal(e)
	}
	if e = Migrate(url); e != nil {
		t.Fatal(e)
	}
	var code, token string
	if e = db.QueryRow("SELECT student_code,qr_token FROM students WHERE id=$1", m).Scan(&code, &token); e != nil || code != "12345678" || token != qr {
		t.Fatal("credential changed", e)
	}
	var n int
	if e = db.QueryRow("SELECT count(*) FROM attendances WHERE id=$1 AND membership_id=$2", p, m).Scan(&n); e != nil || n != 1 {
		t.Fatal("attendance lost", e)
	}
	if e = db.QueryRow("SELECT count(*) FROM invoices WHERE academy_id=$1", a).Scan(&n); e != nil || n != 0 {
		t.Fatal("retroactive invoices", e)
	}
}
