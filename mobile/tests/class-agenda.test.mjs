import { test } from "node:test";
import assert from "node:assert/strict";
import { timetableDays } from "../src/features/classes/timetable-data.ts";
const schedule = (id, weekday, start_time) => ({
  id,
  weekday,
  start_time,
  duration_minutes: 60,
  class_id: "class",
});
const turma = (id, name, schedules, active = true) => ({
  id,
  name,
  schedules,
  active,
});
test("agenda diária preserva aulas simultâneas e ordena horários sem alterar cache", () => {
  const items = [
    turma("b", "No-Gi", [
      schedule("night", 2, "19:00:00"),
      schedule("morning", 2, "07:00:00"),
    ]),
    turma("a", "Iniciantes", [schedule("parallel", 2, "19:00:00")]),
  ];
  const before = JSON.stringify(items);
  assert.deepEqual(
    timetableDays(items)[2].map((e) => e.schedule.id),
    ["morning", "parallel", "night"],
  );
  assert.equal(JSON.stringify(items), before);
});
test("contagem semanal respeita domingos, sábados e o filtro recebido", () => {
  const items = [
    turma("a", "Jiu", [
      schedule("sunday", 0, "10:00"),
      schedule("saturday", 6, "09:00"),
    ]),
    turma("b", "Pausada", [schedule("paused", 0, "11:00")], false),
  ];
  assert.deepEqual(
    timetableDays(items.filter((c) => c.active)).map((day) => day.length),
    [1, 0, 0, 0, 0, 0, 1],
  );
  assert.equal(timetableDays(items)[0][1].item.active, false);
});
test("turmas sem horários não viram aulas fictícias na agenda", () => {
  assert.deepEqual(
    timetableDays([turma("a", "Sem horário", [])]).map((day) => day.length),
    [0, 0, 0, 0, 0, 0, 0],
  );
});
