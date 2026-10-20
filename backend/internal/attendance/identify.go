package attendance

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"strings"
	"tatame/backend/internal/core"
	"tatame/backend/internal/participation"
)

func identify(ctx context.Context, tx pgx.Tx, a string, in Input, modality string) (string, string, string, string, error) {
	var part, student string
	args := []any{a, strings.TrimPrefix(in.QRToken, "tatame:"), in.StudentCode, in.CPF, in.StudentID}
	const match = `(($2::text<>'' AND p.qr_token=$2) OR ($3::text<>'' AND p.student_code=$3) OR ($4::text<>'' AND p.cpf=$4) OR ($5::text<>'' AND EXISTS(SELECT 1 FROM students target WHERE target.academy_id=p.academy_id AND target.participant_id=p.id AND target.id::text=$5)))`
	err := tx.QueryRow(ctx, `SELECT p.id,COALESCE(s.id::text,'') FROM academy_participants p LEFT JOIN students s ON s.academy_id=p.academy_id AND s.participant_id=p.id
 WHERE p.academy_id=$1 AND `+match, args...).Scan(&part, &student)
	notFound := func() (string, string, string, string, error) {
		return "", "", "", "", core.E(404, "student_not_found", "Pessoa não encontrada nesta academia.")
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return notFound()
	}
	if err != nil {
		return "", "", "", "", err
	}
	archived := false
	// Match student edits/archive: lock enrollment before its participation.
	if student != "" {
		if err = tx.QueryRow(ctx, "SELECT archived_at IS NOT NULL FROM students WHERE academy_id=$1 AND id=$2 FOR SHARE", a, student).Scan(&archived); err != nil {
			return "", "", "", "", err
		}
	}
	var locked string
	if err = tx.QueryRow(ctx, "SELECT p.id FROM academy_participants p WHERE p.academy_id=$1 AND "+match+" AND p.id=$6 FOR SHARE", append(args, part)...).Scan(&locked); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return notFound()
		}
		return "", "", "", "", err
	}
	var name, belt string
	var eligible bool
	err = tx.QueryRow(ctx, `SELECT COALESCE(s.name,u.name,'Participante'),
 COALESCE((SELECT student_rank_label(sm.belt,sm.degrees) FROM student_modalities sm WHERE sm.academy_id=s.academy_id AND sm.student_id=s.id AND sm.modality_id::text=$3),s.belt,'Sem graduação'),
 `+participation.EligibleSQL+`
 FROM academy_participants p LEFT JOIN students s ON s.academy_id=p.academy_id AND s.participant_id=p.id LEFT JOIN users u ON u.person_id=p.person_id
 WHERE p.academy_id=$1 AND p.id=$2`, a, part, modality).Scan(&name, &belt, &eligible)
	if err != nil {
		return "", "", "", "", err
	}
	if !eligible {
		if archived {
			return "", "", "", "", core.E(410, "student_archived", "Cadastro arquivado. Peça ao gestor para restaurar o aluno antes de registrar presença.")
		}
		return "", "", "", "", core.E(403, "student_blocked", "A participação desta pessoa está bloqueada nesta academia.")
	}
	return part, student, name, belt, nil
}
