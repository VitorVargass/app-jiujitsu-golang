-- +goose Up
-- Email has one source. Unconfirmed legacy collisions abort this transaction.
CREATE TABLE people (
 id uuid PRIMARY KEY, email text UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(email IS NULL OR (email=lower(btrim(email)) AND email<>''))
);
ALTER TABLE users ADD COLUMN person_id uuid UNIQUE REFERENCES people(id);
ALTER TABLE students ADD COLUMN person_id uuid REFERENCES people(id);
DROP TRIGGER legacy_student_update ON memberships;
DROP TRIGGER legacy_student_role ON membership_roles;

-- +goose StatementBegin
DO $$
DECLARE u record; s record; pid uuid; uid uuid; saved_email text;
 approvals jsonb:=COALESCE(NULLIF(current_setting('tatame.identity_merge_approvals',true),''),'{}')::jsonb;
BEGIN
 IF EXISTS(SELECT lower(btrim(email)) FROM users GROUP BY lower(btrim(email)) HAVING count(*)>1) THEN
  RAISE EXCEPTION 'identity_migration_conflict: duplicate login emails require review';
 END IF;
 FOR u IN SELECT id,email FROM users ORDER BY id LOOP
  IF btrim(u.email)='' THEN RAISE EXCEPTION 'identity_migration_conflict: login email missing for user %',u.id; END IF;
  INSERT INTO people(id,email) VALUES(u.id,lower(btrim(u.email)));
  UPDATE users SET person_id=u.id WHERE id=u.id;
 END LOOP;
 FOR s IN SELECT id,user_id,email FROM students ORDER BY id LOOP
  pid:=NULL; uid:=s.user_id;
  IF uid IS NOT NULL THEN
   SELECT person_id INTO pid FROM users WHERE id=uid;
   SELECT email INTO saved_email FROM people WHERE id=pid;
   IF btrim(s.email)<>'' AND lower(btrim(s.email))<>saved_email THEN
    RAISE EXCEPTION 'identity_migration_conflict: student % and its linked account disagree',s.id;
   END IF;
  ELSE
   SELECT id INTO pid FROM people WHERE email=NULLIF(lower(btrim(s.email)),'');
   IF pid IS NOT NULL THEN
    SELECT id INTO uid FROM users WHERE person_id=pid;
    IF uid IS NULL OR approvals->>s.id::text IS DISTINCT FROM uid::text THEN
     RAISE EXCEPTION 'identity_migration_conflict: review student % before reusing its email',s.id;
    END IF;
    UPDATE students SET user_id=uid WHERE id=s.id;
   ELSE
    pid:=gen_random_uuid();
    INSERT INTO people(id,email) VALUES(pid,NULLIF(lower(btrim(s.email)),''));
   END IF;
  END IF;
  UPDATE students SET person_id=pid WHERE id=s.id;
 END LOOP;
END $$;
-- +goose StatementEnd

ALTER TABLE users ALTER COLUMN person_id SET NOT NULL;
ALTER TABLE users ADD UNIQUE(id,person_id);
ALTER TABLE students ALTER COLUMN person_id SET NOT NULL;

CREATE TABLE academy_participants (
 id uuid PRIMARY KEY,
 academy_id uuid NOT NULL REFERENCES academies(id),
 person_id uuid NOT NULL REFERENCES people(id),
 cpf text NOT NULL DEFAULT '' CHECK(cpf='' OR cpf ~ '^[0-9]{11}$'),
 student_code text NOT NULL, qr_token text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(academy_id,id), UNIQUE(academy_id,person_id), UNIQUE(academy_id,student_code), UNIQUE(academy_id,id,person_id)
);
CREATE UNIQUE INDEX participants_academy_cpf_unique ON academy_participants(academy_id,cpf) WHERE cpf<>'';
-- Existing students keep IDs and all public identification credentials.
INSERT INTO academy_participants(id,academy_id,person_id,cpf,student_code,qr_token,created_at)
 SELECT id,academy_id,person_id,cpf,student_code,qr_token,created_at FROM students;
ALTER TABLE students ADD COLUMN participant_id uuid;
UPDATE students SET participant_id=id;
ALTER TABLE students ALTER COLUMN participant_id SET NOT NULL;
ALTER TABLE students ADD UNIQUE(academy_id,participant_id);
ALTER TABLE students ADD FOREIGN KEY(academy_id,participant_id,person_id) REFERENCES academy_participants(academy_id,id,person_id);
ALTER TABLE students ADD FOREIGN KEY(user_id,person_id) REFERENCES users(id,person_id);

INSERT INTO academy_participants(id,academy_id,person_id,student_code,qr_token)
 SELECT gen_random_uuid(),m.academy_id,u.person_id,m.student_code,m.qr_token
 FROM memberships m JOIN users u ON u.id=m.user_id
 WHERE NOT EXISTS(SELECT 1 FROM academy_participants p WHERE p.academy_id=m.academy_id AND p.person_id=u.person_id);

INSERT INTO membership_roles(membership_id,role)
 SELECT m.id,'student' FROM students s JOIN memberships m ON m.academy_id=s.academy_id AND m.user_id=s.user_id
 ON CONFLICT DO NOTHING;

ALTER TABLE attendances DROP CONSTRAINT attendances_academy_id_membership_id_fkey;
ALTER TABLE attendances RENAME COLUMN membership_id TO participant_id;
ALTER TABLE attendances ADD FOREIGN KEY(academy_id,participant_id) REFERENCES academy_participants(academy_id,id);
ALTER INDEX attendances_student_history RENAME TO attendances_participant_history;
ALTER TABLE students DROP COLUMN email, DROP COLUMN cpf, DROP COLUMN student_code, DROP COLUMN qr_token;
ALTER TABLE users DROP COLUMN email;

-- Every login membership can train without creating a financial enrollment.
-- +goose StatementBegin
CREATE FUNCTION ensure_academy_participant(a uuid,u uuid) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE pid uuid; result uuid; code text; token text;
BEGIN
 SELECT person_id INTO pid FROM users WHERE id=u;
 SELECT id INTO result FROM academy_participants WHERE academy_id=a AND person_id=pid;
 IF result IS NOT NULL THEN RETURN result; END IF;
 SELECT student_code,qr_token INTO code,token FROM memberships WHERE academy_id=a AND user_id=u;
 INSERT INTO academy_participants(id,academy_id,person_id,student_code,qr_token)
 VALUES(gen_random_uuid(),a,pid,code,token)
 ON CONFLICT(academy_id,person_id) DO UPDATE SET person_id=EXCLUDED.person_id RETURNING id INTO result;
 RETURN result;
END $$;
CREATE FUNCTION membership_participant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM ensure_academy_participant(NEW.academy_id,NEW.user_id); RETURN NEW; END $$;
CREATE TRIGGER membership_participant_insert AFTER INSERT ON memberships FOR EACH ROW EXECUTE FUNCTION membership_participant();

CREATE OR REPLACE FUNCTION sync_legacy_student() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pid uuid; part uuid; old_status text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM membership_roles WHERE membership_id=NEW.id AND role='student') THEN RETURN NEW; END IF;
 part:=ensure_academy_participant(NEW.academy_id,NEW.user_id);
 SELECT person_id INTO pid FROM users WHERE id=NEW.user_id;
 IF NOT EXISTS(SELECT 1 FROM students WHERE academy_id=NEW.academy_id AND participant_id=part) THEN
  INSERT INTO students(id,academy_id,user_id,person_id,participant_id,name,status,belt)
  SELECT NEW.id,NEW.academy_id,NEW.user_id,pid,part,u.name,
   CASE WHEN NEW.status='active' THEN 'active' ELSE 'inactive' END,NEW.belt FROM users u WHERE u.id=NEW.user_id;
 ELSIF TG_OP='UPDATE' THEN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
   UPDATE students SET status=CASE WHEN NEW.status='active' THEN 'active' ELSE 'inactive' END
    WHERE academy_id=NEW.academy_id AND participant_id=part AND archived_at IS NULL;
   IF NEW.status<>'active' THEN
    UPDATE student_billing b SET enabled=false FROM students s WHERE b.academy_id=s.academy_id AND b.student_id=s.id AND s.academy_id=NEW.academy_id AND s.participant_id=part;
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
-- +goose StatementEnd
CREATE TRIGGER legacy_student_update AFTER UPDATE ON memberships FOR EACH ROW EXECUTE FUNCTION sync_legacy_student();
CREATE TRIGGER legacy_student_role AFTER INSERT ON membership_roles FOR EACH ROW EXECUTE FUNCTION sync_legacy_student_role();

-- +goose Down
-- +goose StatementBegin
DO $$ BEGIN RAISE EXCEPTION 'Restore a backup: identities and attendance cannot be split safely'; END $$;
-- +goose StatementEnd
