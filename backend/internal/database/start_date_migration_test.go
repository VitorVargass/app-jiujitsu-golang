package database

import (
	"database/sql"
	"github.com/pressly/goose/v3"
	"os"
	"tatame/backend/internal/core"
	"testing"
)

func TestStudentStartDateMigration(t *testing.T) {
	address := os.Getenv("START_DATE_MIGRATION_DATABASE_URL")
	if address == "" {
		t.Skip("fresh dedicated migration database required")
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
	must(goose.UpTo(db, "migrations", 10))
	a, person, part, student := core.ID(), core.ID(), core.ID(), core.ID()
	_, err = db.Exec("INSERT INTO academies(id,name,code,timezone) VALUES($1,'Legada',$2,'Pacific/Honolulu')", a, core.Token()[:10])
	must(err)
	_, err = db.Exec("INSERT INTO people(id,email) VALUES($1,$2)", person, person+"@test.example")
	must(err)
	_, err = db.Exec("INSERT INTO academy_participants(id,academy_id,person_id,student_code,qr_token) VALUES($1,$2,$3,'12345678',$4)", part, a, person, core.Token())
	must(err)
	_, err = db.Exec("INSERT INTO students(id,academy_id,person_id,participant_id,name,created_at) VALUES($1,$2,$3,$4,'Antigo','2020-05-01T02:00:00Z')", student, a, person, part)
	must(err)
	digest := func() string {
		var v string
		must(db.QueryRow(`SELECT md5(jsonb_build_object('students',(SELECT jsonb_agg(to_jsonb(s)-'started_on' ORDER BY id) FROM students s),'periods',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM student_active_periods p),'ranks',(SELECT jsonb_agg(to_jsonb(g) ORDER BY id) FROM student_graduation_events g),'invoices',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM invoices i))::text)`).Scan(&v))
		return v
	}
	before := digest()
	must(Migrate(address))
	must(Migrate(address))
	var date string
	must(db.QueryRow("SELECT started_on::text FROM students WHERE id=$1", student).Scan(&date))
	if date != "2020-04-30" || digest() != before {
		t.Fatal("migration lost history or used UTC instead of academy date", date)
	}
	_, err = db.Exec("UPDATE students SET started_on='2010-02-03' WHERE id=$1", student)
	must(err)
	must(Migrate(address))
	must(db.QueryRow("SELECT started_on::text FROM students WHERE id=$1", student).Scan(&date))
	if date != "2010-02-03" {
		t.Fatal("restart overwrote corrected date")
	}
	person2, part2 := core.ID(), core.ID()
	_, err = db.Exec("INSERT INTO people(id,email) VALUES($1,$2)", person2, person2+"@test.example")
	must(err)
	_, err = db.Exec("INSERT INTO academy_participants(id,academy_id,person_id,student_code,qr_token) VALUES($1,$2,$3,'87654321',$4)", part2, a, person2, core.Token())
	must(err)
	id2 := core.ID()
	_, err = db.Exec("INSERT INTO students(id,academy_id,person_id,participant_id,name,created_at) VALUES($1,$2,$3,$4,'Importado','2020-05-01T02:00:00Z')", id2, a, person2, part2)
	must(err)
	must(db.QueryRow("SELECT started_on::text FROM students WHERE id=$1", id2).Scan(&date))
	if date != "2020-04-30" {
		t.Fatal("legacy import default failed", date)
	}
}
