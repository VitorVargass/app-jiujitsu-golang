package attendance

import (
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct{ DB *pgxpool.Pool }

func (r Repository) History(ctx context.Context, a, session, student string) ([]History, error) {
	page, err := r.PagedHistory(ctx, a, session, student, "", "", "", 1, 200)
	return page.Items, err
}
func (r Repository) SessionClass(ctx context.Context, a, session string, class *string) error {
	return r.DB.QueryRow(ctx, "SELECT class_id FROM class_sessions WHERE academy_id=$1 AND id=$2", a, session).Scan(class)
}

// Record preserves the legacy explicit-session contract.
func (r Repository) Record(ctx context.Context, a, session, key string, in Input) (Result, error) {
	return r.record(ctx, a, session, key, in, nil, false)
}
func (r Repository) Credential(ctx context.Context, a, id string) (string, string, error) {
	var code, qr string
	err := r.DB.QueryRow(ctx, "SELECT p.student_code,p.qr_token FROM students s JOIN academy_participants p ON p.academy_id=s.academy_id AND p.id=s.participant_id WHERE s.academy_id=$1 AND s.id=$2", a, id).Scan(&code, &qr)
	return code, qr, err
}
