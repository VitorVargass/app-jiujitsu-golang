-- +goose Up
ALTER TABLE academies ADD COLUMN owner_user_id uuid REFERENCES users(id);
-- +goose Down
ALTER TABLE academies DROP COLUMN owner_user_id;
