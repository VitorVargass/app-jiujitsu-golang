-- +goose Up
ALTER TABLE students ADD COLUMN activity_tracking_started_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE student_active_periods (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), academy_id uuid NOT NULL, student_id uuid NOT NULL,
 started_at timestamptz NOT NULL, ended_at timestamptz,
 CHECK(ended_at IS NULL OR ended_at>=started_at),
 FOREIGN KEY(academy_id,student_id) REFERENCES students(academy_id,id)
);
CREATE UNIQUE INDEX student_one_active_period ON student_active_periods(academy_id,student_id) WHERE ended_at IS NULL;
CREATE INDEX student_active_history ON student_active_periods(academy_id,student_id,started_at);
-- Past pauses were not recorded. Start tracking now instead of inventing them.
INSERT INTO student_active_periods(academy_id,student_id,started_at)
 SELECT academy_id,id,activity_tracking_started_at FROM students WHERE status='active' AND archived_at IS NULL;
CREATE TABLE student_graduation_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 academy_id uuid NOT NULL, student_id uuid NOT NULL, modality_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN('baseline','initial','change')),
 previous_belt text, previous_degrees integer CHECK(previous_degrees BETWEEN 0 AND 4),
 belt text NOT NULL, degrees integer NOT NULL CHECK(degrees BETWEEN 0 AND 4),
 occurred_at timestamptz, recorded_at timestamptz NOT NULL DEFAULT now(),
 actor_user_id uuid REFERENCES users(id),
 FOREIGN KEY(academy_id,student_id) REFERENCES students(academy_id,id),
 FOREIGN KEY(academy_id,modality_id) REFERENCES modalities(academy_id,id),
 CHECK((kind='change')=(occurred_at IS NOT NULL))
);
CREATE INDEX student_graduation_history ON student_graduation_events(academy_id,student_id,sequence DESC);
CREATE INDEX student_graduation_modality ON student_graduation_events(academy_id,student_id,modality_id,sequence DESC);
CREATE INDEX student_graduation_actor ON student_graduation_events(actor_user_id);
INSERT INTO student_graduation_events(academy_id,student_id,modality_id,kind,belt,degrees)
 SELECT academy_id,student_id,modality_id,'baseline',belt,degrees FROM student_modalities;
-- +goose StatementBegin
CREATE FUNCTION track_student_activity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE was_active boolean:=false; is_active boolean;
BEGIN
 IF TG_OP='UPDATE' THEN was_active:=OLD.status='active' AND OLD.archived_at IS NULL; END IF;
 is_active:=NEW.status='active' AND NEW.archived_at IS NULL;
 IF was_active AND NOT is_active THEN
  UPDATE student_active_periods SET ended_at=greatest(started_at,now()) WHERE academy_id=NEW.academy_id AND student_id=NEW.id AND ended_at IS NULL;
 ELSIF is_active AND NOT was_active THEN
  INSERT INTO student_active_periods(academy_id,student_id,started_at) VALUES(NEW.academy_id,NEW.id,now());
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION track_student_graduation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous_rank text; previous_degree integer; event_kind text:='initial';
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.belt=OLD.belt AND NEW.degrees=OLD.degrees THEN RETURN NEW; END IF;
  previous_rank:=OLD.belt; previous_degree:=OLD.degrees; event_kind:='change';
 ELSE
  SELECT belt,degrees INTO previous_rank,previous_degree FROM student_graduation_events
   WHERE academy_id=NEW.academy_id AND student_id=NEW.student_id AND modality_id=NEW.modality_id ORDER BY sequence DESC LIMIT 1;
  IF FOUND THEN
   IF previous_rank=NEW.belt AND previous_degree=NEW.degrees THEN RETURN NEW; END IF;
   event_kind:='change';
  END IF;
 END IF;
 INSERT INTO student_graduation_events(academy_id,student_id,modality_id,kind,previous_belt,previous_degrees,belt,degrees,occurred_at,actor_user_id)
 VALUES(NEW.academy_id,NEW.student_id,NEW.modality_id,event_kind,previous_rank,previous_degree,NEW.belt,NEW.degrees,
  CASE WHEN event_kind='change' THEN now() ELSE NULL END,NULLIF(current_setting('tatame.actor_user_id',true),'')::uuid);
 RETURN NEW;
END $$;
-- +goose StatementEnd
CREATE TRIGGER student_activity_insert AFTER INSERT ON students FOR EACH ROW EXECUTE FUNCTION track_student_activity();
CREATE TRIGGER student_activity_update AFTER UPDATE OF status,archived_at ON students FOR EACH ROW EXECUTE FUNCTION track_student_activity();
CREATE TRIGGER student_graduation_insert AFTER INSERT ON student_modalities FOR EACH ROW EXECUTE FUNCTION track_student_graduation();
CREATE TRIGGER student_graduation_update AFTER UPDATE OF belt,degrees ON student_modalities FOR EACH ROW EXECUTE FUNCTION track_student_graduation();
-- +goose Down
-- +goose StatementBegin
DO $$ BEGIN RAISE EXCEPTION 'Restore a backup to preserve graduation and activity history'; END $$;
-- +goose StatementEnd
