-- +goose Up
ALTER TABLE membership_roles DROP CONSTRAINT membership_roles_role_check;
ALTER TABLE membership_roles ADD CONSTRAINT membership_roles_role_check CHECK(role IN ('admin','teacher','student','guardian'));
CREATE TABLE enrollment_links (
 academy_id uuid PRIMARY KEY REFERENCES academies(id), token text NOT NULL UNIQUE CHECK(token ~ '^[a-f0-9]{64}$'),
 enabled boolean NOT NULL DEFAULT false, due_day integer NOT NULL CHECK(due_day BETWEEN 1 AND 31),
 modality_ids uuid[] NOT NULL DEFAULT '{}', plan_ids uuid[] NOT NULL DEFAULT '{}',
 updated_by uuid NOT NULL REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE guardian_profiles (
 academy_id uuid NOT NULL REFERENCES academies(id), user_id uuid NOT NULL REFERENCES users(id),
 cpf text NOT NULL CHECK(cpf ~ '^[0-9]{11}$'), birth_date date NOT NULL,
 PRIMARY KEY(academy_id,user_id), UNIQUE(academy_id,cpf)
);
CREATE TABLE student_guardians (
 academy_id uuid NOT NULL, student_id uuid NOT NULL, user_id uuid NOT NULL,
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
 approved_by uuid REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(academy_id,student_id,user_id),
 FOREIGN KEY(academy_id,student_id) REFERENCES students(academy_id,id),
 FOREIGN KEY(academy_id,user_id) REFERENCES guardian_profiles(academy_id,user_id)
);
CREATE INDEX guardian_family ON student_guardians(academy_id,user_id) WHERE active;
CREATE TABLE enrollment_submissions (
 id uuid PRIMARY KEY, academy_id uuid NOT NULL REFERENCES academies(id), user_id uuid NOT NULL REFERENCES users(id),
 cpf text NOT NULL, payload jsonb NOT NULL, payload_hash text NOT NULL,
 idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 16 AND 128),
 status text NOT NULL CHECK(status IN ('active','pending','approved','rejected')),
 student_id uuid, is_minor boolean NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 decided_by uuid REFERENCES users(id), decided_at timestamptz,
 UNIQUE(academy_id,user_id,cpf), UNIQUE(user_id,idempotency_key),
 FOREIGN KEY(academy_id,student_id) REFERENCES students(academy_id,id)
);
CREATE INDEX enrollment_pending ON enrollment_submissions(academy_id,created_at) WHERE status='pending';
-- +goose Down
-- This migration contains account access relationships. Restore a backup to roll back.
-- +goose StatementBegin
DO $$ BEGIN RAISE EXCEPTION 'Migration 014 contains enrollment access history; restore a reviewed backup to roll back.'; END $$;
-- +goose StatementEnd
