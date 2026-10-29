-- +goose Up
CREATE TABLE platform_subscriptions (
 academy_id uuid PRIMARY KEY REFERENCES academies(id),
 started_at timestamptz NOT NULL DEFAULT now(),
 paid_until timestamptz NOT NULL DEFAULT now(),
 billing_day integer NOT NULL DEFAULT (EXTRACT(DAY FROM (now() AT TIME ZONE 'UTC'))::integer) CHECK(billing_day BETWEEN 1 AND 31),
 renewal_enabled boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE platform_subscription_cycles (
 id uuid PRIMARY KEY,
 academy_id uuid NOT NULL REFERENCES platform_subscriptions(academy_id),
 period_start timestamptz NOT NULL,
 period_end timestamptz NOT NULL CHECK(period_end>period_start),
 amount_cents bigint NOT NULL DEFAULT 45000 CHECK(amount_cents=45000),
 state text NOT NULL DEFAULT 'open' CHECK(state IN('open','paid')),
 paid_at timestamptz,
 UNIQUE(academy_id,period_start),
 UNIQUE(academy_id,id)
);
CREATE TABLE platform_subscription_attempts (
 id uuid PRIMARY KEY,
 academy_id uuid NOT NULL,
 cycle_id uuid NOT NULL UNIQUE,
 reference uuid NOT NULL UNIQUE,
 receiver_handle text NOT NULL,
 state text NOT NULL CHECK(state IN('creating','ready','uncertain','rejected','paid','review')),
 checkout_url text NOT NULL DEFAULT '',
 expires_at timestamptz NOT NULL,
 transaction_nsu text NOT NULL DEFAULT '',
 slug text NOT NULL DEFAULT '',
 review_reason text NOT NULL DEFAULT '',
 last_checked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(academy_id,cycle_id) REFERENCES platform_subscription_cycles(academy_id,id)
);
CREATE TABLE platform_subscription_receipts (
 transaction_nsu text PRIMARY KEY,
 attempt_id uuid NOT NULL UNIQUE REFERENCES platform_subscription_attempts(id),
 cycle_id uuid NOT NULL UNIQUE REFERENCES platform_subscription_cycles(id),
 amount_cents bigint NOT NULL CHECK(amount_cents=45000),
 capture_method text NOT NULL CHECK(capture_method IN('pix','credit_card')),
 paid_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE platform_subscription_inbox (
 id uuid PRIMARY KEY,
 attempt_id uuid NOT NULL REFERENCES platform_subscription_attempts(id),
 fingerprint text NOT NULL UNIQUE,
 payload jsonb NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN('pending','processing','done','review')),
 tries integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 lease_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX platform_subscription_inbox_pending ON platform_subscription_inbox(next_attempt_at) WHERE state IN('pending','processing');
CREATE INDEX platform_subscription_attempts_pending ON platform_subscription_attempts(updated_at) WHERE state IN('ready','uncertain','creating');

CREATE TABLE platform_subscription_events (
 id uuid PRIMARY KEY,
 academy_id uuid NOT NULL REFERENCES platform_subscriptions(academy_id),
 actor_user_id uuid NOT NULL REFERENCES users(id),
 renewal_enabled boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE platform_subscription_events;
DROP TABLE platform_subscription_inbox;
DROP TABLE platform_subscription_receipts;
DROP TABLE platform_subscription_attempts;
DROP TABLE platform_subscription_cycles;
DROP TABLE platform_subscriptions;
