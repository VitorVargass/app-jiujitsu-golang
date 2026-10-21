import test from "node:test";
import assert from "node:assert/strict";
import { resolveAPIURL } from "../src/services/api-url.ts";

test("portal no container usa a mesma origem para login e API", () => {
  const base = resolveAPIURL({
    configured: "same-origin",
    platform: "web",
    development: false,
  });
  assert.equal(base, "");
  assert.equal(
    new URL(base + "/v1/auth/login", "https://tatamemix.example.test").href,
    "https://tatamemix.example.test/v1/auth/login",
  );
});

test("modo relativo não pode ser usado no aplicativo nativo", () => {
  for (const platform of ["android", "ios"]) {
    assert.throws(
      () =>
        resolveAPIURL({
          configured: "same-origin",
          platform,
          development: false,
        }),
      /URL completa/,
    );
  }
});

test("site separado e aplicativo nativo conservam a URL explícita", () => {
  for (const platform of ["web", "android"]) {
    assert.equal(
      resolveAPIURL({
        configured: "https://api.example.test/",
        platform,
        development: false,
      }),
      "https://api.example.test",
    );
  }
});

test("desenvolvimento continua descobrindo o computador do Expo", () => {
  assert.equal(
    resolveAPIURL({
      configured: "auto",
      platform: "android",
      development: true,
      expoHost: "192.168.1.72:8081",
    }),
    "http://192.168.1.72:8080",
  );
  assert.equal(
    resolveAPIURL({
      configured: "auto",
      platform: "web",
      development: true,
      browserHost: "localhost",
    }),
    "http://localhost:8080",
  );
});
