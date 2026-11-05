-- +goose Up
-- Only a fingerprint is stored; do not duplicate payer contact details in history.
ALTER TABLE checkout_attempts ADD COLUMN customer_fingerprint text NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE checkout_attempts DROP COLUMN customer_fingerprint;
