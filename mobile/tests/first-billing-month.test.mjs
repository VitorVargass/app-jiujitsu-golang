import test from "node:test";
import assert from "node:assert/strict";
import { firstBillingMonth } from "../src/features/students/billing-dates.ts";
test("primeira cobrança não nasce vencida e preserva o mês escolhido", () => {
 assert.equal(firstBillingMonth("2026-10",15,"2026-10-28"),"2026-11");
 assert.equal(firstBillingMonth("2026-11",15,"2026-10-28"),"2026-11");
 assert.equal(firstBillingMonth("2026-12",15,"2026-10-28"),"2026-12");
 assert.equal(firstBillingMonth("2026-10",28,"2026-10-28"),"2026-10");
 assert.equal(firstBillingMonth("2028-02",31,"2028-02-29"),"2028-02");
 assert.equal(firstBillingMonth("2026-12",1,"2026-12-31"),"2027-01");
});
