package httpapi_test

import (
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5/pgxpool"
	"strings"
	"tatame/backend/internal/auth"
	"tatame/backend/internal/core"
	"tatame/backend/internal/students"
	"testing"
)

// Existing historical enrollments remain valid. Seed these explicitly without
// exercising the newly restricted administrative create endpoint.
func legacyStudent(t *testing.T, db *pgxpool.Pool, actor client, academy string, body map[string]any) map[string]any {
	t.Helper()
	raw, e := json.Marshal(body)
	if e != nil {
		t.Fatal(e)
	}
	var in students.Input
	if e = json.Unmarshal(raw, &in); e != nil {
		t.Fatal(e)
	}
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	in.ReuseIdentity = true
	if in.Status == "" {
		in.Status = "active"
	}
	if in.ChargeMode == "" {
		in.ChargeMode = "custom"
	}
	if in.Belt == "" {
		in.Belt = "Faixa Branca"
	}
	if in.CPF != nil {
		value, ok := core.NormalizeCPF(*in.CPF)
		if !ok {
			t.Fatal("invalid fixture CPF")
		}
		in.CPF = &value
	}
	if len(in.Modalities) == 0 {
		for _, d := range in.ModalityDetails {
			in.Modalities = append(in.Modalities, d.ModalityID)
		}
	}
	principal, e := (auth.Repository{DB: db}).Principal(context.Background(), actor.token)
	if e != nil {
		t.Fatal(e)
	}
	student, e := (students.Repository{DB: db}).Save(core.WithPrincipal(context.Background(), principal), academy, "", in)
	if e != nil {
		t.Fatal(e)
	}
	raw, e = json.Marshal(student)
	if e != nil {
		t.Fatal(e)
	}
	var out map[string]any
	if e = json.Unmarshal(raw, &out); e != nil {
		t.Fatal(e)
	}
	return out
}
