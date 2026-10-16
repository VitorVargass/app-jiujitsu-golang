-- +goose Up
ALTER TABLE students ADD COLUMN cpf text NOT NULL DEFAULT ''
  CHECK (cpf = '' OR cpf ~ '^[0-9]{11}$');
ALTER TABLE students ADD COLUMN archived_at timestamptz;
ALTER TABLE students ADD CONSTRAINT students_archive_status_check
  CHECK (archived_at IS NULL OR status = 'inactive');
CREATE UNIQUE INDEX students_academy_cpf_unique ON students(academy_id, cpf) WHERE cpf <> '';
CREATE INDEX students_archived_list ON students(academy_id, name, id) WHERE archived_at IS NOT NULL;
ALTER TABLE classes ADD COLUMN deleted_at timestamptz;
-- The student's CPF is never inferred from the payer's document.
-- Existing students, invoices, grades and attendance remain unchanged.

-- +goose Down
-- +goose StatementBegin
DO $$ BEGIN RAISE EXCEPTION 'Restore a backup instead of discarding student CPFs and lifecycle history'; END $$;
-- +goose StatementEnd
