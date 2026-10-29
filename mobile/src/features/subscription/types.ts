import type { Checkout } from "../../types/billing";
export type SubscriptionCheckout = Checkout & { retryable?: boolean };
export type SubscriptionCycle = {
  checkout_state?: string;
  review_reason?: string;
  id: string;
  period_start: string;
  period_end: string;
  amount_cents: number;
  state: "open" | "paid";
  paid_at: string | null;
};
export type Subscription = {
  enabled: boolean;
  renewal_soon: boolean;
  amount_cents: number;
  status: "disabled" | "active" | "grace" | "overdue" | "cancelled";
  restricted: boolean;
  renewal_enabled: boolean;
  paid_until: string | null;
  grace_until: string | null;
  cycle: SubscriptionCycle | null;
  checkout?: SubscriptionCheckout;
};
export const subscriptionLabel: Record<Subscription["status"], string> = {
  disabled: "Cobrança ainda não ativada",
  active: "Assinatura ativa",
  grace: "Pagamento pendente · prazo de tolerância",
  overdue: "Pagamento em atraso",
  cancelled: "Assinatura encerrada",
};
export function subscriptionDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "—";
}
