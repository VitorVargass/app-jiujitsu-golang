import type { Class, Schedule } from "../../types";

export type TimetableEntry = { item: Class; schedule: Schedule };
/** Keep simultaneous classes; order by time, name and stable schedule ID. */
export function timetableDays(items: Class[]): TimetableEntry[][] {
  const days: TimetableEntry[][] = Array.from({ length: 7 }, () => []);
  for (const item of items)
    for (const schedule of item.schedules ?? []) {
      if (
        Number.isInteger(schedule.weekday) &&
        schedule.weekday >= 0 &&
        schedule.weekday < 7
      ) {
        days[schedule.weekday].push({ item, schedule });
      }
    }
  for (const entries of days)
    entries.sort(
      (a, b) =>
        a.schedule.start_time
          .slice(0, 5)
          .localeCompare(b.schedule.start_time.slice(0, 5)) ||
        a.item.name.localeCompare(b.item.name) ||
        a.schedule.id.localeCompare(b.schedule.id),
    );
  return days;
}
