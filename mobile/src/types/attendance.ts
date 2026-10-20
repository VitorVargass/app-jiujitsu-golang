export type LessonOption = {
  phase: "upcoming" | "live" | "ended";
  schedule_id: string;
  date: string;
  class_id: string;
  class_name: string;
  modality_name: string;
  starts_at: string;
  ends_at: string;
  session_id?: string;
  attendance_count: number;
  status: "scheduled" | "open" | "closed" | "cancelled";
  can_record: boolean;
};
export type AttendanceOptions = {
  timezone: string;
  date: string;
  options: LessonOption[];
};
export function academyDate(zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"]
    .map((type) => parts.find((p) => p.type === type)?.value ?? "")
    .join("-");
}
