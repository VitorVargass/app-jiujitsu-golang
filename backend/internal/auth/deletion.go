package auth

import (
	"golang.org/x/crypto/bcrypt"
	"net/http"
	"tatame/backend/internal/core"
)

// RequestDeletion only accepts the authenticated person's password. Devices and
// supplied user IDs cannot request deletion on someone else's behalf.
func (h Handler) RequestDeletion(w http.ResponseWriter, r *http.Request) {
	uid := core.P(r.Context()).UserID
	if uid == "" {
		core.Fail(w, core.E(403, "personal_account_required", "Entre com sua conta pessoal."))
		return
	}
	var in struct {
		Password string `json:"password"`
		Confirm  bool   `json:"confirm"`
	}
	if e := core.Decode(w, r, &in); e != nil {
		core.Fail(w, e)
		return
	}
	if !in.Confirm || len(in.Password) == 0 || len(in.Password) > 72 {
		core.Fail(w, core.E(422, "confirmation_required", "Confirme as consequências e informe sua senha atual."))
		return
	}
	tx, e := h.Service.Repo.DB.Begin(r.Context())
	if e != nil {
		core.Fail(w, e)
		return
	}
	defer tx.Rollback(r.Context())
	var hash string
	e = tx.QueryRow(r.Context(), "SELECT password_hash FROM users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE", uid).Scan(&hash)
	if e != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(in.Password)) != nil {
		core.Fail(w, core.E(403, "invalid_password", "Senha atual incorreta."))
		return
	}
	var id, status string
	e = tx.QueryRow(r.Context(), `INSERT INTO account_deletion_requests(id,user_id) VALUES($1,$2)
 ON CONFLICT(user_id) DO UPDATE SET user_id=EXCLUDED.user_id RETURNING id,status`, core.ID(), uid).Scan(&id, &status)
	if e == nil {
		e = tx.Commit(r.Context())
	}
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 202, map[string]string{"id": id, "status": status, "message": "Solicitação recebida. A exclusão será tratada pelo atendimento; sua conta ainda não foi excluída. Guarde o protocolo e consulte o canal de privacidade para acompanhar."})
}
