import test from "node:test";
import assert from "node:assert/strict";
import {
  expandWeekly,
  groupWeekly,
  scheduleRange,
  weeklyRanges,
} from "../src/features/classes/weekly.ts";

const group = (change = {}) => ({
  key: "one",
  days: [2, 4],
  times: "19:00",
  ends: "20:00",
  ...change,
});
const comparable = (items) =>
  items
    .map(({ weekday, start_time, duration_minutes }) => ({
      weekday,
      start_time,
      duration_minutes,
    }))
    .sort(
      (a, b) =>
        a.weekday - b.weekday || a.start_time.localeCompare(b.start_time),
    );

test("terça e quinta das 19h às 20h geram dois horários semanais", () => {
  assert.deepEqual(expandWeekly([group()]), [
    { weekday: 2, start_time: "19:00", duration_minutes: 60 },
    { weekday: 4, start_time: "19:00", duration_minutes: 60 },
  ]);
});
test("vários intervalos preservam os pares mesmo fora de ordem", () => {
  assert.deepEqual(
    expandWeekly([group({ days: [2], times: "20:30, 7", ends: "22, 8:15" })]),
    [
      { weekday: 2, start_time: "07:00", duration_minutes: 75 },
      { weekday: 2, start_time: "20:30", duration_minutes: 90 },
    ],
  );
});
test("editar horários existentes preserva dias, intervalos e durações diferentes", () => {
  const schedules = [
    { weekday: 2, start_time: "19:00:00", duration_minutes: 60 },
    { weekday: 4, start_time: "19:00:00", duration_minutes: 60 },
    { weekday: 2, start_time: "19:30:00", duration_minutes: 30 },
    { weekday: 4, start_time: "19:30:00", duration_minutes: 30 },
    { weekday: 5, start_time: "23:30:00", duration_minutes: 90 },
  ];
  const grouped = groupWeekly(schedules);
  assert.deepEqual(
    comparable(expandWeekly(grouped)),
    comparable(
      schedules.map((s) => ({ ...s, start_time: s.start_time.slice(0, 5) })),
    ),
  );
  assert.deepEqual(weeklyRanges(grouped.find((g) => g.days.includes(2))), [
    "19:00–20:00",
    "19:30–20:00",
  ]);
});
test("a virada do dia aparece explicitamente no intervalo", () => {
  const slots = expandWeekly([group({ times: "23:30", ends: "01:00" })]);
  assert.equal(slots[0].duration_minutes, 90);
  assert.equal(scheduleRange(slots[0]), "23:30–01:00 (+1 dia)");
  assert.deepEqual(weeklyRanges(group({ times: "23:30", ends: "01:00" })), [
    "23:30–01:00 (+1 dia)",
  ]);
});
test("intervalos incompletos e inválidos não são salvos", () => {
  for (const change of [
    { ends: "" },
    { ends: "20:00, 21:00" },
    { times: "25:00" },
    { ends: "19:00" },
    { ends: "19:10" },
    { ends: "23:01" },
    { days: [] },
  ])
    assert.throws(() => expandWeekly([group(change)]));
});
test("horários duplicados no mesmo dia são recusados", () => {
  assert.throws(
    () => expandWeekly([group(), group({ key: "two" })]),
    /aparece em duas linhas/,
  );
});
test("grade pode reunir todos os dias sem misturar faixas de horário", () => {
  const schedules = expandWeekly([
    group({
      days: [0, 1, 2, 3, 4, 5, 6],
      times: "07:00, 19:00",
      ends: "08:00, 20:00",
    }),
  ]);
  assert.equal(schedules.length, 14);
  assert.deepEqual(
    comparable(expandWeekly(groupWeekly(schedules))),
    comparable(schedules),
  );
});
