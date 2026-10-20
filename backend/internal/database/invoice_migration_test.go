package database

import (
	"context"
	"database/sql"
	"github.com/pressly/goose/v3"
	"os"
	"tatame/backend/internal/core"
	"testing"
	"time"
)

func TestInvoiceAdjustmentMigrationPreservesIssuedValues(t *testing.T) {
	address := os.Getenv("INVOICE_MIGRATION_DATABASE_URL")
	if address == "" {
		t.Skip("fresh invoice migration database required")
	}
	db, e := sql.Open("pgx", address)
	if e != nil {
		t.Fatal(e)
	}
	defer db.Close()
	must := func(e error) {
		t.Helper()
		if e != nil {
			t.Fatal(e)
		}
	}
	goose.SetBaseFS(migrations)
	must(goose.SetDialect("postgres"))
	must(goose.UpTo(db, "migrations", 8))
	ctx := context.Background()
	person, user, a, participant, s, open, paid := core.ID(), core.ID(), core.ID(), core.ID(), core.ID(), core.ID(), core.ID()
	_, e = db.ExecContext(ctx, "INSERT INTO people(id,email) VALUES($1,$2)", person, person+"@test.example")
	must(e)
	_, e = db.ExecContext(ctx, "INSERT INTO users(id,person_id,name,password_hash) VALUES($1,$2,'Migrado','hash')", user, person)
	must(e)
	_, e = db.ExecContext(ctx, "INSERT INTO academies(id,name,code) VALUES($1,'Academia migrada',$2)", a, core.Token()[:10])
	must(e)
	_, e = db.ExecContext(ctx, "INSERT INTO academy_participants(id,academy_id,person_id,student_code,qr_token) VALUES($1,$2,$3,'12345678',$4)", participant, a, person, core.Token())
	must(e)
	_, e = db.ExecContext(ctx, "INSERT INTO students(id,academy_id,user_id,person_id,participant_id,name) VALUES($1,$2,$3,$4,$5,'Aluno migrado')", s, a, user, person, participant)
	must(e)
	_, e = db.ExecContext(ctx, "INSERT INTO invoices(id,academy_id,student_id,competence,due_date,amount_cents,payer_name,payer_document) VALUES($1,$2,$3,'2026-10-01','2026-10-25',20050,'Pagador','52998224725')", open, a, s)
	must(e)
	_, e = db.ExecContext(ctx, "INSERT INTO invoices(id,academy_id,student_id,competence,due_date,amount_cents,payer_name,payer_document,status,paid_at) VALUES($1,$2,$3,'2026-09-01','2026-09-25',18000,'Pagador','52998224725','paid',now())", paid, a, s)
	must(e)
	_, e = db.ExecContext(ctx, "INSERT INTO pix_charges(id,academy_id,invoice_id,reference,provider_id,state) VALUES($1,$2,$3,$4,'pay_open','ready'),($5,$2,$6,$7,'pay_paid','ready')", core.ID(), a, open, core.Token(), core.ID(), paid, core.Token())
	must(e)
	_, e = db.ExecContext(ctx, "INSERT INTO payment_receipts(academy_id,provider_id,invoice_id,amount_cents,paid_at,status) VALUES($1,'pay_paid',$2,18000,now(),'received')", a, paid)
	must(e)
	var before string
	must(db.QueryRow("SELECT md5(jsonb_agg(to_jsonb(i) ORDER BY id)::text) FROM invoices i").Scan(&before))
	modality := core.ID()
	_, e = db.ExecContext(ctx, "UPDATE students SET created_at='2023-01-01T12:00:00Z' WHERE id=$1", s)
	must(e)
	_, e = db.ExecContext(ctx, "INSERT INTO modalities(id,academy_id,name) VALUES($1,$2,'Jiu-Jitsu')", modality, a)
	must(e)
	_, e = db.ExecContext(ctx, "INSERT INTO student_modalities(academy_id,student_id,modality_id,belt,degrees) VALUES($1,$2,$3,'Faixa Azul',3)", a, s, modality)
	must(e)
	beforeMigration := time.Now().Add(-time.Second)
	must(Migrate(address))
	var baseline int
	must(db.QueryRow("SELECT count(*) FROM student_graduation_events WHERE academy_id=$1 AND student_id=$2 AND kind='baseline' AND belt='Faixa Azul' AND degrees=3 AND occurred_at IS NULL", a, s).Scan(&baseline))
	if baseline != 1 {
		t.Fatal("legacy rank was lost or received an invented award date")
	}
	var activeStart, joined time.Time
	must(db.QueryRow("SELECT started_at FROM student_active_periods WHERE academy_id=$1 AND student_id=$2 AND ended_at IS NULL", a, s).Scan(&activeStart))
	must(db.QueryRow("SELECT created_at FROM students WHERE id=$1", s).Scan(&joined))
	if activeStart.Before(beforeMigration) || joined.Year() != 2023 {
		t.Fatal("legacy active periods were invented or enrollment date changed")
	}

	var after string
	must(db.QueryRow("SELECT md5(jsonb_agg(to_jsonb(i)-'discount_cents'-'discount_reason'-'payment_method' ORDER BY id)::text) FROM invoices i").Scan(&after))
	if before != after {
		t.Fatal("migration changed previous invoice data")
	}
	var amount, discount int64
	var method string
	must(db.QueryRow("SELECT amount_cents,discount_cents,payment_method FROM invoices WHERE id=$1", paid).Scan(&amount, &discount, &method))
	if amount != 18000 || discount != 0 || method != "asaas_pix" {
		t.Fatal("paid invoice was not preserved", amount, discount, method)
	}
	var mismatches int
	must(db.QueryRow("SELECT count(*) FROM pix_charges c JOIN invoices i ON i.academy_id=c.academy_id AND i.id=c.invoice_id WHERE c.amount_cents<>i.amount_cents").Scan(&mismatches))
	if mismatches != 0 {
		t.Fatal("issued Pix amount was changed")
	}
	var count int
	must(db.QueryRow("SELECT count(*) FROM invoice_adjustments").Scan(&count))
	if count != 0 {
		t.Fatal("migration invented manual adjustments")
	}
}
