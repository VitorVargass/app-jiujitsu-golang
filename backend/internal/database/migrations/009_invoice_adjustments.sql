-- +goose Up
ALTER TABLE invoices ADD COLUMN discount_cents bigint NOT NULL DEFAULT 0 CHECK(discount_cents>=0);
ALTER TABLE invoices ADD COLUMN discount_reason text NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN payment_method text NOT NULL DEFAULT ''
 CHECK(payment_method IN('','asaas_pix','cash','pix','card','transfer','other'));
UPDATE invoices SET payment_method='asaas_pix' WHERE status='paid' AND EXISTS(
 SELECT 1 FROM payment_receipts r WHERE r.academy_id=invoices.academy_id AND r.invoice_id=invoices.id AND r.status='received'
);
-- A charge retains its issued value even after an invoice receives a discount.
ALTER TABLE pix_charges ADD COLUMN amount_cents bigint;
UPDATE pix_charges c SET amount_cents=i.amount_cents FROM invoices i WHERE i.academy_id=c.academy_id AND i.id=c.invoice_id;
ALTER TABLE pix_charges ALTER COLUMN amount_cents SET NOT NULL;
ALTER TABLE pix_charges ADD CHECK(amount_cents>0);
CREATE TABLE invoice_adjustments (
 id uuid PRIMARY KEY, academy_id uuid NOT NULL, invoice_id uuid NOT NULL,
 actor_user_id uuid NOT NULL REFERENCES users(id),
 kind text NOT NULL CHECK(kind IN('discount','manual_payment')),
 previous_amount_cents bigint NOT NULL CHECK(previous_amount_cents>0),
 amount_cents bigint NOT NULL CHECK(amount_cents>0),
 discount_cents bigint NOT NULL CHECK(discount_cents>=0),
 payment_method text NOT NULL DEFAULT '', note text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(academy_id,invoice_id) REFERENCES invoices(academy_id,id)
);
CREATE INDEX invoice_adjustments_history ON invoice_adjustments(academy_id,invoice_id,created_at DESC,id);
CREATE INDEX invoice_adjustments_actor ON invoice_adjustments(actor_user_id);
CREATE UNIQUE INDEX invoice_one_manual_payment ON invoice_adjustments(academy_id,invoice_id) WHERE kind='manual_payment';

-- +goose Down
-- +goose StatementBegin
DO $$ BEGIN RAISE EXCEPTION 'Restore a backup to preserve invoice adjustment history'; END $$;
-- +goose StatementEnd
