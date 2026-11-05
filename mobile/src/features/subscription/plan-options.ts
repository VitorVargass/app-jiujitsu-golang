import type { SubscriptionPlan } from "./types";
export const planOptions: SubscriptionPlan[] = [
  {
    id: "essential",
    name: "Essencial",
    min_students: 0,
    max_students: 200,
    amount_cents: 15000,
  },
  {
    id: "professional",
    name: "Profissional",
    min_students: 201,
    max_students: 999,
    amount_cents: 25000,
  },
  {
    id: "large",
    name: "Grande academia",
    min_students: 1000,
    max_students: null,
    amount_cents: 45000,
  },
];
