-- +goose Up
-- Existing birth dates are unknown: never infer age from payer or CPF.
ALTER TABLE students ADD COLUMN birth_date date;
ALTER TABLE students ADD CONSTRAINT students_birth_date_range CHECK (birth_date IS NULL OR birth_date >= DATE '1900-01-01');

-- Student profile history is filtered by academy and student, then ordered by check-in.
CREATE INDEX attendances_student_history ON attendances(academy_id,membership_id,checked_in_at DESC,id);

-- +goose Down
-- +goose StatementBegin
DO $$ BEGIN RAISE EXCEPTION 'Restore a backup to preserve saved student birth dates'; END $$;
-- +goose StatementEnd
