package auth

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
	"net/http"
	"tatame/backend/internal/core"
	"time"
)

type FirstAccessInput struct {
	// Accepted for compatibility with older clients. The authenticated session proves the first login.
	CurrentPassword      string `json:"current_password"`
	Password             string `json:"password"`
	PasswordConfirmation string `json:"password_confirmation"`
	TermsVersion         string `json:"terms_version"`
	PrivacyVersion       string `json:"privacy_version"`
}

func (h Handler) FirstAccess(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	var in FirstAccessInput
	if err := core.Decode(w, r, &in); err != nil {
		core.Fail(w, err)
		return
	}
	value, err := h.Service.CompleteFirstAccess(r.Context(), core.P(r.Context()).UserID, in)
	if err != nil {
		core.Fail(w, err)
		return
	}
	core.Write(w, http.StatusOK, value)
}

func (s Service) CompleteFirstAccess(ctx context.Context, userID string, in FirstAccessInput) (LoginResult, error) {
	if userID == "" {
		return LoginResult{}, core.E(403, "forbidden", "Entre com sua conta pessoal.")
	}
	if in.Password != in.PasswordConfirmation {
		return LoginResult{}, core.E(422, "password_mismatch", "As senhas precisam ser iguais.")
	}
	if len(in.Password) < 8 || len(in.Password) > 72 {
		return LoginResult{}, core.E(422, "invalid_password", "Escolha uma nova senha de 8 a 72 bytes.")
	}
	if in.TermsVersion != core.LegalVersion || in.PrivacyVersion != core.LegalVersion {
		return LoginResult{}, core.E(422, "legal_acceptance_required", "Leia e aceite os Termos de Uso e confirme a leitura do Aviso de Privacidade.")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), 12)
	if err != nil {
		return LoginResult{}, err
	}
	tx, err := s.Repo.DB.Begin(ctx)
	if err != nil {
		return LoginResult{}, err
	}
	defer tx.Rollback(ctx)
	var currentHash string
	var pending, unexpired bool
	err = tx.QueryRow(ctx, `SELECT password_hash,password_change_required,
 COALESCE(temporary_password_expires_at>clock_timestamp(),false) FROM users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`, userID).Scan(&currentHash, &pending, &unexpired)
	if errors.Is(err, pgx.ErrNoRows) {
		return LoginResult{}, core.E(401, "unauthorized", "Entre novamente.")
	}
	if err != nil {
		return LoginResult{}, err
	}
	if !pending {
		return LoginResult{}, core.E(409, "already_activated", "O primeiro acesso já foi concluído. Entre com sua senha pessoal.")
	}
	if !unexpired {
		return LoginResult{}, core.E(401, "temporary_password_expired", "A senha temporária expirou.")
	}
	if bcrypt.CompareHashAndPassword([]byte(currentHash), []byte(in.Password)) == nil {
		return LoginResult{}, core.E(422, "password_unchanged", "Escolha uma senha diferente da temporária.")
	}
	if _, err = tx.Exec(ctx, "UPDATE users SET password_hash=$2,password_change_required=false,temporary_password_expires_at=NULL WHERE id=$1", userID, string(hash)); err != nil {
		return LoginResult{}, err
	}
	if _, err = tx.Exec(ctx, "INSERT INTO account_legal_acceptances(user_id,terms_version,privacy_version) VALUES($1,$2,$3)", userID, in.TermsVersion, in.PrivacyVersion); err != nil {
		return LoginResult{}, err
	}
	if _, err = tx.Exec(ctx, "DELETE FROM auth_sessions WHERE user_id=$1", userID); err != nil {
		return LoginResult{}, err
	}
	token := core.Token()
	if _, err = tx.Exec(ctx, "INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)", core.Hash(token), userID, time.Now().Add(30*24*time.Hour)); err != nil {
		return LoginResult{}, err
	}
	var user User
	err = tx.QueryRow(ctx, "SELECT u.id,u.name,p.email,u.person_id FROM users u JOIN people p ON p.id=u.person_id WHERE u.id=$1", userID).Scan(&user.ID, &user.Name, &user.Email, &user.PersonID)
	if err != nil {
		return LoginResult{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return LoginResult{}, err
	}
	return LoginResult{Token: token, User: user}, nil
}
