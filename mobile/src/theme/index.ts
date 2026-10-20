import { brand } from "./brand";

export const accents = {
  brand: {
    color: brand.accentLight,
    soft: brand.accentSoft,
    border: brand.accentBorder,
  },
  slate: { color: "#CED0D7", soft: "#252528", border: "#414146" },
  mint: { color: "#89D2A6", soft: "#18271F", border: "#34513E" },
  blue: { color: "#B4C4DA", soft: "#20252E", border: "#3B4654" },
  amber: { color: "#DBB987", soft: "#2C261F", border: "#544635" },
  lavender: { color: "#C1BBCD", soft: "#26242B", border: "#48434F" },
  coral: { color: "#F78A94", soft: "#301C21", border: "#63343D" },
} as const;
export type Accent = keyof typeof accents;
export const colors = {
  background: brand.background,
  surface: brand.surface,
  surfaceRaised: brand.surfaceRaised,
  border: brand.border,
  borderSubtle: "#29292D",
  primary: brand.accent,
  primaryLight: brand.accentLight,
  onPrimary: brand.onAccent,
  text: brand.text,
  muted: brand.muted,
  success: accents.mint.color,
  warning: accents.amber.color,
  danger: accents.coral.color,
};
export const roleLabel = {
  student: "Aluno",
  teacher: "Professor",
  admin: "Gestor",
};
export const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export function displayTime(date: string, zone = "America/Sao_Paulo") {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}
export function displayDate(date: string, zone = "America/Sao_Paulo") {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: zone,
    day: "2-digit",
    month: "short",
  }).format(new Date(date));
}
