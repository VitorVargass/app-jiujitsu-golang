package attendance

import (
	"net/http"
	"tatame/backend/internal/core"
	"time"
)

func validLessonDate(value string) bool {
	date, err := time.Parse("2006-01-02", value)
	return err == nil && date.Year() >= 2020 && date.Year() <= 2100
}
func (h Handler) Options(w http.ResponseWriter, r *http.Request) {
	a := r.PathValue("academy")
	p := core.P(r.Context())
	tablet := p.DeviceID != ""
	if tablet {
		if p.AcademyID != a {
			core.Fail(w, core.E(403, "forbidden", "Dispositivo de outra academia."))
			return
		}
	} else if _, err := h.Service.Access.Require(r.Context(), a, "admin"); err != nil {
		core.Fail(w, err)
		return
	}
	date := r.URL.Query().Get("date")
	if date != "" && !validLessonDate(date) {
		core.Fail(w, core.E(422, "invalid_date", "Data inválida."))
		return
	}
	value, err := h.Service.Repo.Options(r.Context(), a, date, tablet, time.Now())
	if err != nil {
		core.Fail(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	core.Write(w, 200, value)
}
func (h Handler) ScheduledCheckIn(w http.ResponseWriter, r *http.Request) {
	a, key := r.PathValue("academy"), r.Header.Get("Idempotency-Key")
	p := core.P(r.Context())
	if p.DeviceID == "" || p.AcademyID != a {
		core.Fail(w, core.E(403, "device_required", "Use um tablet autorizado desta academia."))
		return
	}
	var in ScheduledInput
	if err := core.Decode(w, r, &in); err != nil {
		core.Fail(w, err)
		return
	}
	if !core.ValidID(key) {
		core.Fail(w, core.E(422, "invalid_idempotency_key", "Envie um Idempotency-Key UUID."))
		return
	}
	if in.ScheduleID != "" && !core.ValidID(in.ScheduleID) || in.Date != "" && !validLessonDate(in.Date) {
		core.Fail(w, core.E(422, "invalid_schedule", "Confira a aula e o dia."))
		return
	}
	if in.MembershipID != "" || in.StudentID != "" {
		core.Fail(w, core.E(403, "forbidden", "Informe somente o número do aluno ou QR Code."))
		return
	}
	if err := normalizeIdentifier(&in.Input); err != nil {
		core.Fail(w, err)
		return
	}
	value, err := h.Service.Repo.record(r.Context(), a, "", key, in.Input, &in, false)
	if err != nil {
		core.Fail(w, err)
		return
	}
	core.Write(w, 200, value)
}
func (h Handler) Manual(w http.ResponseWriter, r *http.Request) {
	a, key := r.PathValue("academy"), r.Header.Get("Idempotency-Key")
	if _, err := h.Service.Access.Require(r.Context(), a, "admin"); err != nil {
		core.Fail(w, err)
		return
	}
	var in ManualInput
	if err := core.Decode(w, r, &in); err != nil {
		core.Fail(w, err)
		return
	}
	if !core.ValidID(key) {
		core.Fail(w, core.E(422, "invalid_idempotency_key", "Envie um Idempotency-Key UUID."))
		return
	}
	if !core.ValidID(in.StudentID) || !core.ValidID(in.ScheduleID) || !validLessonDate(in.Date) {
		core.Fail(w, core.E(422, "invalid_attendance", "Escolha aluno, data e aula."))
		return
	}
	plan := ScheduledInput{Input: Input{StudentID: in.StudentID}, ScheduleID: in.ScheduleID, Date: in.Date}
	value, err := h.Service.Repo.record(r.Context(), a, "", key, plan.Input, &plan, true)
	if err != nil {
		core.Fail(w, err)
		return
	}
	core.Write(w, 200, value)
}
