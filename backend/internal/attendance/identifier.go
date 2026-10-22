package attendance

import "tatame/backend/internal/core"

// CPF remains accepted by earlier clients; the current tablet uses five digits or QR.
func normalizeIdentifier(in *Input) error {
	identifiers := 0
	for _, value := range []string{in.QRToken, in.StudentCode, in.CPF} {
		if value != "" {
			identifiers++
		}
	}
	if identifiers != 1 || len(in.QRToken) > 100 {
		return core.E(422, "invalid_identifier", "Informe o número de 5 dígitos do aluno ou o QR Code.")
	}
	if in.StudentCode != "" && !core.ValidStudentCode(in.StudentCode) {
		return core.E(422, "invalid_student_code", "O número do aluno deve ter exatamente 5 dígitos.")
	}
	if in.CPF != "" {
		cpf, valid := core.NormalizeCPF(in.CPF)
		if !valid || cpf == "" {
			return core.E(422, "invalid_cpf", "Informe um CPF válido.")
		}
		in.CPF = cpf
	}
	return nil
}
