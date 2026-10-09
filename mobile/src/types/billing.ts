export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};
export type Billing = {
  enabled: boolean;
  amount_cents: number;
  due_day: number;
  first_month: string;
  payer_name: string;
  payer_document: string;
};
export type Student = {
  id: string;
  academy_id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  status: "active" | "inactive";
  belt: string;
  student_code: string;
  plan_id: string;
  modality_ids: string[];
  billing: Billing | null;
};
export type Catalog = {
  id: string;
  name: string;
  active: boolean;
  amount_cents?: number;
  modality_ids?: string[];
};
export type Invoice = {
  id: string;
  student_id: string;
  student_name: string;
  competence: string;
  due_date: string;
  amount_cents: number;
  status: "open" | "overdue" | "paid" | "cancelled";
  paid_at: string | null;
};
export type Pix = {
  status: "waiting" | "paid";
  payload?: string;
  expires_at?: string;
  environment: "sandbox" | "production";
};
export const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
export const statusLabel = {
  open: "Em aberto",
  overdue: "Vencida",
  paid: "Paga",
  cancelled: "Cancelada",
};
export function parseMoney(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized))
    throw new Error("Informe um valor como 200,00.");
  const [whole, part = ""] = normalized.split(".");
  return Number(whole) * 100 + Number(part.padEnd(2, "0"));
}
export const monthNow = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .split("/")
    .reverse()
    .join("-");
