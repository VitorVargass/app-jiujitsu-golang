import test from "node:test";
import assert from "node:assert/strict";
import {
  beginInvoiceCheckout,
  checkoutURL,
  checkoutExpired,
} from "../src/services/checkout-flow.ts";

test("link vencido nunca abre o checkout mesmo com status waiting em cache", async () => {
  for (const expiry of [
    { expired: true },
    { expires_at: "2000-01-01T00:00:00Z" },
    { expires_at: "invalid" },
  ]) {
    let opened = false;
    await beginInvoiceCheckout(
      async () => ({ status: "waiting", url: "https://checkout.infinitepay.io/old", amount_cents: 100, ...expiry }),
      async () => { opened = true; },
    );
    assert.equal(opened, false);
  }
  const checkout = { status: "waiting", amount_cents: 100, expires_at: "2030-01-01T00:00:00Z" };
  const deadline = Date.parse(checkout.expires_at);
  assert.equal(checkoutExpired(checkout, deadline - 1), false);
  assert.equal(checkoutExpired(checkout, deadline), true);
});

test("Pagar pede um checkout e abre a InfinitePay sem registrar baixa manual", async () => {
  const calls = [];
  const result = {
    status: "waiting",
    url: "https://checkout.infinitepay.io/academy/order",
    amount_cents: 15000,
  };
  assert.equal(
    await beginInvoiceCheckout(
      async () => {
        calls.push("checkout");
        return result;
      },
      async (url) => calls.push(url),
    ),
    result,
  );
  assert.deepEqual(calls, ["checkout", result.url]);
  assert.equal(result.status, "waiting");
});

test("renovação abre apenas o novo link devolvido pela API", async () => {
  const opened = [];
  const renewed = { status: "waiting", amount_cents: 1000,
    url: "https://checkout.infinitepay.io/new", expires_at: "2099-01-01T00:00:00Z" };
  assert.equal(await beginInvoiceCheckout(async () => renewed, async (url) => opened.push(url)), renewed);
  assert.deepEqual(opened, [renewed.url]);
});
test("estados de conferência e pago não abrem outro checkout", async () => {
  for (const status of ["paid", "review"]) {
    let opened = false;
    const result = await beginInvoiceCheckout(
      async () => ({
        status,
        amount_cents: 15000,
        url: "https://checkout.infinitepay.io/old",
      }),
      async () => {
        opened = true;
      },
    );
    assert.equal(result.status, status);
    assert.equal(opened, false);
  }
});
test("erro de emissão preserva o erro sem abrir o navegador nem confirmar pagamento", async () => {
  let opened = false;
  const failure = new Error("Integração indisponível");
  await assert.rejects(
    () =>
      beginInvoiceCheckout(
        async () => {
          throw failure;
        },
        async () => {
          opened = true;
        },
      ),
    failure,
  );
  assert.equal(opened, false);
});
test("redirecionamentos fora da InfinitePay são recusados", async () => {
  for (const url of [
    "javascript:alert(1)",
    "https://evil.example/pay",
    "https://checkout.infinitepay.io.evil.example/pay",
    "http://checkout.infinitepay.io/pay",
    "https://user@checkout.infinitepay.io/pay",
  ]) {
    let opened = false;
    await assert.rejects(() =>
      beginInvoiceCheckout(
        async () => ({ status: "waiting", url, amount_cents: 100 }),
        async () => {
          opened = true;
        },
      ),
    );
    assert.equal(opened, false);
  }
});

test("link salvo pode ser copiado ou consultado sem emitir outra cobrança", () => {
  const saved = "https://checkout.infinitepay.io/academy/original";
  assert.equal(checkoutURL(saved), saved);
  for (const invalid of [
    "javascript:alert(1)",
    "https://checkout.infinitepay.io.evil.test/old",
    "https://user@checkout.infinitepay.io/old",
  ]) {
    assert.throws(() => checkoutURL(invalid));
  }
});
