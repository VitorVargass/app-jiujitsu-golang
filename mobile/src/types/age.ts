const calendar = (zone: string, now: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (key: string) => parts.find((p) => p.type === key)?.value ?? "";
  return get("year") + "-" + get("month") + "-" + get("day");
};
export function ageOn(
  birth: string,
  zone = "America/Sao_Paulo",
  now = new Date(),
): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return null;
  const d = new Date(birth + "T00:00:00Z");
  if (
    !Number.isFinite(d.getTime()) ||
    d.toISOString().slice(0, 10) !== birth ||
    birth < "1900-01-01"
  )
    return null;
  const today = calendar(zone, now);
  if (birth > today) return null;
  const year = Number(today.slice(0, 4));
  const anniversary = new Date(Date.UTC(year, d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
  return year - d.getUTCFullYear() - (today < anniversary ? 1 : 0);
}
export function birthToISO(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 8
    ? digits.slice(4) + "-" + digits.slice(2, 4) + "-" + digits.slice(0, 2)
    : "";
}
export function formatBirth(value: string = "") {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value))
    return value.slice(8) + "/" + value.slice(5, 7) + "/" + value.slice(0, 4);
  const d = value.replace(/\D/g, "").slice(0, 8);
  return (
    d.slice(0, 2) +
    (d.length > 2 ? "/" + d.slice(2, 4) : "") +
    (d.length > 4 ? "/" + d.slice(4) : "")
  );
}
