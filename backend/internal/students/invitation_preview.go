package students

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"tatame/backend/internal/core"
)

type AcceptInvitationInput struct {
	CPF *string `json:"cpf"`
}

type InvitationPreview struct {
	AcademyID     string    `json:"academy_id"`
	AcademyName   string    `json:"academy_name"`
	StudentName   string    `json:"student_name"`
	CPFRegistered bool      `json:"cpf_registered"`
	ExpiresAt     time.Time `json:"expires_at"`
}

// Only the invited identity can see enrollment details. The URL never selects
// an academy or student supplied by the browser; the stored token does.
func (r Repository) PreviewInvitation(ctx context.Context, token, userID string) (InvitationPreview, error) {
	var out InvitationPreview
	var person, actor string
	var archived bool
	err := r.DB.QueryRow(ctx, `SELECT i.academy_id,a.name,s.name,p.cpf<>'',i.expires_at,s.person_id,u.person_id,s.archived_at IS NOT NULL
 FROM student_invitations i
 JOIN academies a ON a.id=i.academy_id
 JOIN students s ON s.academy_id=i.academy_id AND s.id=i.student_id
 JOIN academy_participants p ON p.academy_id=s.academy_id AND p.id=s.participant_id
 JOIN users u ON u.id=$2
 WHERE i.token_hash=$1 AND i.expires_at>clock_timestamp() AND i.revoked_at IS NULL AND i.accepted_at IS NULL`,
		core.Hash(token), userID).Scan(&out.AcademyID, &out.AcademyName, &out.StudentName, &out.CPFRegistered, &out.ExpiresAt, &person, &actor, &archived)
	if errors.Is(err, pgx.ErrNoRows) {
		return out, core.E(410, "invalid_invitation", "Convite inválido, expirado ou já utilizado. Peça um novo link à academia.")
	}
	if err != nil {
		return out, err
	}
	if person != actor {
		return InvitationPreview{}, core.E(403, "invitation_identity_mismatch", "Entre com a conta do e-mail indicado neste convite.")
	}
	if archived {
		return InvitationPreview{}, core.E(410, "student_archived", "Este cadastro está arquivado. Peça ao gestor para restaurá-lo.")
	}
	return out, nil
}

func (h Handler) PreviewInvitation(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Referrer-Policy", "no-referrer")
	u, token := core.P(r.Context()).UserID, r.PathValue("token")
	if u == "" {
		core.Fail(w, core.E(403, "forbidden", "Entre com uma conta pessoal."))
		return
	}
	if len(token) != 64 {
		core.Fail(w, core.E(410, "invalid_invitation", "Convite inválido."))
		return
	}
	out, err := h.Service.Repo.PreviewInvitation(r.Context(), token, u)
	if err != nil {
		core.Fail(w, err)
		return
	}
	core.Write(w, 200, out)
}
