import type { Attendance } from "../../types";
import type { Page } from "../../types/billing";

export function attendanceDay(item: Attendance, zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(item.starts_at ?? item.checked_in_at));
  return ["year", "month", "day"]
    .map((type) => parts.find((p) => p.type === type)?.value ?? "")
    .join("-");
}
export function groupAttendanceDays(items: Attendance[], zone: string) {
  const days = new Map<string, Attendance[]>();
  for (const item of items) {
    const key = attendanceDay(item, zone);
    const records = days.get(key) ?? [];
    records.push(item);
    days.set(key, records);
  }
  return days;
}
export function calendarWeeks(month: string): (string | null)[][] {
  const [year, number] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1));
  const total = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from(
    { length: first.getUTCDay() },
    () => null,
  );
  for (let day = 1; day <= total; day++)
    cells.push(month + "-" + String(day).padStart(2, "0"));
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, index) =>
    cells.slice(index * 7, index * 7 + 7),
  );
}
export function attendanceDayLabel(day: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(day + "T12:00:00Z"));
}
// A calendar must include every page, otherwise busy months silently hide training days.
export async function loadAttendanceMonth(
  fetchPage: (page: number) => Promise<Page<Attendance>>,
) {
  const first = await fetchPage(1);
  if (first.page_size < 1)
    throw new Error("Não foi possível carregar o calendário.");
  const items = new Map(first.items.map((item) => [item.id, item]));
  for (let page = 2; page <= Math.ceil(first.total / first.page_size); page++) {
    const next = await fetchPage(page);
    for (const item of next.items) items.set(item.id, item);
  }
  return [...items.values()];
}
