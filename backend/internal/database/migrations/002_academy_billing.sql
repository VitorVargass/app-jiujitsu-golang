-- +goose Up
CREATE TABLE modalities (
 id uuid PRIMARY KEY, academy_id uuid NOT NULL REFERENCES academies(id), name text NOT NULL,
 active boolean NOT NULL DEFAULT true, UNIQUE(academy_id,id), UNIQUE(academy_id,name)
);
INSERT INTO modalities SELECT gen_random_uuid(),id,'Jiu-Jitsu',true FROM academies;
CREATE TABLE plans (
 id uuid PRIMARY KEY, academy_id uuid NOT NULL REFERENCES academies(id), name text NOT NULL,
 amount_cents bigint NOT NULL CHECK(amount_cents>0), active boolean NOT NULL DEFAULT true, UNIQUE(academy_id,id)
);
CREATE TABLE plan_modalities (
 academy_id uuid NOT NULL, plan_id uuid NOT NULL, modality_id uuid NOT NULL,
 PRIMARY KEY(academy_id,plan_id,modality_id),
 FOREIGN KEY(academy_id,plan_id) REFERENCES plans(academy_id,id),
 FOREIGN KEY(academy_id,modality_id) REFERENCES modalities(academy_id,id)
);
CREATE TABLE students (
 id uuid PRIMARY KEY, academy_id uuid NOT NULL REFERENCES academies(id), user_id uuid REFERENCES users(id),
 name text NOT NULL, email text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'active' CHECK(status IN('active','inactive')),
 belt text NOT NULL DEFAULT 'Faixa Branca', student_code text NOT NULL, qr_token text NOT NULL UNIQUE,
 plan_id uuid, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(academy_id,id), UNIQUE(academy_id,user_id), UNIQUE(academy_id,student_code),
 FOREIGN KEY(academy_id,plan_id) REFERENCES plans(academy_id,id)
);
INSERT INTO students(id,academy_id,user_id,name,email,status,belt,student_code,qr_token)
 SELECT m.id,m.academy_id,m.user_id,u.name,u.email,
 CASE WHEN m.status='active' THEN 'active' ELSE 'inactive' END,m.belt,m.student_code,m.qr_token
 FROM memberships m JOIN users u ON u.id=m.user_id
 WHERE EXISTS(SELECT 1 FROM membership_roles r WHERE r.membership_id=m.id AND r.role='student');
CREATE TABLE student_modalities (
 academy_id uuid NOT NULL, student_id uuid NOT NULL, modality_id uuid NOT NULL,
 PRIMARY KEY(academy_id,student_id,modality_id),
 FOREIGN KEY(academy_id,student_id) REFERENCES students(academy_id,id),
 FOREIGN KEY(academy_id,modality_id) REFERENCES modalities(academy_id,id)
);
CREATE TABLE student_invitations (
 token_hash text PRIMARY KEY, academy_id uuid NOT NULL, student_id uuid NOT NULL,
 expires_at timestamptz NOT NULL, accepted_at timestamptz, accepted_by uuid REFERENCES users(id), revoked_at timestamptz,
 FOREIGN KEY(academy_id,student_id) REFERENCES students(academy_id,id)
);
CREATE TABLE student_billing (
 academy_id uuid NOT NULL, student_id uuid NOT NULL, enabled boolean NOT NULL DEFAULT false,
 amount_cents bigint NOT NULL CHECK(amount_cents>0), due_day integer NOT NULL CHECK(due_day BETWEEN 1 AND 31),
 next_month date NOT NULL CHECK(extract(day from next_month)=1),
 payer_name text NOT NULL, payer_document text NOT NULL,
 PRIMARY KEY(academy_id,student_id), FOREIGN KEY(academy_id,student_id) REFERENCES students(academy_id,id)
);
CREATE TABLE invoices (
 id uuid PRIMARY KEY, academy_id uuid NOT NULL, student_id uuid NOT NULL, competence date NOT NULL,
 due_date date NOT NULL, amount_cents bigint NOT NULL CHECK(amount_cents>0),
 payer_name text NOT NULL, payer_document text NOT NULL,
 status text NOT NULL DEFAULT 'open' CHECK(status IN('open','paid','cancelled')),
 paid_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(academy_id,id), UNIQUE(academy_id,student_id,competence),
 FOREIGN KEY(academy_id,student_id) REFERENCES students(academy_id,id)
);
CREATE TABLE pix_charges (
 id uuid PRIMARY KEY, academy_id uuid NOT NULL, invoice_id uuid NOT NULL, reference text NOT NULL UNIQUE,
 provider_id text, customer_id text, state text NOT NULL DEFAULT 'new'
 CHECK(state IN('new','creating','uncertain','ready','retired')),
 provider_status text NOT NULL DEFAULT '', payload text NOT NULL DEFAULT '', expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(academy_id,invoice_id) REFERENCES invoices(academy_id,id), UNIQUE(academy_id,provider_id)
);
CREATE UNIQUE INDEX pix_one_current ON pix_charges(academy_id,invoice_id) WHERE state<>'retired';
CREATE TABLE payment_receipts (
 academy_id uuid NOT NULL, provider_id text NOT NULL, invoice_id uuid NOT NULL,
 amount_cents bigint NOT NULL, paid_at timestamptz NOT NULL, status text NOT NULL,
 PRIMARY KEY(academy_id,provider_id), FOREIGN KEY(academy_id,invoice_id) REFERENCES invoices(academy_id,id)
);
CREATE TABLE payment_operation_locks (
 academy_id uuid NOT NULL, invoice_id uuid NOT NULL, owner uuid NOT NULL, expires_at timestamptz NOT NULL,
 PRIMARY KEY(academy_id,invoice_id), FOREIGN KEY(academy_id,invoice_id) REFERENCES invoices(academy_id,id)
);
CREATE TABLE payment_events (
 connection_id text NOT NULL, event_id text NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(connection_id,event_id)
);
ALTER TABLE classes ALTER COLUMN teacher_membership_id DROP NOT NULL;
ALTER TABLE classes ADD COLUMN modality_id uuid;
UPDATE classes c SET modality_id=m.id FROM modalities m WHERE c.academy_id=m.academy_id AND m.name='Jiu-Jitsu';
ALTER TABLE classes ADD FOREIGN KEY(academy_id,modality_id) REFERENCES modalities(academy_id,id);
ALTER TABLE attendances DROP CONSTRAINT attendances_academy_id_membership_id_fkey;
ALTER TABLE attendances ADD FOREIGN KEY(academy_id,membership_id) REFERENCES students(academy_id,id);
CREATE INDEX invoices_filter ON invoices(academy_id,competence,due_date);
CREATE INDEX students_name ON students(academy_id,name);
-- Legacy approval remains compatible; authentication memberships do not own attendance anymore.
-- +goose StatementBegin
CREATE FUNCTION sync_legacy_student() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM membership_roles WHERE membership_id=NEW.id AND role='student') AND NOT EXISTS(SELECT 1 FROM students WHERE academy_id=NEW.academy_id AND user_id=NEW.user_id AND id<>NEW.id) THEN
  INSERT INTO students(id,academy_id,user_id,name,email,status,belt,student_code,qr_token)
  SELECT NEW.id,NEW.academy_id,NEW.user_id,u.name,u.email,
   CASE WHEN NEW.status='active' THEN 'active' ELSE 'inactive' END,NEW.belt,NEW.student_code,NEW.qr_token
  FROM users u WHERE u.id=NEW.user_id
  ON CONFLICT(academy_id,user_id) DO UPDATE SET status=EXCLUDED.status,belt=EXCLUDED.belt;
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION sync_legacy_student_role() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.role='student' THEN
  UPDATE memberships SET status=status WHERE id=NEW.membership_id;
 END IF;
 RETURN NEW;
END $$;
-- +goose StatementEnd
CREATE TRIGGER legacy_student_update AFTER UPDATE ON memberships FOR EACH ROW EXECUTE FUNCTION sync_legacy_student();
CREATE TRIGGER legacy_student_role AFTER INSERT ON membership_roles FOR EACH ROW EXECUTE FUNCTION sync_legacy_student_role();

-- +goose Down
-- This conversion is intentionally forward-only: a rollback cannot represent students without a user account.
-- +goose StatementBegin
DO $$ BEGIN RAISE EXCEPTION 'Restore the pre-migration backup instead of dropping student and financial history'; END $$;
-- +goose StatementEnd
