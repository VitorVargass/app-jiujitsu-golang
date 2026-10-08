// Package core defines HTTP-neutral errors and authenticated principals.
package core

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5/pgconn"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
)

type Error struct {
	Status  int
	Code    string
	Message string
}

func (e *Error) Error() string                 { return e.Message }
func E(status int, code, message string) error { return &Error{status, code, message} }
func Write(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if value != nil {
		_ = json.NewEncoder(w).Encode(value)
	}
}
func Fail(w http.ResponseWriter, err error) {
	var e *Error
	if !errors.As(err, &e) {
		var pe *pgconn.PgError
		if errors.As(err, &pe) && pe.Code == "23505" {
			e = &Error{409, "already_exists", "Este registro já existe."}
		} else if errors.As(err, &pe) && (pe.Code == "23503" || pe.Code == "22P02") {
			e = &Error{422, "invalid_reference", "Verifique os dados e os vínculos da academia."}
		} else {
			slog.Error("operation failed", "error", err)
			e = &Error{500, "internal_error", "Não foi possível concluir a operação."}
		}
	}
	Write(w, e.Status, map[string]any{"error": map[string]string{"code": e.Code, "message": e.Message}})
}
func Decode(w http.ResponseWriter, r *http.Request, v any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 65536)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(v); err != nil {
		return E(400, "invalid_json", "Dados inválidos.")
	}
	var extra any
	if err := d.Decode(&extra); !errors.Is(err, io.EOF) {
		return E(400, "invalid_json", "Envie um único objeto JSON.")
	}
	return nil
}
func ID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	h := hex.EncodeToString(b)
	return h[:8] + "-" + h[8:12] + "-" + h[12:16] + "-" + h[16:20] + "-" + h[20:]
}
func Token() string {
	b := make([]byte, 32)
	if _, e := rand.Read(b); e != nil {
		panic(e)
	}
	return hex.EncodeToString(b)
}
func Hash(s string) string { h := sha256.Sum256([]byte(s)); return hex.EncodeToString(h[:]) }
func Digits() string {
	b := make([]byte, 8)
	if _, e := rand.Read(b); e != nil {
		panic(e)
	}
	var s strings.Builder
	for _, v := range b {
		fmt.Fprintf(&s, "%d", v%10)
	}
	return s.String()
}

var uuidPattern = regexp.MustCompile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")

func ValidID(s string) bool { return uuidPattern.MatchString(s) }

type Principal struct {
	UserID    string
	DeviceID  string
	AcademyID string
}
type contextKey struct{}

func WithPrincipal(ctx context.Context, p Principal) context.Context {
	return context.WithValue(ctx, contextKey{}, p)
}
func P(ctx context.Context) Principal { p, _ := ctx.Value(contextKey{}).(Principal); return p }
