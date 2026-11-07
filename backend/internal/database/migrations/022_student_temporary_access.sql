-- +goose Up
ALTER TABLE users ADD COLUMN password_change_required boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN temporary_password_expires_at timestamptz;
ALTER TABLE users ADD CONSTRAINT temporary_password_expiry
 CHECK(password_change_required = (temporary_password_expires_at IS NOT NULL));

-- +goose Down
-- +goose StatementBegin
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM users WHERE password_change_required) THEN
  RAISE EXCEPTION 'Complete temporary account activation before reverting migration 022';
 END IF;
END $$;
-- +goose StatementEnd
ALTER TABLE users DROP CONSTRAINT temporary_password_expiry;
ALTER TABLE users DROP COLUMN temporary_password_expires_at;
ALTER TABLE users DROP COLUMN password_change_required;
