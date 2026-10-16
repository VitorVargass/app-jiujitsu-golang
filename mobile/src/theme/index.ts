export const accents = {
  mint: { color: "#7AE7C5", soft: "#15382F", border: "#2D5C4D" },
  blue: { color: "#8DBBFF", soft: "#192F4C", border: "#304E73" },
  amber: { color: "#F6CB80", soft: "#3A2D1C", border: "#665033" },
  lavender: { color: "#C0ACFF", soft: "#2C2544", border: "#51416C" },
  coral: { color: "#FFA39D", soft: "#3D2429", border: "#6D3E45" },
} as const;
export type Accent = keyof typeof accents;
export const colors = {
  background: "#0B1119",
  surface: "#141F2B",
  surfaceRaised: "#1C2A39",
  border: "#2B3A4C",
  borderSubtle: "#202E3D",
  primary: accents.mint.color,
  primaryLight: "#B3F3DE",
  onPrimary: "#0A231C",
  text: "#F2F6FB",
  muted: "#A4B4C7",
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
