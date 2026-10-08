package attendance

import (
	"context"
	"tatame/backend/internal/access"
	"tatame/backend/internal/core"
)

type Service struct {
	Repo   Repository
	Access access.Service
}

func (s Service) CheckIn(ctx context.Context, a, session, key string, in Input) (Result, error) {
	p := core.P(ctx)
	if !core.ValidID(key) {
		return Result{}, core.E(422, "invalid_idempotency_key", "Envie um Idempotency-Key UUID.")
	}
	if !core.ValidID(session) || !core.ValidID(a) {
		return Result{}, core.E(404, "not_found", "Aula não encontrada.")
	}
	count := 0
	for _, v := range []string{in.QRToken, in.StudentCode, in.MembershipID} {
		if v != "" {
			count++
		}
	}
	if count != 1 || len(in.QRToken) > 100 || len(in.StudentCode) > 16 || (in.MembershipID != "" && !core.ValidID(in.MembershipID)) {
		return Result{}, core.E(422, "invalid_identifier", "Informe QR Code ou código do aluno.")
	}
	if p.DeviceID != "" && in.MembershipID != "" {
		return Result{}, core.E(403, "forbidden", "O tablet deve ler o QR ou o código do aluno.")
	}
	if p.DeviceID != "" {
		if p.AcademyID != a {
			return Result{}, core.E(403, "forbidden", "Dispositivo de outra academia.")
		}
	} else {
		var c string
		if e := s.Repo.SessionClass(ctx, a, session, &c); e != nil {
			return Result{}, core.E(404, "not_found", "Aula não encontrada.")
		}
		if _, e := s.Access.Class(ctx, a, c); e != nil {
			return Result{}, e
		}
	}
	return s.Repo.Record(ctx, a, session, key, in)
}
