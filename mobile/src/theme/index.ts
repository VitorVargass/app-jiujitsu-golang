export const colors = {
  background: "#080B17",
  surface: "#121627",
  surfaceRaised: "#191B33",
  border: "#262B44",
  primary: "#7948FF",
  primaryLight: "#B29AFF",
  text: "#F4F3FA",
  muted: "#9A9FB8",
  success: "#22C982",
  danger: "#FF7890",
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
