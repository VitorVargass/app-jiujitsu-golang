-- +goose Up
ALTER TABLE platform_subscription_cycles DROP CONSTRAINT platform_subscription_cycles_amount_cents_check;
ALTER TABLE platform_subscription_cycles ALTER COLUMN amount_cents DROP DEFAULT;
ALTER TABLE platform_subscription_cycles ADD CONSTRAINT platform_subscription_cycles_amount_cents_check CHECK(amount_cents IN (15000,25000,45000));
ALTER TABLE platform_subscription_cycles ADD COLUMN plan_id text NOT NULL DEFAULT 'legacy';
ALTER TABLE platform_subscription_cycles ADD COLUMN active_students integer CHECK(active_students>=0);
ALTER TABLE platform_subscription_cycles ADD CONSTRAINT platform_subscription_plan_count_required CHECK(plan_id='legacy' OR active_students IS NOT NULL);
ALTER TABLE platform_subscription_cycles ADD CONSTRAINT platform_subscription_cycle_plan_check CHECK(
 (plan_id='legacy' AND amount_cents=45000) OR
 (plan_id='essential' AND amount_cents=15000 AND active_students BETWEEN 0 AND 200) OR
 (plan_id='professional' AND amount_cents=25000 AND active_students BETWEEN 201 AND 999) OR
 (plan_id='large' AND amount_cents=45000 AND active_students>=1000)
);
ALTER TABLE platform_subscription_attempts ADD COLUMN amount_cents bigint NOT NULL DEFAULT 45000 CHECK(amount_cents IN (15000,25000,45000));
ALTER TABLE platform_subscription_attempts ALTER COLUMN amount_cents DROP DEFAULT;
ALTER TABLE platform_subscription_receipts DROP CONSTRAINT platform_subscription_receipts_amount_cents_check;
ALTER TABLE platform_subscription_receipts ADD CONSTRAINT platform_subscription_receipts_amount_cents_check CHECK(amount_cents IN (15000,25000,45000));

-- +goose Down
-- +goose StatementBegin
DO $$ BEGIN RAISE EXCEPTION 'Restore a backup to preserve subscription prices and receipts'; END $$;
-- +goose StatementEnd
