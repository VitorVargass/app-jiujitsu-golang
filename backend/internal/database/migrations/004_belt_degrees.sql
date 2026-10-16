-- +goose Up
ALTER TABLE student_modalities ADD COLUMN degrees smallint NOT NULL DEFAULT 0;
ALTER TABLE student_modalities ADD CONSTRAINT student_modalities_degrees_check
  CHECK (degrees BETWEEN 0 AND 4 AND (belt <> '' OR degrees = 0));

-- +goose StatementBegin
CREATE FUNCTION student_rank_label(belt_name text, degree_count integer)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN belt_name = '' THEN 'Sem graduação'
    WHEN degree_count = 0 THEN belt_name
    ELSE belt_name || ' • ' || degree_count::text ||
      CASE WHEN degree_count = 1 THEN ' grau' ELSE ' graus' END
  END
$$;
-- +goose StatementEnd
-- Old enrollments keep their belt and start at zero degrees; billing and history are unchanged.

-- +goose Down
-- +goose StatementBegin
DO $$ BEGIN RAISE EXCEPTION 'Restore a backup instead of discarding belt degrees'; END $$;
-- +goose StatementEnd
