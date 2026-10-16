package classes

import (
	"context"
	"github.com/jackc/pgx/v5"
	"tatame/backend/internal/core"
	"time"
)

func validateSchedules(items []ScheduleInput) error {
	if len(items) < 1 || len(items) > 70 {
		return core.E(422, "invalid_schedule", "Informe de 1 a 70 horários semanais.")
	}
	seen := map[string]bool{}
	for _, item := range items {
		at, err := time.Parse("15:04", item.StartTime)
		if err != nil || at.Format("15:04") != item.StartTime || item.Weekday < 0 || item.Weekday > 6 || item.Duration < 15 || item.Duration > 240 {
			return core.E(422, "invalid_schedule", "Confira os dias, horários HH:MM e duração entre 15 e 240 minutos.")
		}
		key := string(rune('0'+item.Weekday)) + item.StartTime
		if seen[key] {
			return core.E(422, "duplicate_schedule", "O mesmo dia e horário foi informado mais de uma vez.")
		}
		seen[key] = true
	}
	return nil
}

func readWeekly(ctx context.Context, tx pgx.Tx, a, c string) ([]Schedule, error) {
	rows, err := tx.Query(ctx, "SELECT id,class_id,weekday,start_time::text,duration_minutes FROM class_schedules WHERE academy_id=$1 AND class_id=$2 AND deleted_at IS NULL ORDER BY weekday,start_time", a, c)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []Schedule{}
	for rows.Next() {
		var item Schedule
		if err = rows.Scan(&item.ID, &item.ClassID, &item.Weekday, &item.StartTime, &item.Duration); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

// Class row is locked before touching weekly slots, matching open/delete.
func saveWeekly(ctx context.Context, tx pgx.Tx, a, c string, items []ScheduleInput) error {
	keep := []string{}
	for _, item := range items {
		var id string
		err := tx.QueryRow(ctx, `INSERT INTO class_schedules(id,academy_id,class_id,weekday,start_time,duration_minutes)
   VALUES($1,$2,$3,$4,$5,$6)
   ON CONFLICT(academy_id,class_id,weekday,start_time) DO UPDATE SET duration_minutes=EXCLUDED.duration_minutes,deleted_at=NULL
   RETURNING id`, core.ID(), a, c, item.Weekday, item.StartTime, item.Duration).Scan(&id)
		if err != nil {
			return err
		}
		keep = append(keep, id)
	}
	_, err := tx.Exec(ctx, "UPDATE class_schedules SET deleted_at=now() WHERE academy_id=$1 AND class_id=$2 AND deleted_at IS NULL AND NOT (id::text=ANY($3::text[]))", a, c, keep)
	return err
}
