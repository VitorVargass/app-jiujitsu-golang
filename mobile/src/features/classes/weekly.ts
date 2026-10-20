import type { Schedule } from "../../types";

export type WeeklyGroup = {
  key: string;
  days: number[];
  times: string;
  ends: string;
};
export type WeeklyInput = {
  weekday: number;
  start_time: string;
  duration_minutes: number;
};
export const orderedDays = [1, 2, 3, 4, 5, 6, 0];
export const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const fullDays = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];
export const emptyGroup = (key = "first"): WeeklyGroup => ({
  key,
  days: [],
  times: "",
  ends: "",
});

export function parseTimes(value: string, unique = true): string[] {
  const parts = value
    .split(/[,;\n]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) throw new Error("Informe os horários de início e fim.");
  const times = parts.map((part) => {
    const match = /^(\d{1,2})(?:(?::|h)(\d{2})?)?$/.exec(part.toLowerCase());
    if (!match || Number(match[1]) > 23 || Number(match[2] ?? 0) > 59)
      throw new Error(
        "Confira os horários. Use, por exemplo, 07:00, 19:00, 20:30.",
      );
    return match[1].padStart(2, "0") + ":" + (match[2] ?? "00");
  });
  if (unique && new Set(times).size !== times.length)
    throw new Error("Há um horário repetido na mesma linha.");
  // Keep the entered order: each start is paired with the end at the same position.
  return times;
}
const minutes = (value: string) =>
  Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
export function endTime(start: string, duration: number) {
  const total = (minutes(start) + duration) % 1440;
  return (
    String(Math.floor(total / 60)).padStart(2, "0") +
    ":" +
    String(total % 60).padStart(2, "0")
  );
}
export function scheduleRange(
  schedule: Pick<Schedule, "start_time" | "duration_minutes">,
) {
  const start = schedule.start_time.slice(0, 5);
  const end = endTime(start, schedule.duration_minutes);
  return start + "–" + end + (minutes(end) < minutes(start) ? " (+1 dia)" : "");
}
export function weeklyRanges(group: WeeklyGroup) {
  const starts = parseTimes(group.times),
    ends = parseTimes(group.ends, false);
  return starts.map(
    (start, i) =>
      start +
      "–" +
      ends[i] +
      (minutes(ends[i]) < minutes(start) ? " (+1 dia)" : ""),
  );
}
export function expandWeekly(groups: WeeklyGroup[]): WeeklyInput[] {
  const result: WeeklyInput[] = [],
    seen = new Set<string>();
  for (const [index, group] of groups.entries()) {
    if (!group.days.length)
      throw new Error("Selecione os dias da linha " + (index + 1) + ".");
    const starts = parseTimes(group.times),
      ends = parseTimes(group.ends, false);
    if (starts.length !== ends.length)
      throw new Error(
        "Informe um horário de fim para cada início, na mesma ordem.",
      );
    const ranges = starts
      .map((start, i) => {
        const duration = (minutes(ends[i]) - minutes(start) + 1440) % 1440;
        if (duration < 15 || duration > 240)
          throw new Error(
            "O intervalo entre início e fim deve ser de 15 minutos a 4 horas.",
          );
        return { start, duration };
      })
      .sort((a, b) => a.start.localeCompare(b.start));
    for (const day of orderedDays.filter((d) => group.days.includes(d))) {
      for (const range of ranges) {
        const key = day + "-" + range.start;
        if (seen.has(key))
          throw new Error(
            "O horário " +
              range.start +
              " de " +
              fullDays[day].toLowerCase() +
              " aparece em duas linhas.",
          );
        seen.add(key);
        result.push({
          weekday: day,
          start_time: range.start,
          duration_minutes: range.duration,
        });
      }
    }
  }
  if (!result.length || result.length > 70)
    throw new Error("Informe de 1 a 70 horários semanais.");
  return result;
}
export function groupWeekly(schedules: Schedule[]): WeeklyGroup[] {
  const byTime = new Map<
    string,
    { days: number[]; start: string; end: string }
  >();
  for (const item of schedules) {
    const start = item.start_time.slice(0, 5),
      key = start + "/" + item.duration_minutes;
    const group = byTime.get(key) ?? {
      days: [],
      start,
      end: endTime(start, item.duration_minutes),
    };
    if (!group.days.includes(item.weekday)) group.days.push(item.weekday);
    byTime.set(key, group);
  }
  const combined = new Map<
    string,
    { days: number[]; ranges: { start: string; end: string }[] }
  >();
  for (const group of byTime.values()) {
    const days = orderedDays.filter((d) => group.days.includes(d)),
      key = days.join(",");
    const item = combined.get(key) ?? { days, ranges: [] };
    item.ranges.push({ start: group.start, end: group.end });
    combined.set(key, item);
  }
  return [...combined.entries()]
    .map(([key, group]) => {
      const ranges = group.ranges.sort((a, b) =>
        a.start.localeCompare(b.start),
      );
      return {
        key,
        days: group.days,
        times: ranges.map((r) => r.start).join(", "),
        ends: ranges.map((r) => r.end).join(", "),
      };
    })
    .sort(
      (a, b) =>
        orderedDays.indexOf(a.days[0]) - orderedDays.indexOf(b.days[0]) ||
        a.times.localeCompare(b.times),
    );
}
export const daysLabel = (days: number[]) =>
  orderedDays
    .filter((d) => days.includes(d))
    .map((d) => dayNames[d])
    .join(" · ");
