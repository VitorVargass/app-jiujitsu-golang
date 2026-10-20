-- +goose Up
ALTER TABLE students ADD COLUMN started_on date;
UPDATE students s SET started_on=(s.created_at AT TIME ZONE a.timezone)::date FROM academies a WHERE a.id=s.academy_id;
ALTER TABLE students ALTER COLUMN started_on SET NOT NULL;
-- +goose StatementBegin
CREATE FUNCTION default_student_start_date() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.started_on IS NULL THEN
  SELECT (NEW.created_at AT TIME ZONE timezone)::date INTO NEW.started_on FROM academies WHERE id=NEW.academy_id;
 END IF;
 RETURN NEW;
END $$;
-- +goose StatementEnd
CREATE TRIGGER student_start_date_insert BEFORE INSERT ON students FOR EACH ROW EXECUTE FUNCTION default_student_start_date();
-- +goose Down
DROP TRIGGER student_start_date_insert ON students;
DROP FUNCTION default_student_start_date();
ALTER TABLE students DROP COLUMN started_on;
