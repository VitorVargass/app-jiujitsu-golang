import type { Checkout } from "../types/billing";

/** Payment starts only on an explicit click; only bank-confirmed results mark it paid. */
export async function beginInvoiceCheckout(
  request: () => Promise<Checkout>,
  open: (url: string) => Promise<void>,
): Promise<Checkout> {
  const result = await request();
  if (result.status === "waiting" && result.url) {
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
