import { test } from "node:test";
import assert from "node:assert/strict";
import { registrationProblem } from "../src/features/auth/registration-validation.ts";

test("cadastro exige senhas idênticas, sem remover espaços da senha", () => {
  assert.equal(registrationProblem("Senha123!", "Senha123!", true), "");
  assert.match(registrationProblem("Senha123!", "Senha123", true), /senhas/);
  assert.match(registrationProblem("Senha123! ", "Senha123!", true), /senhas/);
});
test("cadastro não presume aceite nem ciência de privacidade", () => {
  assert.match(
    registrationProblem("Senha123!", "Senha123!", false),
    /Privacidade/,
  );
});
