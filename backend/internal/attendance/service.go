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
	if p.DeviceID == "" || p.AcademyID != a {
		return Result{}, core.E(403, "device_required", "A presença deve ser registrada em um tablet autorizado desta academia.")
	}
	if !core.ValidID(key) {
		return Result{}, core.E(422, "invalid_idempotency_key", "Envie um Idempotency-Key UUID.")
	}
	if !core.ValidID(a) || !core.ValidID(session) {
		return Result{}, core.E(404, "not_found", "Aula não encontrada.")
	}
	if in.MembershipID != "" {
		return Result{}, core.E(403, "forbidden", "O tablet deve ler o QR ou informar o CPF do aluno.")
	}
	identifiers := 0
	for _, value := range []string{in.QRToken, in.StudentCode, in.CPF} {
		if value != "" {
			identifiers++
		}
	}
	if identifiers != 1 || len(in.QRToken) > 100 || len(in.StudentCode) > 16 {
		return Result{}, core.E(422, "invalid_identifier", "Informe somente CPF ou QR Code do aluno.")
	}
	if in.CPF != "" {
		cpf, valid := core.NormalizeCPF(in.CPF)
		if !valid || cpf == "" {
			return Result{}, core.E(422, "invalid_cpf", "Informe um CPF válido.")
		}
		in.CPF = cpf
	}
	return s.Repo.Record(ctx, a, session, key, in)
}
