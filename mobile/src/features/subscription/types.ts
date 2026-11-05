import type { Checkout } from "../../types/billing";
export type SubscriptionCheckout = Checkout & { retryable?: boolean };
export type SubscriptionCycle = {
  plan_id?: string;
  active_students?: number | null;
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
  trial_ends_at?: string | null;
  selected_plan_id?: string | null;
  plan?: SubscriptionPlan;
  plans?: SubscriptionPlan[];
  active_students?: number;
  enabled: boolean;
  renewal_soon: boolean;
  amount_cents: number;
  status: "disabled" | "trial" | "active" | "grace" | "overdue" | "cancelled";
  restricted: boolean;
  renewal_enabled: boolean;
  paid_until: string | null;
  grace_until: string | null;
  cycle: SubscriptionCycle | null;
  checkout?: SubscriptionCheckout;
};
export type SubscriptionPlan = {
  id: string;
  name: string;
  min_students: number;
  max_students: number | null;
  amount_cents: number;
};

export function planRange(plan: SubscriptionPlan) {
  return plan.max_students === null
    ? `A partir de ${plan.min_students.toLocaleString("pt-BR")} alunos ativos`
    : plan.min_students === 0
      ? `Até ${plan.max_students} alunos ativos`
      : `De ${plan.min_students} a ${plan.max_students} alunos ativos`;
}
export const subscriptionLabel: Record<Subscription["status"], string> = {
  disabled: "Cobrança ainda não ativada",
  trial: "Teste grátis de 5 dias",
  active: "Assinatura ativa",
  grace: "Pagamento pendente · prazo de tolerância",
  overdue: "Pagamento em atraso",
  cancelled: "Assinatura encerrada",
};
export function subscriptionDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "—";
}
