-- +goose Up
ALTER TABLE platform_subscription_attempts ADD COLUMN retired_at timestamptz;
ALTER TABLE platform_subscription_attempts DROP CONSTRAINT platform_subscription_attempts_cycle_id_key;
CREATE UNIQUE INDEX platform_subscription_attempts_current_cycle ON platform_subscription_attempts(cycle_id) WHERE retired_at IS NULL;

-- +goose Down
-- Keep historical attempts: rollback must not discard payment references.
-- +goose StatementBegin
DO $ BEGIN RAISE EXCEPTION 'Subscription checkout history requires a forward migration'; END $;
-- +goose StatementEnd
