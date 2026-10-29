-- +goose Up
ALTER TABLE checkout_attempts ADD COLUMN retired_at timestamptz;
ALTER TABLE checkout_attempts ADD COLUMN retired_by uuid REFERENCES users(id);
ALTER TABLE checkout_attempts ADD COLUMN retirement_note text NOT NULL DEFAULT '';
ALTER TABLE checkout_attempts DROP CONSTRAINT checkout_attempts_academy_id_invoice_id_key;
CREATE UNIQUE INDEX checkout_one_current_attempt ON checkout_attempts(academy_id,invoice_id) WHERE retired_at IS NULL;
CREATE INDEX checkout_invoice_history ON checkout_attempts(academy_id,invoice_id,created_at DESC);

-- +goose Down
-- +goose StatementBegin
DO $$ BEGIN RAISE EXCEPTION 'Restore a backup to preserve checkout history'; END $$;
-- +goose StatementEnd
