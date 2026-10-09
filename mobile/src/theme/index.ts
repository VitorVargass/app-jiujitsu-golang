export const colors = {
  background: "#080808",
  surface: "#171717",
  surfaceRaised: "#202020",
  border: "#333333",
  primary: "#FFFFFF",
  primaryLight: "#E0E0E0",
  text: "#FFFFFF",
  muted: "#ADADAD",
  success: "#78B88A",
  danger: "#DF8585",
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
