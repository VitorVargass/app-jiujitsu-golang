-- +goose Up
-- Absence preserves the existing InfinitePay account settings until a manager chooses.
CREATE TABLE payment_fee_settings (
 academy_id uuid PRIMARY KEY REFERENCES academies(id),
 pass_card_fees boolean NOT NULL,
 updated_by uuid NOT NULL REFERENCES users(id),
 updated_at timestamptz NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE payment_fee_settings;
