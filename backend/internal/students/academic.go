package students

import (
	"net/http"
	"tatame/backend/internal/core"
	"time"
)

// Academic responses use an allowlist, never the enrollment/financial contract.
type AcademicRank struct {
	ModalityID string `json:"modality_id"`
	Belt       string `json:"belt"`
	Degrees    int    `json:"degrees"`
}
type AcademicStudent struct {
	ID             string         `json:"id"`
	Name           string         `json:"name"`
	Email          string         `json:"email"`
	Phone          string         `json:"phone"`
	AlternatePhone string         `json:"alternate_phone"`
	BirthDate      string         `json:"birth_date"`
	StartedOn      string         `json:"started_on"`
	Status         string         `json:"status"`
	ArchivedAt     *time.Time     `json:"archived_at"`
	StudentCode    string         `json:"student_code"`
	Belt           string         `json:"belt"`
	Modalities     []string       `json:"modality_ids"`
	Ranks          []AcademicRank `json:"modality_details"`
}
type AcademicModality struct {
	ID          string       `json:"id"`
	Name        string       `json:"name"`
	Active      bool         `json:"active"`
	BeltOptions []BeltOption `json:"belt_options"`
}

func academicStudent(v Student) AcademicStudent {
	out := AcademicStudent{ID: v.ID, Name: v.Name, Email: v.Email, Phone: v.Phone, AlternatePhone: v.AlternatePhone, BirthDate: v.BirthDate, StartedOn: v.StartedOn, Status: v.Status, ArchivedAt: v.ArchivedAt, StudentCode: v.StudentCode, Belt: v.Belt, Modalities: v.Modalities, Ranks: []AcademicRank{}}
	for _, rank := range v.ModalityDetails {
		out.Ranks = append(out.Ranks, AcademicRank{rank.ModalityID, rank.Belt, rank.Degrees})
	}
	return out
}
func (h Handler) AcademicList(w http.ResponseWriter, r *http.Request) {
	a := r.PathValue("academy")
	if _, err := h.Service.Access.Require(r.Context(), a, "admin", "teacher"); err != nil {
		core.Fail(w, err)
		return
	}
	page, size, err := core.Pagination(r)
	if err != nil {
		core.Fail(w, err)
		return
	}
	status, modality := r.URL.Query().Get("status"), r.URL.Query().Get("modality_id")
	if (status != "" && status != "active" && status != "inactive" && status != "archived") || (modality != "" && !core.ValidID(modality)) {
		core.Fail(w, core.E(422, "invalid_filter", "Filtro inválido."))
		return
	}
	v, err := h.Service.Repo.List(r.Context(), a, r.URL.Query().Get("search"), status, modality, page, size)
	if err != nil {
		core.Fail(w, err)
		return
	}
	out := core.Page[AcademicStudent]{Items: []AcademicStudent{}, Total: v.Total, Page: v.Page, PageSize: v.PageSize}
	for _, student := range v.Items {
		out.Items = append(out.Items, academicStudent(student))
	}
	core.Write(w, 200, out)
}
func (h Handler) AcademicGet(w http.ResponseWriter, r *http.Request) {
	a, id := r.PathValue("academy"), r.PathValue("student")
	if _, err := h.Service.Access.Require(r.Context(), a, "admin", "teacher"); err != nil {
		core.Fail(w, err)
		return
	}
	if !core.ValidID(id) {
		core.Fail(w, core.E(404, "not_found", "Aluno não encontrado."))
		return
	}
	v, err := h.Service.Repo.Get(r.Context(), a, id)
	if err != nil {
		core.Fail(w, err)
		return
	}
	core.Write(w, 200, academicStudent(v))
}
func (h Handler) AcademicModalities(w http.ResponseWriter, r *http.Request) {
	a := r.PathValue("academy")
	if _, err := h.Service.Access.Require(r.Context(), a, "admin", "teacher"); err != nil {
		core.Fail(w, err)
		return
	}
	v, err := h.Service.Repo.Catalog(r.Context(), a, false)
	if err != nil {
		core.Fail(w, err)
		return
	}
	out := []AcademicModality{}
	for _, m := range v {
		out = append(out, AcademicModality{m.ID, m.Name, m.Active, m.BeltOptions})
	}
	core.Write(w, 200, out)
}
