package students

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"slices"
	"tatame/backend/internal/core"
	"time"
)

type EnrollmentLink struct {
	Token      string     `json:"token,omitempty"`
	Enabled    bool       `json:"enabled"`
	DueDay     int        `json:"due_day"`
	Modalities []string   `json:"modality_ids"`
	Plans      []string   `json:"plan_ids"`
	Rotate     bool       `json:"rotate,omitempty"`
	UpdatedBy  string     `json:"updated_by,omitempty"`
	UpdatedAt  *time.Time `json:"updated_at,omitempty"`
}
type EnrollmentPreview struct {
	AcademyID           string    `json:"academy_id"`
	AcademyName         string    `json:"academy_name"`
	Timezone            string    `json:"timezone"`
	AvailableModalities []string  `json:"available_modality_ids"`
	DueDay              int       `json:"due_day"`
	FirstDue            string    `json:"first_due"`
	Modalities          []Catalog `json:"modalities"`
	Plans               []Catalog `json:"plans"`
}

func nextEnrollmentDue(now time.Time, day int) time.Time {
	// Clamp 29/30/31 before comparing. A due date equal to today is not upcoming.
	month := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	due := enrollmentDue(month, day)
	if due.Format("2006-01-02") <= now.Format("2006-01-02") {
		due = enrollmentDue(month.AddDate(0, 1, 0), day)
	}
	return due
}
func enrollmentDue(month time.Time, day int) time.Time {
	last := month.AddDate(0, 1, -1).Day()
	if day > last {
		day = last
	}
	return month.AddDate(0, 0, day-1)
}
func (r Repository) EnrollmentLink(ctx context.Context, a string) (EnrollmentLink, error) {
	v := EnrollmentLink{DueDay: 10, Modalities: []string{}, Plans: []string{}}
	err := r.DB.QueryRow(ctx, "SELECT token,enabled,due_day,modality_ids,plan_ids,updated_by,updated_at FROM enrollment_links WHERE academy_id=$1", a).Scan(&v.Token, &v.Enabled, &v.DueDay, &v.Modalities, &v.Plans, &v.UpdatedBy, &v.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		err = nil
	}
	return v, err
}
func (r Repository) SaveEnrollmentLink(ctx context.Context, a string, in EnrollmentLink) (EnrollmentLink, error) {
	if in.DueDay < 1 || in.DueDay > 31 || len(in.Modalities) > 30 || len(in.Plans) > 100 {
		return in, core.E(422, "invalid_link", "Confira o vencimento e as ofertas publicadas.")
	}
	if in.Modalities == nil {
		in.Modalities = []string{}
	}
	if in.Plans == nil {
		in.Plans = []string{}
	}
	for _, ids := range [][]string{in.Modalities, in.Plans} {
		seen := map[string]bool{}
		for _, id := range ids {
			if !core.ValidID(id) || seen[id] {
				return in, core.E(422, "invalid_offer", "Oferta inválida ou repetida.")
			}
			seen[id] = true
		}
	}
	if in.Enabled && len(in.Modalities)+len(in.Plans) == 0 {
		return in, core.E(422, "no_offers", "Publique pelo menos uma modalidade ou plano com preço definido.")
	}
	tx, e := r.DB.Begin(ctx)
	if e != nil {
		return in, e
	}
	defer tx.Rollback(ctx)
	if _, e = tx.Exec(ctx, "SELECT id FROM academies WHERE id=$1 FOR UPDATE", a); e != nil {
		return in, e
	}
	if e = requireEnrollmentManager(ctx, tx, a); e != nil {
		return in, e
	}
	// Catalog IDs are scoped to this academy. Plans may contain modalities that are not sold separately.
	for _, item := range []struct {
		table string
		ids   []string
	}{{"modalities", in.Modalities}, {"plans", in.Plans}} {
		for _, id := range item.ids {
			var ok bool
			e = tx.QueryRow(ctx, "SELECT (active AND amount_cents>0) OR NOT $3 FROM "+item.table+" WHERE academy_id=$1 AND id=$2 FOR SHARE", a, id, in.Enabled).Scan(&ok)
			if errors.Is(e, pgx.ErrNoRows) || e == nil && !ok {
				return in, core.E(422, "invalid_offer", "Publique somente ofertas ativas desta academia com valor maior que zero.")
			}
			if e != nil {
				return in, e
			}
			if item.table == "plans" && in.Enabled {
				var n int
				if e = tx.QueryRow(ctx, "SELECT count(*) FROM plan_modalities pm JOIN modalities m ON m.academy_id=pm.academy_id AND m.id=pm.modality_id WHERE pm.academy_id=$1 AND pm.plan_id=$2 AND m.active", a, id).Scan(&n); e != nil {
					return in, e
				}
				if n == 0 {
					return in, core.E(422, "invalid_plan", "O plano precisa conter modalidades ativas.")
				}
			}
		}
	}
	token := core.Token()
	if !in.Rotate {
		var old string
		e = tx.QueryRow(ctx, "SELECT token FROM enrollment_links WHERE academy_id=$1", a).Scan(&old)
		if e == nil {
			token = old
		} else if !errors.Is(e, pgx.ErrNoRows) {
			return in, e
		}
	}
	_, e = tx.Exec(ctx, `INSERT INTO enrollment_links(academy_id,token,enabled,due_day,modality_ids,plan_ids,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7)
 ON CONFLICT(academy_id) DO UPDATE SET token=EXCLUDED.token,enabled=EXCLUDED.enabled,due_day=EXCLUDED.due_day,modality_ids=EXCLUDED.modality_ids,plan_ids=EXCLUDED.plan_ids,updated_by=EXCLUDED.updated_by,updated_at=now()`, a, token, in.Enabled, in.DueDay, in.Modalities, in.Plans, core.P(ctx).UserID)
	if e != nil {
		return in, e
	}
	if e = tx.Commit(ctx); e != nil {
		return in, e
	}
	return r.EnrollmentLink(ctx, a)
}
func validLinkToken(t string) bool {
	if len(t) != 64 {
		return false
	}
	for _, c := range t {
		if !(c >= '0' && c <= '9' || c >= 'a' && c <= 'f') {
			return false
		}
	}
	return true
}
func (r Repository) previewTx(ctx context.Context, tx pgx.Tx, token string) (EnrollmentPreview, EnrollmentLink, error) {
	v := EnrollmentPreview{Modalities: []Catalog{}, Plans: []Catalog{}}
	cfg := EnrollmentLink{}
	if !validLinkToken(token) {
		return v, cfg, core.E(404, "invalid_link", "Link indisponível. Peça o link atual à academia.")
	}
	// Academy -> link is the lock order shared by enrollment, approvals and settings.
	e := tx.QueryRow(ctx, "SELECT a.id,a.name,a.timezone FROM academies a JOIN enrollment_links l ON l.academy_id=a.id WHERE l.token=$1 FOR UPDATE OF a", token).Scan(&v.AcademyID, &v.AcademyName, &v.Timezone)
	if errors.Is(e, pgx.ErrNoRows) {
		return v, cfg, core.E(404, "invalid_link", "Link indisponível. Peça o link atual à academia.")
	}
	if e != nil {
		return v, cfg, e
	}
	e = tx.QueryRow(ctx, "SELECT enabled,due_day,modality_ids,plan_ids FROM enrollment_links WHERE academy_id=$1 AND token=$2 FOR SHARE", v.AcademyID, token).Scan(&cfg.Enabled, &cfg.DueDay, &cfg.Modalities, &cfg.Plans)
	if errors.Is(e, pgx.ErrNoRows) || e == nil && !cfg.Enabled {
		return v, cfg, core.E(410, "link_disabled", "Matrículas por este link estão suspensas.")
	}
	if e != nil {
		return v, cfg, e
	}
	v.AvailableModalities = cfg.Modalities
	v.DueDay = cfg.DueDay
	loc, e := time.LoadLocation(v.Timezone)
	if e != nil {
		return v, cfg, e
	}
	v.FirstDue = nextEnrollmentDue(time.Now().In(loc), v.DueDay).Format("2006-01-02")
	rows, e := tx.Query(ctx, `SELECT id,name,active,amount_cents FROM plans p WHERE academy_id=$1 AND id=ANY($2::uuid[]) AND active AND amount_cents>0 AND EXISTS(SELECT 1 FROM plan_modalities pm WHERE pm.academy_id=p.academy_id AND pm.plan_id=p.id) AND NOT EXISTS(SELECT 1 FROM plan_modalities pm JOIN modalities m ON m.academy_id=pm.academy_id AND m.id=pm.modality_id WHERE pm.academy_id=p.academy_id AND pm.plan_id=p.id AND NOT m.active) ORDER BY name,id FOR SHARE`, v.AcademyID, cfg.Plans)
	if e != nil {
		return v, cfg, e
	}
	for rows.Next() {
		var c Catalog
		if e = rows.Scan(&c.ID, &c.Name, &c.Active, &c.AmountCents); e != nil {
			rows.Close()
			return v, cfg, e
		}
		v.Plans = append(v.Plans, c)
	}
	e = rows.Err()
	rows.Close()
	if e != nil {
		return v, cfg, e
	}
	all := append([]string{}, cfg.Modalities...)
	for i := range v.Plans {
		p := &v.Plans[i]
		p.Modalities = []string{}
		rows, e = tx.Query(ctx, "SELECT modality_id FROM plan_modalities WHERE academy_id=$1 AND plan_id=$2 ORDER BY modality_id", v.AcademyID, p.ID)
		if e != nil {
			return v, cfg, e
		}
		for rows.Next() {
			var id string
			if e = rows.Scan(&id); e != nil {
				rows.Close()
				return v, cfg, e
			}
			p.Modalities = append(p.Modalities, id)
			if !slices.Contains(all, id) {
				all = append(all, id)
			}
		}
		e = rows.Err()
		rows.Close()
		if e != nil {
			return v, cfg, e
		}
	}
	rows, e = tx.Query(ctx, "SELECT id,name,active,amount_cents,belt_options FROM modalities WHERE academy_id=$1 AND id=ANY($2::uuid[]) AND active ORDER BY name,id FOR SHARE", v.AcademyID, all)
	if e != nil {
		return v, cfg, e
	}
	for rows.Next() {
		var c Catalog
		var raw []byte
		if e = rows.Scan(&c.ID, &c.Name, &c.Active, &c.AmountCents, &raw); e != nil {
			rows.Close()
			return v, cfg, e
		}
		if e = json.Unmarshal(raw, &c.BeltOptions); e != nil {
			rows.Close()
			return v, cfg, e
		}
		v.Modalities = append(v.Modalities, c)
	}
	e = rows.Err()
	rows.Close()
	return v, cfg, e
}
func (r Repository) EnrollmentPreview(ctx context.Context, t string, day int) (EnrollmentPreview, error) {
	tx, e := r.DB.Begin(ctx)
	if e != nil {
		return EnrollmentPreview{}, e
	}
	defer tx.Rollback(ctx)
	v, _, e := r.previewTx(ctx, tx, t)
	if e == nil && day != 0 {
		if day < 1 || day > 31 {
			return v, core.E(422, "invalid_due_day", "Escolha um dia de vencimento entre 1 e 31.")
		}
		loc, err := time.LoadLocation(v.Timezone)
		if err != nil {
			return v, err
		}
		v.DueDay = day
		v.FirstDue = nextEnrollmentDue(time.Now().In(loc), day).Format("2006-01-02")
	}
	return v, e
}

func requireEnrollmentManager(ctx context.Context, tx pgx.Tx, a string) error {
	var id string
	e := tx.QueryRow(ctx, "SELECT m.id FROM memberships m JOIN membership_roles r ON r.membership_id=m.id WHERE m.academy_id=$1 AND m.user_id=$2 AND m.status='active' AND r.role='admin' FOR SHARE OF m,r", a, core.P(ctx).UserID).Scan(&id)
	if errors.Is(e, pgx.ErrNoRows) {
		return core.E(403, "forbidden", "Somente gestores ativos podem alterar matrículas e acessos.")
	}
	return e
}
