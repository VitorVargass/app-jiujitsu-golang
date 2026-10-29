package students

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"slices"
	"strings"
	"tatame/backend/internal/core"
	"time"
)

type PublicEnrollment struct {
	Name              string            `json:"name"`
	CPF               string            `json:"cpf"`
	BirthDate         string            `json:"birth_date"`
	Phone             string            `json:"phone"`
	AlternatePhone    string            `json:"alternate_phone"`
	GuardianCPF       string            `json:"guardian_cpf"`
	GuardianBirthDate string            `json:"guardian_birth_date"`
	PlanID            string            `json:"plan_id"`
	Details           []EnrollmentInput `json:"modality_details"`
	ExpectedAmount    int64             `json:"expected_amount_cents"`
	DueDay            *int              `json:"due_day,omitempty"`
}
type EnrollmentResult struct {
	ID        string `json:"id"`
	Status    string `json:"status"`
	AcademyID string `json:"academy_id"`
	StudentID string `json:"student_id,omitempty"`
	FirstDue  string `json:"first_due,omitempty"`
}

func (r Repository) Enroll(ctx context.Context, token, key string, in PublicEnrollment) (EnrollmentResult, error) {
	out := EnrollmentResult{}
	u := core.P(ctx).UserID
	if !core.ValidID(u) {
		return out, core.E(403, "forbidden", "Entre com sua conta para continuar.")
	}
	if len(key) < 16 || len(key) > 128 {
		return out, core.E(422, "idempotency_required", "Atualize a página e tente novamente.")
	}
	in.Name = strings.TrimSpace(in.Name)
	in.Phone = strings.TrimSpace(in.Phone)
	in.AlternatePhone = strings.TrimSpace(in.AlternatePhone)
	cpf, ok := core.NormalizeCPF(in.CPF)
	if !ok || cpf == "" {
		return out, core.E(422, "invalid_cpf", "Informe o CPF válido do aluno.")
	}
	in.CPF = cpf
	if len(in.Name) < 2 || len(in.Name) > 100 || len(in.Phone) < 8 || len(in.Phone) > 30 || len(in.AlternatePhone) > 30 {
		return out, core.E(422, "invalid_contact", "Confira nome e telefones.")
	}
	if len(in.Details) == 0 || len(in.Details) > 30 || in.PlanID != "" && !core.ValidID(in.PlanID) {
		return out, core.E(422, "invalid_offer", "Selecione um plano ou modalidades.")
	}
	if in.DueDay != nil && (*in.DueDay < 1 || *in.DueDay > 31) {
		return out, core.E(422, "invalid_due_day", "Escolha um dia de vencimento entre 1 e 31.")
	}
	raw, e := json.Marshal(in)
	if e != nil {
		return out, e
	}
	hash := core.Hash(string(raw))
	tx, e := r.DB.Begin(ctx)
	if e != nil {
		return out, e
	}
	defer tx.Rollback(ctx)
	preview, cfg, e := r.previewTx(ctx, tx, token)
	if e != nil {
		return out, e
	}
	a := preview.AcademyID
	var blocked bool
	if e = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM memberships WHERE academy_id=$1 AND user_id=$2 AND status='blocked')", a, u).Scan(&blocked); e != nil {
		return out, e
	}
	if blocked {
		return out, core.E(403, "membership_blocked", "Peça à academia para revisar seu acesso bloqueado.")
	}

	// Serialize keys across academies as well as submissions within this academy.
	if _, e = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1,0))", u+":"+key); e != nil {
		return out, e
	}
	var oldHash string
	e = tx.QueryRow(ctx, "SELECT id,status,academy_id,COALESCE(student_id::text,''),payload_hash FROM enrollment_submissions WHERE user_id=$1 AND idempotency_key=$2", u, key).Scan(&out.ID, &out.Status, &out.AcademyID, &out.StudentID, &oldHash)
	if e == nil {
		if oldHash != hash || out.AcademyID != a {
			return EnrollmentResult{}, core.E(409, "idempotency_conflict", "Esta tentativa já foi usada com outros dados.")
		}
		if out.Status == "pending" || out.Status == "rejected" {
			out.StudentID = ""
		}
		if out.Status == "active" {
			if e = tx.QueryRow(ctx, "SELECT COALESCE(to_char(min(due_date),'YYYY-MM-DD'),'') FROM invoices WHERE academy_id=$1 AND student_id=$2", a, out.StudentID).Scan(&out.FirstDue); e != nil {
				return out, e
			}
		}
		return out, nil
	}
	if !errors.Is(e, pgx.ErrNoRows) {
		return out, e
	}
	e = tx.QueryRow(ctx, "SELECT id,status,academy_id,COALESCE(student_id::text,'') FROM enrollment_submissions WHERE academy_id=$1 AND user_id=$2 AND cpf=$3", a, u, cpf).Scan(&out.ID, &out.Status, &out.AcademyID, &out.StudentID)
	if e == nil {
		if out.Status == "pending" || out.Status == "rejected" {
			out.StudentID = ""
		}
		if out.Status == "active" {
			if e = tx.QueryRow(ctx, "SELECT COALESCE(to_char(min(due_date),'YYYY-MM-DD'),'') FROM invoices WHERE academy_id=$1 AND student_id=$2", a, out.StudentID).Scan(&out.FirstDue); e != nil {
				return out, e
			}
		}
		return out, nil
	}
	if !errors.Is(e, pgx.ErrNoRows) {
		return out, e
	}
	loc, e := time.LoadLocation(preview.Timezone)
	if e != nil {
		return out, e
	}
	today := time.Now().In(loc)
	birth, e := time.Parse("2006-01-02", in.BirthDate)
	if e != nil || birth.Year() < 1900 || in.BirthDate > today.Format("2006-01-02") {
		return out, core.E(422, "invalid_birth_date", "Confira a data de nascimento do aluno.")
	}
	minor := core.AgeOn(birth, today) < 18
	var actorName, email string
	if e = tx.QueryRow(ctx, "SELECT u.name,p.email FROM users u JOIN people p ON p.id=u.person_id WHERE u.id=$1", u).Scan(&actorName, &email); e != nil {
		return out, e
	}
	if minor {
		doc, valid := core.NormalizeCPF(in.GuardianCPF)
		gb, err := time.Parse("2006-01-02", in.GuardianBirthDate)
		if !valid || doc == "" || doc == cpf || err != nil || gb.Year() < 1900 || core.AgeOn(gb, today) < 18 || in.GuardianBirthDate > today.Format("2006-01-02") {
			return out, core.E(422, "guardian_required", "Informe CPF e nascimento de um responsável maior de idade, diferente do aluno.")
		}
		in.GuardianCPF = doc
	} else {
		in.GuardianCPF = ""
		in.GuardianBirthDate = ""
	}
	// All prices and offer eligibility come from the locked public catalog.
	amount := int64(0)
	planIDs := []string{}
	mode := "modalities"
	if in.PlanID != "" {
		mode = "plan"
		found := false
		for _, p := range preview.Plans {
			if p.ID == in.PlanID {
				found = true
				amount = p.AmountCents
				planIDs = p.Modalities
			}
		}
		if !found {
			return out, core.E(422, "invalid_plan", "Plano indisponível. Atualize as ofertas.")
		}
	}
	seen := map[string]bool{}
	for i := range in.Details {
		d := &in.Details[i]
		if seen[d.ModalityID] {
			return out, core.E(422, "invalid_modality", "Modalidade repetida.")
		}
		seen[d.ModalityID] = true
		found := false
		for _, m := range preview.Modalities {
			if m.ID == d.ModalityID {
				found = true
				if mode == "modalities" {
					if !slices.Contains(cfg.Modalities, m.ID) || m.AmountCents <= 0 {
						return out, core.E(422, "invalid_offer", "Modalidade não disponível separadamente.")
					}
					d.AmountCents = m.AmountCents
					amount += m.AmountCents
				} else {
					d.AmountCents = 0
					if !slices.Contains(planIDs, m.ID) {
						return out, core.E(422, "invalid_plan", "Modalidades divergentes do plano.")
					}
				}
			}
		}
		if !found {
			return out, core.E(422, "invalid_offer", "Modalidade indisponível.")
		}
	}
	if mode == "plan" && len(seen) != len(planIDs) {
		return out, core.E(422, "invalid_plan", "Confira as modalidades do plano.")
	}
	if amount < 1 || amount > 100000000 || amount != in.ExpectedAmount {
		return out, core.E(409, "price_changed", "O valor da oferta mudou. Atualize a página e confira antes de concluir.")
	}
	// Older installed clients may omit the field; new enrollment forms ask explicitly.
	day := cfg.DueDay
	if in.DueDay != nil {
		day = *in.DueDay
	}
	due := nextEnrollmentDue(today, day)
	in.DueDay = &day
	payer, document := actorName, in.GuardianCPF
	if !minor {
		payer = in.Name
		document = cpf
	}
	input := Input{Name: in.Name, CPF: &cpf, BirthDate: &in.BirthDate, Phone: in.Phone, AlternatePhone: in.AlternatePhone, Status: "active", UseMyAccount: !minor, ChargeMode: mode, PlanID: in.PlanID, ModalityDetails: in.Details, Billing: &Billing{Enabled: true, AmountCents: amount, DueDay: day, FirstMonth: due.Format("2006-01"), PayerName: payer, PayerDocument: document}}
	if !minor {
		input.Email = email
	}
	if e = normalizeEnrollments(&input); e != nil {
		return out, e
	}
	if e = resolveEnrollments(ctx, tx, a, "", &input); e != nil {
		return out, e
	}
	// Preserve the submitted details for manager review, with canonical prices.
	in.Details = input.ModalityDetails
	raw, e = json.Marshal(in)
	if e != nil {
		return out, e
	}
	sid := ""
	e = tx.QueryRow(ctx, "SELECT s.id FROM students s JOIN academy_participants p ON p.id=s.participant_id AND p.academy_id=s.academy_id WHERE s.academy_id=$1 AND p.cpf=$2", a, cpf).Scan(&sid)
	out = EnrollmentResult{ID: core.ID(), AcademyID: a, Status: "pending"}
	if errors.Is(e, pgx.ErrNoRows) {
		if minor {
			if e = r.guardianProfile(ctx, tx, a, u, in.GuardianCPF, in.GuardianBirthDate); e != nil {
				return out, e
			}
		}
		sid, e = r.saveStudentTx(ctx, tx, a, "", input)
		if e != nil {
			return out, e
		}
		if minor {
			if e = r.linkGuardian(ctx, tx, a, sid, u, ""); e != nil {
				return out, e
			}
		}
		out.Status = "active"
		out.StudentID = sid
		out.FirstDue = due.Format("2006-01-02")
	} else if e != nil {
		return out, e
	}
	_, e = tx.Exec(ctx, `INSERT INTO enrollment_submissions(id,academy_id,user_id,cpf,payload,payload_hash,idempotency_key,status,student_id,is_minor) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)`, out.ID, a, u, cpf, string(raw), hash, key, out.Status, sid, minor)
	if e != nil {
		return out, e
	}
	if e = tx.Commit(ctx); e != nil {
		return out, identityError(e)
	}
	return out, nil
}
func (r Repository) guardianProfile(ctx context.Context, tx pgx.Tx, a, u, cpf, birth string) error {
	var ok bool
	e := tx.QueryRow(ctx, `INSERT INTO guardian_profiles(academy_id,user_id,cpf,birth_date) VALUES($1,$2,$3,$4::date) ON CONFLICT(academy_id,user_id) DO UPDATE SET cpf=guardian_profiles.cpf RETURNING cpf=$3 AND birth_date=$4::date`, a, u, cpf, birth).Scan(&ok)
	if e != nil {
		return e
	}
	if !ok {
		return core.E(409, "guardian_identity", "Os dados do responsável divergem dos já cadastrados. Peça à academia para conferir.")
	}
	return nil
}
func (r Repository) linkGuardian(ctx context.Context, tx pgx.Tx, a, sid, u, approver string) error {
	var mid string
	e := tx.QueryRow(ctx, `INSERT INTO memberships(id,academy_id,user_id,status,student_code,qr_token) VALUES($1,$2,$3,'active',$4,$5) ON CONFLICT(academy_id,user_id) DO UPDATE SET status=memberships.status RETURNING id`, core.ID(), a, u, core.Digits(), core.Token()).Scan(&mid)
	if e != nil {
		return e
	}
	var active bool
	if e = tx.QueryRow(ctx, "SELECT status='active' FROM memberships WHERE id=$1", mid).Scan(&active); e != nil {
		return e
	}
	if !active {
		return core.E(403, "membership_blocked", "Peça à academia para revisar seu acesso bloqueado.")
	}
	if _, e = tx.Exec(ctx, "INSERT INTO membership_roles(membership_id,role) VALUES($1,'guardian') ON CONFLICT DO NOTHING", mid); e != nil {
		return e
	}
	_, e = tx.Exec(ctx, `INSERT INTO student_guardians(academy_id,student_id,user_id,approved_by) VALUES($1,$2,$3,NULLIF($4,'')::uuid) ON CONFLICT(academy_id,student_id,user_id) DO UPDATE SET active=true,approved_by=EXCLUDED.approved_by,updated_at=now()`, a, sid, u, approver)
	return e
}
