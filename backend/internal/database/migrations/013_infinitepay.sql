-- +goose Up
CREATE TABLE payment_connections (
 id uuid PRIMARY KEY, academy_id uuid NOT NULL REFERENCES academies(id),
 provider text NOT NULL DEFAULT 'infinitepay' CHECK(provider='infinitepay'),
 handle text NOT NULL, encrypted_key bytea NOT NULL,
 current boolean NOT NULL DEFAULT true, enabled boolean NOT NULL DEFAULT true,
 validated_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid NOT NULL REFERENCES users(id),
 UNIQUE(academy_id,id)
);
CREATE UNIQUE INDEX payment_current_connection ON payment_connections(academy_id) WHERE current;
CREATE TABLE payment_connection_audit (
 id uuid PRIMARY KEY, academy_id uuid NOT NULL, connection_id uuid NOT NULL,
 actor_user_id uuid NOT NULL REFERENCES users(id), action text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(academy_id,connection_id) REFERENCES payment_connections(academy_id,id)
);
CREATE TABLE checkout_attempts (
 id uuid PRIMARY KEY, academy_id uuid NOT NULL, invoice_id uuid NOT NULL,
 connection_id uuid NOT NULL, reference text NOT NULL UNIQUE,
 amount_cents bigint NOT NULL CHECK(amount_cents>0),
 state text NOT NULL CHECK(state IN('creating','uncertain','rejected','ready','paid','review')),
 checkout_url text NOT NULL DEFAULT '', expires_at timestamptz NOT NULL,
 transaction_nsu text NOT NULL DEFAULT '', slug text NOT NULL DEFAULT '',
 review_reason text NOT NULL DEFAULT '', last_checked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(academy_id,id), UNIQUE(academy_id,invoice_id),
 FOREIGN KEY(academy_id,invoice_id) REFERENCES invoices(academy_id,id),
 FOREIGN KEY(academy_id,connection_id) REFERENCES payment_connections(academy_id,id)
);
CREATE TABLE checkout_receipts (
 connection_id uuid NOT NULL, transaction_nsu text NOT NULL,
 academy_id uuid NOT NULL, attempt_id uuid NOT NULL, invoice_id uuid NOT NULL,
 amount_cents bigint NOT NULL CHECK(amount_cents>0), capture_method text NOT NULL,
 confirmed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(connection_id,transaction_nsu), UNIQUE(academy_id,invoice_id),
 FOREIGN KEY(academy_id,attempt_id) REFERENCES checkout_attempts(academy_id,id),
 FOREIGN KEY(academy_id,invoice_id) REFERENCES invoices(academy_id,id),
 FOREIGN KEY(academy_id,connection_id) REFERENCES payment_connections(academy_id,id)
);
CREATE TABLE checkout_inbox (
 id uuid PRIMARY KEY, connection_id uuid NOT NULL REFERENCES payment_connections(id),
 fingerprint text NOT NULL, payload jsonb NOT NULL, state text NOT NULL DEFAULT 'pending'
 CHECK(state IN('pending','processing','done','review')),
 tries integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
 lease_until timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(connection_id,fingerprint)
);
CREATE INDEX checkout_inbox_pending ON checkout_inbox(next_attempt_at) WHERE state IN('pending','processing');
ALTER TABLE invoices DROP CONSTRAINT invoices_payment_method_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_payment_method_check CHECK(payment_method IN('','asaas_pix','infinitepay_pix','infinitepay_card','cash','pix','card','transfer','other'));

-- +goose Down
-- +goose StatementBegin
DO $$ BEGIN RAISE EXCEPTION 'Restore a backup to preserve payment history'; END $$;
-- +goose StatementEnd
