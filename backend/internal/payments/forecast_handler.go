package payments

import (
	"net/http"
	"strings"
	"tatame/backend/internal/billing"
	"tatame/backend/internal/core"
	"time"
)

func (h Handler) Forecast(w http.ResponseWriter, r *http.Request) {
	academyID := r.PathValue("academy")
	studentID := r.PathValue("student")
	if strings.Contains(r.URL.Path, "/me/billing-forecast") {
		var err error
		studentID, err = h.Manager.Access.Student(r.Context(), academyID, r.URL.Query().Get("student_id"))
		if err != nil {
			core.Fail(w, err)
			return
		}
	} else {
		if _, err := h.Manager.Access.Require(r.Context(), academyID, "admin"); err != nil {
			core.Fail(w, err)
			return
		}
		if !core.ValidID(studentID) {
			core.Fail(w, core.E(404, "not_found", "Aluno não encontrado."))
			return
		}
	}
	values, err := (billing.Repository{DB: h.Manager.Repo.DB}).Forecast(r.Context(), academyID, studentID, time.Now())
	if err != nil {
		core.Fail(w, err)
		return
	}
	core.Write(w, http.StatusOK, values)
}
