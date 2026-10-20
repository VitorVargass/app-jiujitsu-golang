import type { Academy } from "../types";

export type AccessRole = "admin" | "student";
export type AccessPreference = { academyId: string; role: AccessRole };
export type AcademyAccess = { academy: Academy; role: AccessRole };

export function accessRole(value: unknown): AccessRole | undefined {
  return value === "admin" || value === "student" ? value : undefined;
}
export function accessHome(role: AccessRole) {
  return role === "admin" ? "/academy" : "/student";
}
export function academyAccesses(academies: Academy[]): AcademyAccess[] {
  return academies.flatMap((academy) => [
    ...(academy.roles.includes("admin") && academy.status === "active"
      ? [{ academy, role: "admin" as const }]
      : []),
    ...(academy.roles.includes("student")
      ? [{ academy, role: "student" as const }]
      : []),
  ]);
}
export function entryAccesses(academies: Academy[], role?: AccessRole) {
  const all = academyAccesses(academies);
  const preferred = role ? all.filter((item) => item.role === role) : [];
  // A destination may request an area; actual permissions determine the available options.
  return preferred.length ? preferred : all;
}
export function automaticAccess(
  academies: Academy[],
  role?: AccessRole,
  saved?: AccessPreference | null,
): AcademyAccess | undefined {
  const options = entryAccesses(academies, role);
  const previous =
    saved &&
    options.find(
      (item) => item.academy.id === saved.academyId && item.role === saved.role,
    );
  return previous || (options.length === 1 ? options[0] : undefined);
}
