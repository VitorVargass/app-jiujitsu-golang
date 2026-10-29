import test from "node:test";
import assert from "node:assert/strict";
import {
  academyAccesses,
  entryAccesses,
  automaticAccess,
} from "../src/services/access.ts";

const academy = (id, roles, status = "active") => ({
  id,
  roles,
  status,
  name: "Academia " + id,
  code: id,
  membership_id: id,
  timezone: "America/Sao_Paulo",
  belt: "Faixa Branca",
});
test("login único identifica o único acesso real sem informar área", () => {
  assert.equal(automaticAccess([academy("a", ["admin"])]).role, "admin");
  assert.equal(automaticAccess([academy("b", ["student"])]).role, "student");
});

test("perfil duplo sem escolha anterior apresenta as duas opções", () => {
  const academies = [academy("a", ["admin", "student"])];
  assert.equal(automaticAccess(academies), undefined);
  assert.deepEqual(
    entryAccesses(academies).map((item) => item.role),
    ["admin", "student"],
  );
});

test("login único lembra somente uma escolha ainda permitida para a conta", () => {
  const academies = [academy("a", ["admin", "student"])];
  assert.equal(
    automaticAccess(academies, undefined, { academyId: "a", role: "student" })
      .role,
    "student",
  );
  assert.equal(
    automaticAccess(academies, undefined, {
      academyId: "invalid",
      role: "admin",
    }),
    undefined,
  );
  assert.equal(
    automaticAccess([academy("a", ["student"])], undefined, {
      academyId: "a",
      role: "admin",
    }).role,
    "student",
  );
});

test("acessos de perfis e academias diferentes ficam disponíveis após autenticar", () => {
  const academies = [academy("a", ["admin"]), academy("b", ["student"])];
  assert.equal(automaticAccess(academies), undefined);
  assert.equal(entryAccesses(academies).length, 2);
});

test("gestor com uma academia entra direto", () => {
  const target = automaticAccess([academy("a", ["admin"])], "admin");
  assert.equal(target.academy.id, "a");
  assert.equal(target.role, "admin");
});
test("aluno com uma academia entra no portal, inclusive se a tela estava como gestor", () => {
  const academies = [academy("a", ["student"])];
  assert.equal(automaticAccess(academies, "student").role, "student");
  assert.equal(automaticAccess(academies, "admin").role, "student");
});
test("mesma conta com dois perfis respeita a área escolhida", () => {
  const academies = [academy("a", ["admin", "student"])];
  assert.equal(automaticAccess(academies, "admin").role, "admin");
  assert.equal(automaticAccess(academies, "student").role, "student");
});
test("duas academias sem escolha anterior exigem seleção", () => {
  assert.equal(
    automaticAccess(
      [academy("a", ["admin"]), academy("b", ["admin"])],
      "admin",
    ),
    undefined,
  );
});
test("última academia válida é reutilizada sem nova seleção", () => {
  const academies = [academy("a", ["admin"]), academy("b", ["admin"])];
  assert.equal(
    automaticAccess(academies, "admin", { academyId: "b", role: "admin" })
      .academy.id,
    "b",
  );
});
test("trocar a área não reaproveita outro perfil por engano", () => {
  const academies = [academy("a", ["admin", "student"])];
  assert.equal(
    automaticAccess(academies, "student", { academyId: "a", role: "admin" })
      .role,
    "student",
  );
});
test("cada área considera somente suas próprias academias", () => {
  const academies = [academy("a", ["admin"]), academy("b", ["student"])];
  assert.equal(automaticAccess(academies, "admin").academy.id, "a");
  assert.equal(automaticAccess(academies, "student").academy.id, "b");
  assert.equal(entryAccesses(academies, "student").length, 1);
});
test("preferência antiga ou forjada não concede acesso", () => {
  const academies = [academy("a", ["student"]), academy("b", ["student"])];
  assert.equal(
    automaticAccess(academies, "student", { academyId: "c", role: "student" }),
    undefined,
  );
  assert.equal(
    automaticAccess(academies, "student", { academyId: "a", role: "admin" }),
    undefined,
  );
});
test("gestão bloqueada não é restaurada", () => {
  const academies = [
    academy("a", ["admin"], "blocked"),
    academy("b", ["admin"]),
  ];
  assert.equal(
    automaticAccess(academies, "admin", { academyId: "a", role: "admin" })
      .academy.id,
    "b",
  );
  assert.equal(academyAccesses([academies[0]]).length, 0);
});
test("aluno inativo ainda pode consultar seu portal financeiro", () => {
  assert.equal(
    automaticAccess([academy("a", ["student"], "blocked")], "student").role,
    "student",
  );
});
test("conta nova ou apenas professor legado não recebe um perfil inventado", () => {
  assert.equal(automaticAccess([], "admin"), undefined);
  assert.equal(academyAccesses([academy("a", ["teacher"])]).length, 0);
});

test("responsável ativo usa o portal do aluno sem virar gestor",()=>{
 assert.deepEqual(academyAccesses([academy("family",["guardian"])]).map(x=>x.role),["student"]);
 assert.equal(automaticAccess([academy("family",["guardian"])])?.role,"student");
 assert.equal(academyAccesses([academy("family",["guardian"],"blocked")]).length,0);
 assert.deepEqual(academyAccesses([academy("family",["student","guardian"])]).map(x=>x.role),["student"]);
});
