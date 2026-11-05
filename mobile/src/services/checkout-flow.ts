import type { Checkout } from "../types/billing";

export function checkoutExpired(result: Checkout, now = Date.now()): boolean {
  if (result.expired) return true;
  if (!result.expires_at) return false;
  const expires = Date.parse(result.expires_at);
  return !Number.isFinite(expires) || expires <= now;
}

/** Payment starts only on an explicit click; only bank-confirmed results mark it paid. */
export async function beginInvoiceCheckout(
  request: () => Promise<Checkout>,
  open: (url: string) => Promise<void>,
): Promise<Checkout> {
  const result = await request();
  if (
    result.status === "waiting" &&
    result.url &&
    !result.customer_changed &&
    !checkoutExpired(result)
  ) {
    checkoutURL(result.url);
    await open(result.url);
  }
  return result;
}

export function checkoutURL(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.host !== "checkout.infinitepay.io" ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error(
      "O endereço do pagamento é inválido. Atualize a mensalidade e tente novamente.",
    );

  return value;
}
