import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNext } from "../src/services/safe-next.ts";
test("assinatura preserva retorno e academia após login sem aceitar destinos externos", () => {
  const id = "3942db9f-21b3-4d04-a526-3988c3247631";
  const next =
    "/subscription?academy_id=" +
    id +
    "&order_nsu=" +
    id +
    "&transaction_nsu=tx-123&slug=checkout";
  assert.equal(safeNext(next), next);
  assert.equal(safeNext("/subscription"), "/subscription");
  for (const invalid of [
    "/subscription?next=https://evil.test",
    "//evil.test/subscription",
    "/subscription?academy_id=bad",
    "/subscription?slug=x&slug=y",
    "/subscription?slug=%0a",
  ]) {
    assert.equal(safeNext(invalid), "/entry");
  }
});
