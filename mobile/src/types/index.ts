export type Role = "student" | "teacher" | "admin";
export type User = { id: string; name: string; email: string };
export type Academy = {
  id: string;
  name: string;
  code: string;
  timezone: string;
  membership_id: string;
  roles: Role[];
  status: "active" | "blocked";
  belt: string;
};
export type Member = {
  id: string;
  name: string;
  user_id: string;
  status: "active" | "blocked";
  roles: Role[];
  belt: string;
};
export type MembershipRequest = {
  id: string;
  academy_id: string;
  academy_name: string;
  name: string;
  role: "student" | "teacher";
  status: "pending" | "approved" | "rejected";
};
export type Class = {
  id: string;
  name: string;
  teacher_membership_id: string;
  teacher_name: string;
  modality_id: string;
  modality_name: string;
  active: boolean;
};
export type Schedule = {
  id: string;
  class_id: string;
  weekday: number;
  start_time: string;
  duration_minutes: number;
};
export type Session = {
  id: string;
  class_id: string;
  class_name: string;
  teacher_membership_id: string;
  teacher_name: string;
  starts_at: string;
  status: "open" | "closed" | "cancelled";
  attendance_count: number;
};
export type Attendance = {
  id: string;
  session_id: string;
  class_name: string;
  student_name: string;
  belt: string;
  checked_in_at: string;
};
export type CheckinResult = {
  id: string;
  membership_id: string;
  student_name: string;
  belt: string;
  checked_in_at: string;
  duplicate: boolean;
};
export type Dashboard = {
  scope: Role;
  presences_today: number;
  presences_month: number;
  active_students: number;
  received_month_cents: number;
  open_cents: number;
  week: { date: string; count: number }[];
};
export type Device = { id: string; name: string; active: boolean };
export type Credential = {
  student_code: string;
  qr_token: string;
  student_name: string;
  belt: string;
};
