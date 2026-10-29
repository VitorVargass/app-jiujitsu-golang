package students

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"net/http"
	"strconv"
	"tatame/backend/internal/core"
	"time"
)

func (h Handler) SharedLink(w http.ResponseWriter, r *http.Request) {
	a := r.PathValue("academy")
	if _, e := h.Service.Access.Require(r.Context(), a, "admin"); e != nil {
		core.Fail(w, e)
		return
	}
	var v EnrollmentLink
	var e error
	if r.Method == "GET" {
		v, e = h.Service.Repo.EnrollmentLink(r.Context(), a)
	} else {
		if e = core.Decode(w, r, &v); e == nil {
			v, e = h.Service.Repo.SaveEnrollmentLink(r.Context(), a, v)
		}
	}
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) PublicPreview(w http.ResponseWriter, r *http.Request) {
	day := 0
	if r.URL.Query().Has("due_day") {
		var err error
		day, err = strconv.Atoi(r.URL.Query().Get("due_day"))
		if err != nil || day < 1 || day > 31 {
			core.Fail(w, core.E(422, "invalid_due_day", "Escolha um dia de vencimento entre 1 e 31."))
			return
		}
	}
	v, e := h.Service.Repo.EnrollmentPreview(r.Context(), r.PathValue("token"), day)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) PublicEnroll(w http.ResponseWriter, r *http.Request) {
	var in PublicEnrollment
	if e := core.Decode(w, r, &in); e != nil {
		core.Fail(w, e)
		return
	}
	v, e := h.Service.Repo.Enroll(r.Context(), r.PathValue("token"), r.Header.Get("Idempotency-Key"), in)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) Family(w http.ResponseWriter, r *http.Request) {
	v, e := h.Service.Access.Students(r.Context(), r.PathValue("academy"))
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) EnrollmentRequests(w http.ResponseWriter, r *http.Request) {
	a := r.PathValue("academy")
	u := core.P(r.Context()).UserID
	if u == "" {
		core.Fail(w, core.E(403, "forbidden", "Conta pessoal necessária."))
		return
	}
	admin := a != ""
	if admin {
		if _, e := h.Service.Access.Require(r.Context(), a, "admin"); e != nil {
			core.Fail(w, e)
			return
		}
	}
	page, size, e := core.Pagination(r)
	if e != nil {
		core.Fail(w, e)
		return
	}
	ctx := r.Context()
	out := core.Page[json.RawMessage]{Items: []json.RawMessage{}, Page: page, PageSize: size}
	filter := "e.user_id=$1::uuid"
	arg := u
	fields := `jsonb_build_object('id',e.id,'status',e.status,'academy_id',e.academy_id,'academy_name',a.name,'student_name',e.payload->>'name','created_at',e.created_at)`
	if admin {
		filter = "e.academy_id=$1::uuid AND e.status='pending'"
		arg = a
		fields = `jsonb_build_object('id',e.id,'status',e.status,'student_id',e.student_id,'student_name',s.name,'student_status',s.status,'archived_at',s.archived_at,'account_name',u.name,'account_email',p.email,'payload',e.payload,'is_minor',e.is_minor,'created_at',e.created_at)`
	}
	from := ` FROM enrollment_submissions e JOIN academies a ON a.id=e.academy_id JOIN users u ON u.id=e.user_id JOIN people p ON p.id=u.person_id LEFT JOIN students s ON s.academy_id=e.academy_id AND s.id=e.student_id WHERE ` + filter
	if e = h.Service.Repo.DB.QueryRow(ctx, "SELECT count(*)"+from, arg).Scan(&out.Total); e != nil {
		core.Fail(w, e)
		return
	}
	rows, e := h.Service.Repo.DB.Query(ctx, "SELECT "+fields+from+" ORDER BY e.created_at DESC,e.id LIMIT $2 OFFSET $3", arg, size, (page-1)*size)
	if e != nil {
		core.Fail(w, e)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var raw []byte
		if e = rows.Scan(&raw); e != nil {
			core.Fail(w, e)
			return
		}
		out.Items = append(out.Items, json.RawMessage(raw))
	}
	if e = rows.Err(); e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, out)
}
func (h Handler) DecideEnrollment(w http.ResponseWriter, r *http.Request) {
	a, id := r.PathValue("academy"), r.PathValue("request")
	if _, e := h.Service.Access.Require(r.Context(), a, "admin"); e != nil {
		core.Fail(w, e)
		return
	}
	if !core.ValidID(id) {
		core.Fail(w, core.E(404, "not_found", "Pedido não encontrado."))
		return
	}
	var in struct {
		Approve bool `json:"approve"`
	}
	if e := core.Decode(w, r, &in); e != nil {
		core.Fail(w, e)
		return
	}
	e := h.Service.Repo.decideEnrollment(r.Context(), a, id, in.Approve)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, map[string]bool{"ok": true})
}
func (r Repository) decideEnrollment(ctx context.Context, a, id string, approve bool) error {
	tx, e := r.DB.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	if _, e = tx.Exec(ctx, "SELECT id FROM academies WHERE id=$1 FOR UPDATE", a); e != nil {
		return e
	}
	if e = requireEnrollmentManager(ctx, tx, a); e != nil {
		return e
	}
	var status, u, sid string
	var minor bool
	var raw []byte
	e = tx.QueryRow(ctx, "SELECT status,user_id,student_id,is_minor,payload FROM enrollment_submissions WHERE academy_id=$1 AND id=$2 FOR UPDATE", a, id).Scan(&status, &u, &sid, &minor, &raw)
	if errors.Is(e, pgx.ErrNoRows) {
		return core.E(404, "not_found", "Pedido não encontrado.")
	}
	if e != nil {
		return e
	}
	if status != "pending" {
		return core.E(409, "already_decided", "Este pedido já foi analisado.")
	}
	next := "rejected"
	if approve {
		var in PublicEnrollment
		if e = json.Unmarshal(raw, &in); e != nil {
			return e
		}
		var birth, st, linked, zone string
		var archived *time.Time
		e = tx.QueryRow(ctx, "SELECT COALESCE(s.birth_date::text,''),s.status,COALESCE(s.user_id::text,''),s.archived_at,a.timezone FROM students s JOIN academies a ON a.id=s.academy_id WHERE s.academy_id=$1 AND s.id=$2 FOR UPDATE OF s", a, sid).Scan(&birth, &st, &linked, &archived, &zone)
		if e != nil {
			return e
		}
		if archived != nil || st != "active" {
			return core.E(409, "inactive_student", "Restaure ou reative o aluno antes de liberar o acesso.")
		}
		loc, err := time.LoadLocation(zone)
		if err != nil {
			return err
		}
		b, err := time.Parse("2006-01-02", birth)
		if err != nil || birth != in.BirthDate || (core.AgeOn(b, time.Now().In(loc)) < 18) != minor {
			return core.E(409, "identity_review", "Confira o nascimento do cadastro e do pedido antes de liberar o acesso.")
		}
		if !minor && linked != "" && linked != u {
			return core.E(409, "account_conflict", "O aluno já possui outra conta vinculada. Revise a identidade antes de liberar acesso.")
		}
		doc, bd := in.CPF, in.BirthDate
		if minor {
			doc, bd = in.GuardianCPF, in.GuardianBirthDate
		}
		if e = r.guardianProfile(ctx, tx, a, u, doc, bd); e != nil {
			return e
		}
		// Access grants never rewrite an existing identity, plan or billing.
		if e = r.linkGuardian(ctx, tx, a, sid, u, core.P(ctx).UserID); e != nil {
			return e
		}
		next = "approved"
	}
	_, e = tx.Exec(ctx, "UPDATE enrollment_submissions SET status=$3,decided_by=$4,decided_at=now() WHERE academy_id=$1 AND id=$2", a, id, next, core.P(ctx).UserID)
	if e != nil {
		return e
	}
	return tx.Commit(ctx)
}
func (h Handler) RevokeFamily(w http.ResponseWriter, r *http.Request) {
	a, sid, u := r.PathValue("academy"), r.PathValue("student"), r.PathValue("user")
	if _, e := h.Service.Access.Require(r.Context(), a, "admin"); e != nil {
		core.Fail(w, e)
		return
	}
	if !core.ValidID(sid) || !core.ValidID(u) {
		core.Fail(w, core.E(404, "not_found", "Vínculo não encontrado."))
		return
	}
	v, e := h.Service.Repo.DB.Exec(r.Context(), "UPDATE student_guardians SET active=false,approved_by=$4,updated_at=now() WHERE academy_id=$1 AND student_id=$2 AND user_id=$3", a, sid, u, core.P(r.Context()).UserID)
	if e != nil {
		core.Fail(w, e)
		return
	}
	if v.RowsAffected() == 0 {
		core.Fail(w, core.E(404, "not_found", "Vínculo não encontrado."))
		return
	}
	core.Write(w, 200, map[string]bool{"ok": true})
}

func (h Handler) PortalAccess(w http.ResponseWriter, r *http.Request) {
	a := r.PathValue("academy")
	if _, e := h.Service.Access.Require(r.Context(), a, "admin"); e != nil {
		core.Fail(w, e)
		return
	}
	page, size, e := core.Pagination(r)
	if e != nil {
		core.Fail(w, e)
		return
	}
	out := core.Page[json.RawMessage]{Items: []json.RawMessage{}, Page: page, PageSize: size}
	ctx := r.Context()
	if e = h.Service.Repo.DB.QueryRow(ctx, "SELECT count(*) FROM student_guardians WHERE academy_id=$1 AND active", a).Scan(&out.Total); e != nil {
		core.Fail(w, e)
		return
	}
	rows, e := h.Service.Repo.DB.Query(ctx, `SELECT jsonb_build_object('user_id',g.user_id,'student_id',g.student_id,'student_name',s.name,'account_name',u.name,'account_email',p.email) FROM student_guardians g JOIN students s ON s.academy_id=g.academy_id AND s.id=g.student_id JOIN users u ON u.id=g.user_id JOIN people p ON p.id=u.person_id WHERE g.academy_id=$1 AND g.active ORDER BY s.name,g.user_id LIMIT $2 OFFSET $3`, a, size, (page-1)*size)
	if e != nil {
		core.Fail(w, e)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var raw []byte
		if e = rows.Scan(&raw); e != nil {
			core.Fail(w, e)
			return
		}
		out.Items = append(out.Items, json.RawMessage(raw))
	}
	if e = rows.Err(); e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, out)
}
