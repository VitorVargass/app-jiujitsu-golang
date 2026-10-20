// Package demodata creates explicitly fictitious records in one existing academy.
package demodata

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"tatame/backend/internal/billing"
	"tatame/backend/internal/core"
)

const Marker = "Demo • "

type Summary struct {
	Academy          string `json:"academy"`
	Students         int    `json:"students_created"`
	Existing         int    `json:"demo_students_already_present"`
	Plans            int    `json:"plans_created"`
	Sessions         int    `json:"sessions_created"`
	Attendances      int    `json:"attendances_created"`
	Invoices         int    `json:"invoices_created"`
	GraduationEvents int    `json:"graduation_events_created"`
}
type slot struct {
	id, class, modality         string
	day, hour, minute, duration int
}
type person struct {
	id, participant, cpf, name, modality string
	start, stop                          time.Time
	active                               bool
}

var names = []string{"Rafael Almeida", "Camila Ribeiro", "Lucas Martins", "Mariana Costa", "Gabriel Santos", "Beatriz Oliveira", "Pedro Ferreira", "Juliana Lima", "Felipe Rocha", "Larissa Mendes", "Bruno Carvalho", "Amanda Dias", "Miguel Barbosa", "Helena Nunes", "Thiago Vieira", "Isabela Gomes", "Diego Moreira", "Renata Azevedo"}

func Seed(ctx context.Context, db *pgxpool.Pool, academy, actor string, now time.Time) (Summary, error) {
	out := Summary{}
	tx, err := db.Begin(ctx)
	if err != nil {
		return out, err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1,0))", "tatamemix-demo-v1:"+academy); err != nil {
		return out, err
	}
	var zone string
	if err = tx.QueryRow(ctx, "SELECT name,timezone FROM academies WHERE id=$1", academy).Scan(&out.Academy, &zone); err != nil {
		return out, err
	}
	var authorized bool
	if err = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM memberships m JOIN membership_roles r ON r.membership_id=m.id WHERE m.academy_id=$1 AND m.user_id=$2 AND m.status='active' AND r.role='admin')", academy, actor).Scan(&authorized); err != nil {
		return out, err
	}
	if !authorized {
		return out, errors.New("gestor ativo da academia necessário")
	}
	loc, err := time.LoadLocation(zone)
	if err != nil {
		return out, err
	}
	now = now.In(loc)
	if _, err = tx.Exec(ctx, "SELECT set_config('tatame.actor_user_id',$1,true)", actor); err != nil {
		return out, err
	}
	rows, err := tx.Query(ctx, "SELECT sc.id,c.id,c.modality_id,sc.weekday,extract(hour from sc.start_time)::int,extract(minute from sc.start_time)::int,sc.duration_minutes FROM class_schedules sc JOIN classes c ON c.id=sc.class_id AND c.academy_id=sc.academy_id WHERE sc.academy_id=$1 AND sc.deleted_at IS NULL AND c.deleted_at IS NULL AND c.active AND c.modality_id IS NOT NULL ORDER BY c.name,sc.weekday,sc.start_time", academy)
	if err != nil {
		return out, err
	}
	slots := []slot{}
	for rows.Next() {
		var s slot
		if err = rows.Scan(&s.id, &s.class, &s.modality, &s.day, &s.hour, &s.minute, &s.duration); err != nil {
			rows.Close()
			return out, err
		}
		slots = append(slots, s)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return out, err
	}
	if len(slots) == 0 {
		return out, errors.New("cadastre ao menos uma turma ativa com horário antes de popular os exemplos")
	}
	modalities := []string{}
	for _, s := range slots {
		found := false
		for _, id := range modalities {
			if id == s.modality {
				found = true
			}
		}
		if !found {
			modalities = append(modalities, s.modality)
		}
	}
	// Keep existing modality prices and classes unchanged.
	planIDs := []string{}
	for i, name := range []string{"Demo • Essencial", "Demo • Jiu-Jitsu + No-Gi"} {
		var id string
		err = tx.QueryRow(ctx, "SELECT id FROM plans WHERE academy_id=$1 AND name=$2 ORDER BY id LIMIT 1", academy, name).Scan(&id)
		if errors.Is(err, pgx.ErrNoRows) {
			id = core.ID()
			amount := 18000
			if i == 1 {
				amount = 25000
			}
			if _, err = tx.Exec(ctx, "INSERT INTO plans(id,academy_id,name,amount_cents) VALUES($1,$2,$3,$4)", id, academy, name, amount); err != nil {
				return out, err
			}
			for j, m := range modalities {
				if i == 0 && j > 0 {
					break
				}
				if _, err = tx.Exec(ctx, "INSERT INTO plan_modalities(academy_id,plan_id,modality_id) VALUES($1,$2,$3)", academy, id, m); err != nil {
					return out, err
				}
			}
			out.Plans++
		} else if err != nil {
			return out, err
		}
		planIDs = append(planIDs, id)
	}
	people := []person{}
	month := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, loc)
	for i, name := range names {
		email := fmt.Sprintf("demo.%s.aluno%02d@example.test", strings.ReplaceAll(academy, "-", "")[:12], i+1)
		var existing string
		err = tx.QueryRow(ctx, "SELECT s.id FROM students s JOIN people p ON p.id=s.person_id WHERE s.academy_id=$1 AND p.email=$2", academy, email).Scan(&existing)
		if err == nil {
			out.Existing++
			continue
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return out, err
		}
		cpf := ""
		for attempt := 0; attempt < 100; attempt++ {
			candidate := CPF(876500000 + i*100 + attempt)
			var used bool
			if err = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM academy_participants WHERE academy_id=$1 AND cpf=$2)", academy, candidate).Scan(&used); err != nil {
				return out, err
			}
			if !used {
				cpf = candidate
				break
			}
		}
		if cpf == "" {
			return out, errors.New("não foi possível reservar CPF de exemplo")
		}
		start := now.AddDate(-1-i%6, -i%5, -i)
		minor := i == 12 || i == 13
		birth := "1992-04-12"
		if i%3 == 0 {
			birth = "1985-08-20"
		}
		if minor {
			birth = fmt.Sprintf("%d-05-15", now.Year()-10-i%2)
			start = now.AddDate(0, -9-i%3, 0)
		}
		if i == 14 {
			start = now.AddDate(0, 0, -14)
		}
		p := person{id: core.ID(), participant: core.ID(), cpf: cpf, name: Marker + name, modality: modalities[0], start: start, active: i < 15}
		if !p.active {
			p.stop = now.AddDate(0, 0, -14*(i-14))
		}
		pid := core.ID()
		plan := planIDs[0]
		amount := int64(18000)
		if i%3 == 1 {
			plan = planIDs[1]
			amount = 25000
		}
		if i%3 == 2 {
			amount = 16000 + int64(i%4)*1000
		}
		belt := []string{"Faixa Preta", "Faixa Azul", "Faixa Branca", "Faixa Roxa", "Faixa Marrom"}[i%5]
		degree := i % 4
		if minor {
			belt = "Faixa Branca"
			degree = i % 3
		}
		if _, err = tx.Exec(ctx, "INSERT INTO people(id,email) VALUES($1,$2)", pid, email); err != nil {
			return out, err
		}
		if _, err = tx.Exec(ctx, "INSERT INTO academy_participants(id,academy_id,person_id,cpf,student_code,qr_token) VALUES($1,$2,$3,$4,$5,$6)", p.participant, academy, pid, cpf, core.Digits(), core.Token()); err != nil {
			return out, err
		}
		mode := "plan"
		var savedPlan any = plan
		if i%3 == 2 {
			mode = "modalities"
			savedPlan = nil
		}
		if _, err = tx.Exec(ctx, "INSERT INTO students(id,academy_id,person_id,participant_id,name,status,belt,birth_date,started_on,activity_tracking_started_at,plan_id,charge_mode) VALUES($1,$2,$3,$4,$5,'active',$6,$7::date,$8::date,$9,$10,$11)", p.id, academy, pid, p.participant, p.name, belt, birth, start.Format("2006-01-02"), start, savedPlan, mode); err != nil {
			return out, err
		}
		if _, err = tx.Exec(ctx, "UPDATE student_active_periods SET started_at=$3 WHERE academy_id=$1 AND student_id=$2 AND ended_at IS NULL", academy, p.id, start); err != nil {
			return out, err
		}
		enrolled := []string{modalities[0]}
		if i%3 == 1 {
			enrolled = modalities
		}
		for _, m := range enrolled {
			cents := int64(0)
			if mode == "modalities" {
				cents = amount
			}
			if _, err = tx.Exec(ctx, "INSERT INTO student_modalities(academy_id,student_id,modality_id,belt,degrees,amount_cents) VALUES($1,$2,$3,$4,$5,$6)", academy, p.id, m, belt, degree, cents); err != nil {
				return out, err
			}
			// These records are explicitly fictitious and belong only to Demo students.
			previous := "Faixa Branca"
			previousDegree := 0
			if belt == "Faixa Preta" {
				previous = "Faixa Marrom"
				previousDegree = 4
			}
			if _, err = tx.Exec(ctx, "UPDATE student_graduation_events SET belt=$4,degrees=$5,recorded_at=$6 WHERE academy_id=$1 AND student_id=$2 AND modality_id=$3 AND kind='initial'", academy, p.id, m, previous, previousDegree, start); err != nil {
				return out, err
			}
			eventAt := start.AddDate(0, 4, 0)
			if !eventAt.Before(now) {
				eventAt = now.AddDate(0, 0, -3)
			}
			if _, err = tx.Exec(ctx, "INSERT INTO student_graduation_events(id,academy_id,student_id,modality_id,kind,previous_belt,previous_degrees,belt,degrees,occurred_at,recorded_at,actor_user_id) VALUES($1,$2,$3,$4,'change',$5,$6,$7,$8,$9,$9,$10)", core.ID(), academy, p.id, m, previous, previousDegree, belt, degree, eventAt, actor); err != nil {
				return out, err
			}
			out.GraduationEvents += 2
		}
		payer, document := p.name, cpf
		if minor {
			payer = "Demo • Responsável de " + name
			document = CPF(765400000 + i)
		}
		dueDay := 10
		if i%5 == 2 {
			dueDay = 25
		}
		if i%5 == 3 {
			dueDay = 28
		}
		next := month.AddDate(0, 2, 0)
		if _, err = tx.Exec(ctx, "INSERT INTO student_billing(academy_id,student_id,enabled,amount_cents,due_day,next_month,payer_name,payer_document) VALUES($1,$2,$3,$4,$5,$6::date,$7,$8)", academy, p.id, p.active, amount, dueDay, next.Format("2006-01-02"), payer, document); err != nil {
			return out, err
		}
		for offset := -2; offset <= 1; offset++ {
			competence := month.AddDate(0, offset, 0)
			startMonth := time.Date(start.Year(), start.Month(), 1, 0, 0, 0, 0, loc)
			if competence.Before(startMonth) || (!p.active && !competence.Before(p.stop)) {
				continue
			}
			due := billing.DueDate(competence, dueDay)
			state := "open"
			method := ""
			var paid any
			if offset < 0 && (i+offset)%5 != 0 || offset == 0 && i%5 == 0 {
				state = "paid"
				method = []string{"cash", "pix", "transfer"}[i%3]
				at := due.AddDate(0, 0, -1).Add(10 * time.Hour)
				if at.After(now) {
					at = now.Add(-time.Hour)
				}
				paid = at
			}
			if offset == 0 && i%5 == 4 {
				state = "cancelled"
			}
			discount := int64(0)
			reason := ""
			if offset == 0 && i%5 == 3 {
				discount = 2000
				reason = "Desconto fictício para demonstração"
			}
			iid := core.ID()
			if _, err = tx.Exec(ctx, "INSERT INTO invoices(id,academy_id,student_id,competence,due_date,amount_cents,payer_name,payer_document,status,paid_at,discount_cents,discount_reason,payment_method) VALUES($1,$2,$3,$4::date,$5::date,$6,$7,$8,$9,$10,$11,$12,$13)", iid, academy, p.id, competence.Format("2006-01-02"), due.Format("2006-01-02"), amount-discount, payer, document, state, paid, discount, reason, method); err != nil {
				return out, err
			}
			if discount > 0 {
				if _, err = tx.Exec(ctx, "INSERT INTO invoice_adjustments(id,academy_id,invoice_id,actor_user_id,kind,previous_amount_cents,amount_cents,discount_cents,note) VALUES($1,$2,$3,$4,'discount',$5,$6,$7,'Demo: desconto fictício para apresentação')", core.ID(), academy, iid, actor, amount, amount-discount, discount); err != nil {
					return out, err
				}
			}
			if state == "paid" {
				if _, err = tx.Exec(ctx, "INSERT INTO invoice_adjustments(id,academy_id,invoice_id,actor_user_id,kind,previous_amount_cents,amount_cents,discount_cents,payment_method,note,created_at) VALUES($1,$2,$3,$4,'manual_payment',$5,$5,$6,$7,'Demo: recebimento fictício, sem movimentação financeira',$8)", core.ID(), academy, iid, actor, amount-discount, discount, method, paid); err != nil {
					return out, err
				}
			}
			out.Invoices++
		}
		if !p.active {
			if _, err = tx.Exec(ctx, "UPDATE students SET status='inactive',archived_at=CASE WHEN $3 THEN now() ELSE NULL END WHERE academy_id=$1 AND id=$2", academy, p.id, i == 17); err != nil {
				return out, err
			}
			if _, err = tx.Exec(ctx, "UPDATE student_active_periods SET ended_at=$3 WHERE academy_id=$1 AND student_id=$2 AND ended_at IS NOT NULL", academy, p.id, p.stop); err != nil {
				return out, err
			}
		}
		people = append(people, p)
		out.Students++
	}
	// A second run preserves even previously edited Demo data.
	for day := 60; day >= 0 && len(people) > 0; day-- {
		date := now.AddDate(0, 0, -day)
		options := []slot{}
		for _, s := range slots {
			if s.day == int(date.Weekday()) {
				options = append(options, s)
			}
		}
		if len(options) == 0 {
			continue
		}
		chosen := options[day%len(options)]
		at := time.Date(date.Year(), date.Month(), date.Day(), chosen.hour, chosen.minute, 0, 0, loc)
		if !at.Add(time.Duration(chosen.duration) * time.Minute).Before(now) {
			continue
		}
		session := core.ID()
		var saved string
		err = tx.QueryRow(ctx, "SELECT id FROM class_sessions WHERE academy_id=$1 AND class_id=$2 AND starts_at=$3 AND status<>'cancelled'", academy, chosen.class, at).Scan(&saved)
		if errors.Is(err, pgx.ErrNoRows) {
			var cancelled bool
			if err = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM class_sessions WHERE academy_id=$1 AND class_id=$2 AND starts_at=$3)", academy, chosen.class, at).Scan(&cancelled); err != nil {
				return out, err
			}
			if cancelled {
				continue
			}
			if _, err = tx.Exec(ctx, "INSERT INTO class_sessions(id,academy_id,class_id,schedule_id,starts_at,status) VALUES($1,$2,$3,$4,$5,'closed')", session, academy, chosen.class, chosen.id, at); err != nil {
				return out, err
			}
			out.Sessions++
		} else if err != nil {
			return out, err
		} else {
			session = saved
		}
		for i, p := range people {
			if i%3 == day%3 || at.Before(p.start) || (!p.active && !at.Before(p.stop)) {
				continue
			}
			// Occasional No-Gi participation is allowed for any active student in this MVP.
			var recordedBy any
			if (i+day)%4 == 0 {
				recordedBy = actor
			}
			tag, err := tx.Exec(ctx, "INSERT INTO attendances(id,academy_id,session_id,participant_id,recorded_by_user_id,checked_in_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(academy_id,session_id,participant_id) DO NOTHING", core.ID(), academy, session, p.participant, recordedBy, at.Add(time.Duration(i%9)*time.Minute))
			if err != nil {
				return out, err
			}
			out.Attendances += int(tag.RowsAffected())
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return out, err
	}
	return out, nil
}

// CPF returns valid checksum digits for a synthetic nine-digit base, only for Demo records.
func CPF(base int) string {
	text := fmt.Sprintf("%09d", base)
	for n := 10; n <= 11; n++ {
		sum := 0
		for i, c := range text {
			sum += int(c-'0') * (n - i)
		}
		digit := (sum * 10) % 11
		if digit == 10 {
			digit = 0
		}
		text += fmt.Sprint(digit)
	}
	return text
}
