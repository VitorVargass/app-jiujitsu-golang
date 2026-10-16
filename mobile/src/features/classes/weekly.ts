import { Schedule } from "../../types";

export type WeeklyGroup = {
  key: string;
  days: number[];
  times: string;
  duration: string;
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
  duration: "60",
});

export function parseTimes(value: string): string[] {
  const parts = value
    .split(/[,;\n]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length)
    throw new Error("Informe pelo menos um horário, como 19:00, 20:00.");
  const times = parts.map((part) => {
    const match = /^(\d{1,2})(?:(?::|h)(\d{2})?)?$/.exec(part.toLowerCase());
    if (!match || Number(match[1]) > 23 || Number(match[2] ?? 0) > 59)
      throw new Error(
        "Confira os horários. Use, por exemplo, 07:00, 19:00, 20:30.",
      );
    return match[1].padStart(2, "0") + ":" + (match[2] ?? "00");
  });
  if (new Set(times).size !== times.length)
    throw new Error("Há um horário repetido na mesma linha.");
  return times.sort();
}
export function expandWeekly(groups: WeeklyGroup[]): WeeklyInput[] {
  const result: WeeklyInput[] = [],
    seen = new Set<string>();
  for (const [index, group] of groups.entries()) {
    if (!group.days.length)
      throw new Error("Selecione os dias da linha " + (index + 1) + ".");
    if (
      !/^\d+$/.test(group.duration) ||
      Number(group.duration) < 15 ||
      Number(group.duration) > 240
    )
      throw new Error("A duração deve ser de 15 a 240 minutos.");
    for (const day of orderedDays.filter((d) => group.days.includes(d))) {
      for (const time of parseTimes(group.times)) {
        const key = day + "-" + time;
        if (seen.has(key))
          throw new Error(
            "O horário " +
              time +
              " de " +
              fullDays[day].toLowerCase() +
              " aparece em duas linhas.",
          );
        seen.add(key);
        result.push({
          weekday: day,
          start_time: time,
          duration_minutes: Number(group.duration),
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
    { days: number[]; time: string; duration: number }
  >();
  for (const item of schedules) {
    const time = item.start_time.slice(0, 5),
      key = time + "/" + item.duration_minutes;
    const group = byTime.get(key) ?? {
      days: [],
      time,
      duration: item.duration_minutes,
    };
    if (!group.days.includes(item.weekday)) group.days.push(item.weekday);
    byTime.set(key, group);
  }
  const combined = new Map<string, WeeklyGroup>();
  for (const group of byTime.values()) {
    const days = orderedDays.filter((d) => group.days.includes(d));
    const key = days.join(",") + "/" + group.duration;
    const existing = combined.get(key);
    if (existing)
      existing.times = [...existing.times.split(", "), group.time]
        .sort()
        .join(", ");
    else
      combined.set(key, {
        key,
        days,
        times: group.time,
        duration: String(group.duration),
      });
  }
  return [...combined.values()].sort(
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
