package attendance

import (
	"net/http"
	"tatame/backend/internal/core"
	"tatame/backend/internal/students"
	"time"
)

type Handler struct{ Service Service }

func (h Handler) CheckIn(w http.ResponseWriter, r *http.Request) {
	var in Input
	if e := core.Decode(w, r, &in); e != nil {
		core.Fail(w, e)
		return
	}
	v, e := h.Service.CheckIn(r.Context(), r.PathValue("academy"), r.PathValue("session"), r.Header.Get("Idempotency-Key"), in)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) List(w http.ResponseWriter, r *http.Request) {
	a, id := r.PathValue("academy"), r.PathValue("session")
	if !core.ValidID(id) {
		core.Fail(w, core.E(404, "not_found", "Aula não encontrada."))
		return
	}
	var c string
	if e := h.Service.Repo.SessionClass(r.Context(), a, id, &c); e != nil {
		core.Fail(w, e)
		return
	}
	if _, e := h.Service.Access.Class(r.Context(), a, c); e != nil {
		core.Fail(w, e)
		return
	}
	h.history(w, r, id, "")
}
func (h Handler) All(w http.ResponseWriter, r *http.Request) {
	if _, e := h.Service.Access.Require(r.Context(), r.PathValue("academy"), "admin"); e != nil {
		core.Fail(w, e)
		return
	}
	sid := r.URL.Query().Get("student_id")
	if sid != "" && !core.ValidID(sid) {
		core.Fail(w, core.E(422, "invalid_student", "Aluno inválido."))
		return
	}
	h.history(w, r, "", sid)
}
func (h Handler) Own(w http.ResponseWriter, r *http.Request) {
	u := core.P(r.Context()).UserID
	if u == "" {
		core.Fail(w, core.E(403, "forbidden", "Conta pessoal necessária."))
		return
	}
	id, e := (students.Repository{DB: h.Service.Repo.DB}).OwnID(r.Context(), r.PathValue("academy"), u)
	if e != nil {
		core.Fail(w, e)
		return
	}
	h.history(w, r, "", id)
}
func (h Handler) history(w http.ResponseWriter, r *http.Request, session, student string) {
	a := r.PathValue("academy")
	month := r.URL.Query().Get("month")
	cid := r.URL.Query().Get("class_id")
	if month != "" {
		if _, e := time.Parse("2006-01", month); e != nil {
			core.Fail(w, e)
			return
		}
	}
	if cid != "" && !core.ValidID(cid) {
		core.Fail(w, core.E(422, "invalid_class", "Turma inválida."))
		return
	}
	page, size, e := core.Pagination(r)
	if e != nil {
		core.Fail(w, e)
		return
	}
	v, e := h.Service.Repo.PagedHistory(r.Context(), a, session, student, month, cid, page, size)
	if e != nil {
		core.Fail(w, e)
		return
	}
	if r.URL.Query().Get("page") == "" && session != "" {
		core.Write(w, 200, v.Items)
		return
	}
	if r.URL.Query().Get("page") == "" && month == "" && cid == "" && student != "" {
		old, e := h.Service.Repo.History(r.Context(), a, session, student)
		if e != nil {
			core.Fail(w, e)
			return
		}
		core.Write(w, 200, old)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) Credential(w http.ResponseWriter, r *http.Request) {
	a := r.PathValue("academy")
	u := core.P(r.Context()).UserID
	if u == "" {
		core.Fail(w, core.E(403, "forbidden", "Conta pessoal necessária."))
		return
	}
	repo := students.Repository{DB: h.Service.Repo.DB}
	id, e := repo.OwnID(r.Context(), a, u)
	if e != nil {
		core.Fail(w, e)
		return
	}
	st, e := repo.Get(r.Context(), a, id)
	if e != nil {
		core.Fail(w, e)
		return
	}
	code, qr, e := h.Service.Repo.Credential(r.Context(), a, id)
	if e != nil {
		core.Fail(w, e)
		return
	}
	rank := st.Belt
	for _, detail := range st.ModalityDetails {
		if detail.Belt == st.Belt {
			rank = students.RankLabel(detail.Belt, detail.Degrees)
			break
		}
	}
	core.Write(w, 200, map[string]any{"cpf": st.CPF, "archived_at": st.ArchivedAt, "student_code": code, "qr_token": "tatame:" + qr, "student_name": st.Name, "belt": rank, "status": st.Status, "modality_details": st.ModalityDetails})
}
