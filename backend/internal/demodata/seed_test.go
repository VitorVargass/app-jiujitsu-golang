package demodata_test

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"

	"tatame/backend/internal/academies"
	"tatame/backend/internal/access"
	"tatame/backend/internal/auth"
	"tatame/backend/internal/classes"
	"tatame/backend/internal/core"
	"tatame/backend/internal/database"
	"tatame/backend/internal/demodata"
	"tatame/backend/internal/students"
)

func TestSeedPreservesAcademyAndIsRepeatable(t *testing.T) {
	address := os.Getenv("TEST_DATABASE_URL")
	if address == "" {
		t.Skip("dedicated PostgreSQL required")
	}
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	ctx := context.Background()
	must(database.Migrate(address))
	db, err := database.Open(ctx, address)
	must(err)
	defer db.Close()
	as := auth.Service{Repo: auth.Repository{DB: db}}
	account, err := as.Register(ctx, auth.Credentials{Name: "Gestor original", Email: core.ID() + "@example.test", Password: "Tatame123!"})
	must(err)
	principal := core.WithPrincipal(ctx, core.Principal{UserID: account.User.ID})
	ac := academies.Service{Repo: academies.Repository{DB: db}}
	academy, err := ac.Create(principal, academies.CreateInput{Name: "Academia original"})
	must(err)
	foreign, err := ac.Create(principal, academies.CreateInput{Name: "Outra academia"})
	must(err)
	ss := students.Service{Repo: students.Repository{DB: db}, Access: access.Service{DB: db}}
	mods, err := ss.Repo.Catalog(ctx, academy.ID, false)
	must(err)
	cpf := demodata.CPF(123300001)
	birth := "1990-01-01"
	original, err := ss.Save(principal, academy.ID, "", students.Input{Name: "Aluno original", Email: core.ID() + "@example.test", CPF: &cpf, BirthDate: &birth, Status: "active", Modalities: []string{mods[0].ID}})
	must(err)
	cs := classes.Service{Repo: classes.Repository{DB: db}, Access: access.Service{DB: db}}
	class, err := cs.Save(principal, academy.ID, "", classes.ClassInput{Name: "Turma original", ModalityID: mods[0].ID})
	must(err)
	for day := 0; day < 7; day++ {
		_, err = cs.AddSchedule(principal, academy.ID, class.ID, classes.ScheduleInput{Weekday: day, StartTime: "08:00", Duration: 60})
		must(err)
	}
	before, err := ss.Repo.Get(ctx, academy.ID, original.ID)
	must(err)
	rawBefore, _ := json.Marshal(before)
	loc, _ := time.LoadLocation("America/Sao_Paulo")
	now := time.Date(2026, 10, 20, 16, 0, 0, 0, loc)
	result, err := demodata.Seed(ctx, db, academy.ID, account.User.ID, now)
	must(err)
	if result.Students != 18 || result.Plans != 2 || result.Invoices < 60 || result.Attendances < 300 || result.GraduationEvents != 36 {
		t.Fatal("incomplete examples", result)
	}
	after, err := ss.Repo.Get(ctx, academy.ID, original.ID)
	must(err)
	rawAfter, _ := json.Marshal(after)
	if string(rawBefore) != string(rawAfter) {
		t.Fatal("original student changed")
	}
	var count int
	must(db.QueryRow(ctx, "SELECT count(*) FROM students WHERE academy_id=$1", foreign.ID).Scan(&count))
	if count != 0 {
		t.Fatal("other academy changed")
	}
	must(db.QueryRow(ctx, "SELECT count(*) FROM classes WHERE academy_id=$1", academy.ID).Scan(&count))
	if count != 1 {
		t.Fatal("classes changed")
	}
	must(db.QueryRow(ctx, "SELECT count(*) FROM students WHERE academy_id=$1 AND name LIKE 'Demo • %' AND (status='inactive' OR archived_at IS NOT NULL)", academy.ID).Scan(&count))
	if count != 3 {
		t.Fatal("missing inactive examples", count)
	}
	must(db.QueryRow(ctx, "SELECT count(*) FROM invoices i JOIN students s ON s.academy_id=i.academy_id AND s.id=i.student_id WHERE i.academy_id=$1 AND s.name LIKE 'Demo • %' AND (i.payment_method='asaas_pix' OR EXISTS(SELECT 1 FROM pix_charges c WHERE c.invoice_id=i.id))", academy.ID).Scan(&count))
	if count != 0 {
		t.Fatal("seed created bank transactions")
	}
	must(db.QueryRow(ctx, "SELECT count(*) FROM invoices i JOIN students s ON s.academy_id=i.academy_id AND s.id=i.student_id WHERE i.academy_id=$1 AND i.competence<date_trunc('month',s.started_on)::date", academy.ID).Scan(&count))
	if count != 0 {
		t.Fatal("invoice predates enrollment")
	}
	digest := func() string {
		var v string
		must(db.QueryRow(ctx, `SELECT md5(jsonb_build_object('students',(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM students s WHERE academy_id=$1),'invoices',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM invoices i WHERE academy_id=$1),'attendance',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM attendances p WHERE academy_id=$1),'ranks',(SELECT jsonb_agg(to_jsonb(h) ORDER BY sequence) FROM student_graduation_events h WHERE academy_id=$1))::text)`, academy.ID).Scan(&v))
		return v
	}
	d := digest()
	second, err := demodata.Seed(ctx, db, academy.ID, account.User.ID, now)
	must(err)
	if second.Students != 0 || second.Existing != 18 || second.Attendances != 0 || second.Invoices != 0 || digest() != d {
		t.Fatal("rerun modified data", second)
	}
	if _, err = demodata.Seed(ctx, db, foreign.ID, core.ID(), now); err == nil {
		t.Fatal("unrelated principal allowed")
	}
}
