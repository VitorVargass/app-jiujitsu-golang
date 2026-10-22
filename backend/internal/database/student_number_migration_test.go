package database

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pressly/goose/v3"
	"tatame/backend/internal/core"
)

func TestStudentNumberMigration(t *testing.T) {
	address := os.Getenv("STUDENT_NUMBER_MIGRATION_DATABASE_URL")
	if address == "" {
		t.Skip("fresh dedicated number migration database required")
	}
	db, err := sql.Open("pgx", address)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	goose.SetBaseFS(migrations)
	must(goose.SetDialect("postgres"))
	must(goose.UpTo(db, "migrations", 11))
	academy, user, member, person, otherPart, otherPerson := core.ID(), core.ID(), core.ID(), core.ID(), core.ID(), core.ID()
	qr := core.Token()
	for _, fixture := range []struct {
		q    string
		args []any
	}{
		{"INSERT INTO people(id,email) VALUES($1,$2)", []any{person, person + "@number.test"}},
		{"INSERT INTO users(id,name,password_hash,person_id) VALUES($1,'Legado','hash',$2)", []any{user, person}},
		{"INSERT INTO academies(id,name,code) VALUES($1,'Numeros',$2)", []any{academy, core.Token()}},
		{"INSERT INTO memberships(id,academy_id,user_id,status,student_code,qr_token) VALUES($1,$2,$3,'active','12345678',$4)", []any{member, academy, user, qr}},
		{"INSERT INTO membership_roles(membership_id,role) VALUES($1,'student')", []any{member}},
		{"INSERT INTO people(id,email) VALUES($1,$2)", []any{otherPerson, otherPerson + "@number.test"}},
		{"INSERT INTO academy_participants(id,academy_id,person_id,student_code,qr_token) VALUES($1,$2,$3,'00007',$4)", []any{otherPart, academy, otherPerson, core.Token()}},
		{"UPDATE students SET archived_at=now(),status='inactive' WHERE id=$1", []any{member}},
		{"INSERT INTO invoices(id,academy_id,student_id,competence,due_date,amount_cents,payer_name,payer_document) VALUES($1,$2,$3,'2026-10-01','2026-10-10',15000,'Pagador','52998224725')", []any{core.ID(), academy, member}},
	} {
		_, err = db.Exec(fixture.q, fixture.args...)
		must(err)
	}
	snapshot := func() map[string]string {
		t.Helper()
		names, err := db.Query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'goose_db_version' ORDER BY tablename")
		must(err)
		var tables []string
		for names.Next() {
			var name string
			must(names.Scan(&name))
			tables = append(tables, name)
		}
		must(names.Err())
		names.Close()
		out := map[string]string{}
		for _, name := range tables {
			var hash string
			must(db.QueryRow("SELECT md5(COALESCE(string_agg((to_jsonb(t)-'student_code')::text,'' ORDER BY (to_jsonb(t)-'student_code')::text),'')) FROM " + pgx.Identifier{"public", name}.Sanitize() + " t").Scan(&hash))
			out[name] = hash
		}
		return out
	}
	before := snapshot()
	must(Migrate(address))
	must(Migrate(address))
	for name, after := range snapshot() {
		if before[name] != after {
			t.Fatalf("migration altered non-code data in %s", name)
		}
	}
	var code, savedQR, part string
	must(db.QueryRow("SELECT p.student_code,p.qr_token,p.id::text FROM academy_participants p JOIN users u ON u.person_id=p.person_id WHERE p.academy_id=$1 AND u.id=$2", academy, user).Scan(&code, &savedQR, &part))
	if !core.ValidStudentCode(code) || savedQR != qr {
		t.Fatal("legacy number not replaced or QR changed")
	}
	var membershipCode, kept string
	must(db.QueryRow("SELECT student_code FROM memberships WHERE id=$1", member).Scan(&membershipCode))
	must(db.QueryRow("SELECT student_code FROM academy_participants WHERE id=$1", otherPart).Scan(&kept))
	if membershipCode != code || kept != "00007" {
		t.Fatal("canonical number mismatch or valid number replaced")
	}

	pool, err := pgxpool.New(context.Background(), address)
	must(err)
	defer pool.Close()
	errors := make(chan error, 24)
	var wg sync.WaitGroup
	// Every request deliberately proposes the same occupied number. The database must
	// reserve a different number even with concurrent student/member creation.
	for i := 0; i < 24; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			pid, pid2 := core.ID(), core.ID()
			_, err := pool.Exec(context.Background(), "WITH person AS (INSERT INTO people(id,email) VALUES($1,$2)) INSERT INTO academy_participants(id,academy_id,person_id,student_code,qr_token) VALUES($3,$4,$1,'00007',$5)", pid, pid+"@concurrent.test", pid2, academy, core.Token())
			if err != nil {
				errors <- err
			}
		}()
	}
	wg.Wait()
	close(errors)
	for err := range errors {
		must(err)
	}
	var total, distinct, invalid int
	must(db.QueryRow("SELECT count(*),count(DISTINCT student_code),count(*) FILTER(WHERE student_code !~ '^[0-9]{5}$') FROM academy_participants WHERE academy_id=$1", academy).Scan(&total, &distinct, &invalid))
	if total != 26 || distinct != total || invalid != 0 {
		t.Fatalf("invalid concurrent reservations: %d %d %d", total, distinct, invalid)
	}
	// A number can exist in another academy; the uniqueness boundary is the academy.
	another := core.ID()
	_, err = db.Exec("INSERT INTO academies(id,name,code) VALUES($1,'Outra',$2)", another, core.Token())
	must(err)
	_, err = db.Exec("INSERT INTO academy_participants(id,academy_id,person_id,student_code,qr_token) VALUES($1,$2,$3,'00007',$4)", core.ID(), another, otherPerson, core.Token())
	must(err)
	var cross string
	must(db.QueryRow("SELECT student_code FROM academy_participants WHERE academy_id=$1", another).Scan(&cross))
	if cross != "00007" {
		t.Fatal("different academies cannot share a code")
	}
	if _, err = db.Exec("UPDATE academy_participants SET student_code='12345678' WHERE id=$1", otherPart); err == nil {
		t.Fatal("invalid code bypassed database constraint")
	}
	t.Log(fmt.Sprintf("29 tables preserved; %d concurrent unique numbers; QR and archived enrollment preserved", total))
}
