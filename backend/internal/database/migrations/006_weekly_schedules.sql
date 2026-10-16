-- +goose Up
-- Removed weekly slots remain available to historical class sessions.
ALTER TABLE class_schedules ADD COLUMN deleted_at timestamptz;
CREATE INDEX class_schedules_available ON class_schedules(academy_id,class_id,weekday,start_time) WHERE deleted_at IS NULL;

-- +goose Down
-- +goose StatementBegin
DO $$ BEGIN RAISE EXCEPTION 'Restore a backup to avoid reactivating removed weekly schedules'; END $$;
-- +goose StatementEnd
