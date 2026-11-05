-- +goose Up
CREATE TABLE account_legal_acceptances (
 user_id uuid PRIMARY KEY REFERENCES users(id),
 terms_version text NOT NULL,
 privacy_version text NOT NULL,
 accepted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE platform_subscriptions ADD COLUMN selected_plan_id text CHECK(selected_plan_id IN ('essential','professional','large'));
ALTER TABLE platform_subscriptions ADD COLUMN trial_ends_at timestamptz;
ALTER TABLE platform_subscriptions ADD COLUMN terms_version text;
ALTER TABLE platform_subscriptions ADD COLUMN terms_accepted_at timestamptz;
ALTER TABLE platform_subscriptions ADD COLUMN terms_accepted_by uuid REFERENCES users(id);
-- The selected tier is a minimum commitment; enrollment growth upgrades it.
-- Student count on a cycle remains a factual snapshot, not an artificial minimum.
ALTER TABLE platform_subscription_cycles DROP CONSTRAINT platform_subscription_cycle_plan_check;
ALTER TABLE platform_subscription_cycles ADD CONSTRAINT platform_subscription_cycle_plan_check CHECK(
 (plan_id='legacy' AND amount_cents=45000) OR
 (plan_id='essential' AND amount_cents=15000 AND active_students BETWEEN 0 AND 200) OR
 (plan_id='professional' AND amount_cents=25000 AND active_students BETWEEN 0 AND 999) OR
 (plan_id='large' AND amount_cents=45000 AND active_students>=0)
);

-- +goose Down
-- +goose StatementBegin
DO $$ BEGIN RAISE EXCEPTION 'Restore a backup to preserve legal acceptances and subscription commitments'; END $$;
-- +goose StatementEnd
