package billing

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"tatame/backend/internal/core"
	"time"
)

type Repository struct{ DB *pgxpool.Pool }

func GenerateTx(ctx context.Context, tx pgx.Tx, a, student string, now time.Time) error {
	return generateTx(ctx, tx, a, student, now, false)
}
func GenerateFirstTx(ctx context.Context, tx pgx.Tx, a, student string, now time.Time) error {
	return generateTx(ctx, tx, a, student, now, true)
}
func generateTx(ctx context.Context, tx pgx.Tx, a, student string, now time.Time, first bool) error {
	// Every contract mutation and the generator lock the student before billing.
	// Keeping the same lock order prevents a generator/edit deadlock.
	var locked string
	if err := tx.QueryRow(ctx, "SELECT id FROM students WHERE academy_id=$1 AND id=$2 FOR UPDATE", a, student).Scan(&locked); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return err
	}
	var enabled bool
	var amount int64
	var day int
	var next time.Time
	var name, doc, zone, status, ownName, ownCPF string
	var birth *time.Time
	e := tx.QueryRow(ctx, `SELECT b.enabled,b.amount_cents,b.due_day,b.next_month,b.payer_name,b.payer_document,a.timezone,s.status,s.birth_date,s.name,p.cpf
 FROM student_billing b JOIN students s ON s.academy_id=b.academy_id AND s.id=b.student_id JOIN academies a ON a.id=b.academy_id JOIN academy_participants p ON p.academy_id=s.academy_id AND p.id=s.participant_id
 WHERE b.academy_id=$1 AND b.student_id=$2 FOR UPDATE OF b,s`, a, student).Scan(&enabled, &amount, &day, &next, &name, &doc, &zone, &status, &birth, &ownName, &ownCPF)
	if errors.Is(e, pgx.ErrNoRows) {
		return nil
	}
	if e != nil {
		return e
	}
	if !enabled || status != "active" {
		return nil
	}
	loc, e := time.LoadLocation(zone)
	if e != nil {
		return e
	}
	local := now.In(loc)
	if birth != nil && core.AgeOn(*birth, local) >= 18 {
		if !ValidDocument(ownCPF) {
			return core.E(422, "invalid_cpf", "Atualize o CPF do aluno maior de idade antes de emitir mensalidades.")
		}
		name, doc = ownName, ownCPF
		if _, e = tx.Exec(ctx, "UPDATE student_billing SET payer_name=$3,payer_document=$4 WHERE academy_id=$1 AND student_id=$2", a, student, name, doc); e != nil {
			return e
		}
	}
	current := time.Date(local.Year(), local.Month(), 1, 0, 0, 0, 0, loc)
	// The first scheduled invoice is visible immediately, with its future due date.
	// Regular generation must not keep issuing another future month every minute.
	if next.After(current) && !first {
		var exists bool
		if e = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM invoices WHERE academy_id=$1 AND student_id=$2)", a, student).Scan(&exists); e != nil {
			return e
		}
		first = !exists
	}
	if first && next.After(current) {
		current = next
	}
	for !next.After(current) {
		due := DueDate(next, day)
		_, e = tx.Exec(ctx, `INSERT INTO invoices(id,academy_id,student_id,competence,due_date,amount_cents,payer_name,payer_document)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(academy_id,student_id,competence) DO NOTHING`, core.ID(), a, student, next.Format("2006-01-02"), due.Format("2006-01-02"), amount, name, doc)
		if e != nil {
			return e
		}
		next = next.AddDate(0, 1, 0)
	}
	_, e = tx.Exec(ctx, "UPDATE student_billing SET next_month=$1 WHERE academy_id=$2 AND student_id=$3", next.Format("2006-01-02"), a, student)
	return e
}
func (r Repository) Generate(ctx context.Context) error {
	rows, e := r.DB.Query(ctx, "SELECT academy_id,student_id FROM student_billing WHERE enabled")
	if e != nil {
		return e
	}
	type pair struct{ a, s string }
	all := []pair{}
	for rows.Next() {
		var v pair
		if e = rows.Scan(&v.a, &v.s); e != nil {
			rows.Close()
			return e
		}
		all = append(all, v)
	}
	e = rows.Err()
	rows.Close()
	if e != nil {
		return e
	}
	for _, v := range all {
		tx, e := r.DB.Begin(ctx)
		if e != nil {
			return e
		}
		e = GenerateTx(ctx, tx, v.a, v.s, time.Now())
		if e != nil {
			tx.Rollback(ctx)
			return e
		}
		if e = tx.Commit(ctx); e != nil {
			return e
		}
	}
	return nil
}
func (r Repository) List(ctx context.Context, a, student, month, status string, page, size int) (core.Page[Invoice], error) {
	out := core.Page[Invoice]{Items: []Invoice{}, Page: page, PageSize: size}
	where := ` FROM invoices i JOIN students s ON s.academy_id=i.academy_id AND s.id=i.student_id JOIN academies a ON a.id=i.academy_id
 WHERE i.academy_id=$1 AND ($2::text='' OR i.student_id::text=$2) AND ($3::text='' OR to_char(i.competence,'YYYY-MM')=$3)
 AND ($4::text='' OR CASE WHEN i.status='open' AND i.due_date<(now() AT TIME ZONE a.timezone)::date THEN 'overdue' ELSE i.status END=$4)`
	if e := r.DB.QueryRow(ctx, "SELECT count(*)"+where, a, student, month, status).Scan(&out.Total); e != nil {
		return out, e
	}
	rows, e := r.DB.Query(ctx, `SELECT i.id,i.student_id,s.name,to_char(i.competence,'YYYY-MM'),i.due_date::text,i.amount_cents,
 CASE WHEN i.status='open' AND i.due_date<(now() AT TIME ZONE a.timezone)::date THEN 'overdue' ELSE i.status END,i.paid_at,i.amount_cents+i.discount_cents,i.discount_cents,i.discount_reason,i.payment_method`+where+" ORDER BY i.competence DESC,s.name,i.id LIMIT $5 OFFSET $6", a, student, month, status, size, (page-1)*size)
	if e != nil {
		return out, e
	}
	defer rows.Close()
	for rows.Next() {
		var v Invoice
		if e = rows.Scan(&v.ID, &v.StudentID, &v.StudentName, &v.Competence, &v.DueDate, &v.AmountCents, &v.Status, &v.PaidAt, &v.OriginalAmountCents, &v.DiscountCents, &v.DiscountReason, &v.PaymentMethod); e != nil {
			return out, e
		}
		out.Items = append(out.Items, v)
	}
	return out, rows.Err()
}
func (r Repository) Get(ctx context.Context, a, id string) (Invoice, error) {
	var v Invoice
	e := r.DB.QueryRow(ctx, `SELECT i.id,i.student_id,s.name,to_char(i.competence,'YYYY-MM'),i.due_date::text,i.amount_cents,CASE WHEN i.status='open' AND i.due_date<(now() AT TIME ZONE a.timezone)::date THEN 'overdue' ELSE i.status END,i.paid_at,i.amount_cents+i.discount_cents,i.discount_cents,i.discount_reason,i.payment_method,i.payer_name,i.payer_document
 FROM invoices i JOIN students s ON s.academy_id=i.academy_id AND s.id=i.student_id JOIN academies a ON a.id=i.academy_id WHERE i.academy_id=$1 AND i.id=$2`, a, id).Scan(&v.ID, &v.StudentID, &v.StudentName, &v.Competence, &v.DueDate, &v.AmountCents, &v.Status, &v.PaidAt, &v.OriginalAmountCents, &v.DiscountCents, &v.DiscountReason, &v.PaymentMethod, &v.PayerName, &v.PayerDocument)
	if errors.Is(e, pgx.ErrNoRows) {
		e = core.E(404, "not_found", "Mensalidade não encontrada.")
	}
	return v, e
}
