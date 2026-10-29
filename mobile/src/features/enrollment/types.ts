import type { Catalog } from "../../types/billing";
export type LinkSettings = {
  token?: string;
  enabled: boolean;
  due_day: number;
  modality_ids: string[];
  plan_ids: string[];
};
export type EnrollmentPreview = {
  academy_id: string;
  academy_name: string;
  timezone: string;
  due_day: number;
  first_due: string;
  modalities: Catalog[];
  plans: Catalog[];
  available_modality_ids: string[];
};
export type EnrollmentPayload = {
  name: string;
  cpf: string;
  birth_date: string;
  phone: string;
  alternate_phone: string;
  guardian_cpf: string;
  guardian_birth_date: string;
  plan_id: string;
  modality_details: { modality_id: string; belt: string; degrees: number }[];
  expected_amount_cents: number;
  due_day?: number;
};
export type EnrollmentResult = {
  id: string;
  status: "active" | "pending" | "approved" | "rejected";
  academy_id: string;
  student_id?: string;
  first_due?: string;
};
export type EnrollmentRequest = EnrollmentResult & {
  student_name: string;
  academy_name?: string;
  account_name: string;
  account_email: string;
  payload: EnrollmentPayload;
  is_minor: boolean;
  archived_at?: string;
  student_status: string;
};
