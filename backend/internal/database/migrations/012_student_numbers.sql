-- +goose Up
-- Codes identify a participant; they are not passwords. Archived codes stay reserved.
-- +goose StatementBegin
CREATE FUNCTION next_student_code(a uuid) RETURNS text
LANGUAGE plpgsql VOLATILE SET search_path=pg_catalog,public AS $$
DECLARE start_at integer := floor(random()*100000)::integer; candidate text; offset_by integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('tatame.student_code:'||a::text,0));
 FOR offset_by IN 0..99999 LOOP
  candidate:=lpad(((start_at+offset_by)%100000)::text,5,'0');
  IF NOT EXISTS(SELECT 1 FROM public.academy_participants WHERE academy_id=a AND student_code=candidate)
     AND NOT EXISTS(SELECT 1 FROM public.memberships WHERE academy_id=a AND student_code=candidate) THEN
   RETURN candidate;
  END IF;
 END LOOP;
 RAISE EXCEPTION 'Todos os numeros de aluno desta academia estao ocupados.' USING ERRCODE='P0001';
END $$;

-- Keep any existing valid five-digit code. Only legacy formats are replaced.
DO $$
DECLARE p record;
BEGIN
 FOR p IN SELECT id,academy_id FROM academy_participants WHERE student_code !~ '^[0-9]{5}$' ORDER BY academy_id,id LOOP
  UPDATE academy_participants SET student_code=next_student_code(p.academy_id) WHERE id=p.id;
 END LOOP;
END $$;

CREATE FUNCTION assign_participant_code() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('tatame.student_code:'||NEW.academy_id::text,0));
 IF NEW.student_code IS NULL OR NEW.student_code !~ '^[0-9]{5}$'
    OR EXISTS(SELECT 1 FROM public.academy_participants WHERE academy_id=NEW.academy_id AND student_code=NEW.student_code) THEN
  NEW.student_code:=public.next_student_code(NEW.academy_id);
 END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION assign_membership_code() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE saved_code text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('tatame.student_code:'||NEW.academy_id::text,0));
 SELECT p.student_code INTO saved_code FROM public.academy_participants p
 JOIN public.users u ON u.person_id=p.person_id
 WHERE p.academy_id=NEW.academy_id AND u.id=NEW.user_id;
 NEW.student_code:=COALESCE(saved_code,public.next_student_code(NEW.academy_id));
 RETURN NEW;
END $$;
-- +goose StatementEnd

-- Synchronize compatibility memberships without triggering enrollment/history changes.
ALTER TABLE memberships DISABLE TRIGGER legacy_student_update;
UPDATE memberships SET student_code='migrating:'||id::text;
UPDATE memberships m SET student_code=p.student_code
 FROM users u JOIN academy_participants p ON p.person_id=u.person_id
 WHERE m.user_id=u.id AND m.academy_id=p.academy_id;
ALTER TABLE memberships ENABLE TRIGGER legacy_student_update;

ALTER TABLE academy_participants ADD CONSTRAINT participant_code_five_digits CHECK(student_code ~ '^[0-9]{5}$');
ALTER TABLE memberships ADD CONSTRAINT membership_code_five_digits CHECK(student_code ~ '^[0-9]{5}$');
CREATE TRIGGER participant_code_insert BEFORE INSERT ON academy_participants FOR EACH ROW EXECUTE FUNCTION assign_participant_code();
CREATE TRIGGER membership_code_insert BEFORE INSERT ON memberships FOR EACH ROW EXECUTE FUNCTION assign_membership_code();

-- +goose Down
-- +goose StatementBegin
DO $$ BEGIN RAISE EXCEPTION 'Restore a backup to recover previous student codes.'; END $$;
-- +goose StatementEnd
