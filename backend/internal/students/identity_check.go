package students

import (
	"net/http"
	"net/mail"
	"strings"
	"tatame/backend/internal/core"
)

type IdentityCheckInput struct {
	StudentID      string `json:"student_id"`
	Email          string `json:"email"`
	CPF            string `json:"cpf"`
	Phone          string `json:"phone"`
	AlternatePhone string `json:"alternate_phone"`
}

// Administrative preflight only. It never grants access or reveals account data.
func (h Handler) CheckIdentity(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	a := r.PathValue("academy")
	if _, e := h.Service.Access.Require(r.Context(), a, "admin"); e != nil {
		core.Fail(w, e)
		return
	}
	var in IdentityCheckInput
	if e := core.Decode(w, r, &in); e != nil {
		core.Fail(w, e)
		return
	}
	if in.StudentID != "" {
		if !core.ValidID(in.StudentID) {
			core.Fail(w, core.E(422, "invalid_student", "Aluno inválido."))
			return
		}
		if _, e := h.Service.Repo.Get(r.Context(), a, in.StudentID); e != nil {
			core.Fail(w, e)
			return
		}
	}
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	if len(in.Email) > 254 || len(in.Phone) > 30 || len(in.AlternatePhone) > 30 {
		core.Fail(w, core.E(422, "invalid_identity", "Confira os dados informados."))
		return
	}
	if in.Email != "" {
		address, e := mail.ParseAddress(in.Email)
		if e != nil || address.Address != in.Email {
			core.Fail(w, core.E(422, "invalid_email", "Confira o e-mail."))
			return
		}
	}
	if in.CPF != "" {
		cpf, ok := core.NormalizeCPF(in.CPF)
		if !ok {
			core.Fail(w, core.E(422, "invalid_cpf", "Confira o CPF."))
			return
		}
		in.CPF = cpf
	}
	var email, cpf, phone, alternate bool
	e := h.Service.Repo.DB.QueryRow(r.Context(), `SELECT
 EXISTS(SELECT 1 FROM people p WHERE p.email=NULLIF($3,'') AND NOT EXISTS(SELECT 1 FROM students s WHERE s.academy_id=$1 AND s.id::text=$2 AND s.person_id=p.id)),
 EXISTS(SELECT 1 FROM academy_participants p WHERE p.cpf=NULLIF($4,'') AND NOT EXISTS(SELECT 1 FROM students s WHERE s.academy_id=$1 AND s.id::text=$2 AND s.person_id=p.person_id)),
 EXISTS(SELECT 1 FROM students s WHERE s.academy_id=$1 AND s.id::text<>$2 AND $5<>'' AND (right(regexp_replace(s.phone,'[^0-9]','','g'),11)=$5 OR right(regexp_replace(s.alternate_phone,'[^0-9]','','g'),11)=$5)),
 EXISTS(SELECT 1 FROM students s WHERE s.academy_id=$1 AND s.id::text<>$2 AND $6<>'' AND (right(regexp_replace(s.phone,'[^0-9]','','g'),11)=$6 OR right(regexp_replace(s.alternate_phone,'[^0-9]','','g'),11)=$6))`, a, in.StudentID, in.Email, in.CPF, contactDigits(in.Phone), contactDigits(in.AlternatePhone)).Scan(&email, &cpf, &phone, &alternate)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, map[string]bool{"email_exists": email, "cpf_exists": cpf, "phone_exists": phone, "alternate_phone_exists": alternate})
}
func contactDigits(value string) string {
	var b strings.Builder
	for _, c := range value {
		if c >= '0' && c <= '9' {
			b.WriteRune(c)
		}
	}
	s := b.String()
	if len(s) > 11 {
		s = s[len(s)-11:]
	}
	if len(s) < 10 {
		return ""
	}
	return s
}
