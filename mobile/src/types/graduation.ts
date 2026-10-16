import type { BeltOption } from "./billing";
export function degreeLabel(degrees = 0) {
  return degrees === 0
    ? "Sem grau"
    : degrees + (degrees === 1 ? " grau" : " graus");
}
export function rankLabel(belt: string, degrees = 0) {
  return belt ? belt + " • " + degreeLabel(degrees) : "Sem graduação";
}
export const bjjBelts: BeltOption[] = [
  { label: "Faixa Branca", colors: ["#F5F5F5"] },
  { label: "Faixa Cinza e Branca", colors: ["#929292", "#F5F5F5"] },
  { label: "Faixa Cinza", colors: ["#929292"] },
  { label: "Faixa Cinza e Preta", colors: ["#929292", "#151515"] },
  { label: "Faixa Amarela e Branca", colors: ["#E5C432", "#F5F5F5"] },
  { label: "Faixa Amarela", colors: ["#E5C432"] },
  { label: "Faixa Amarela e Preta", colors: ["#E5C432", "#151515"] },
  { label: "Faixa Laranja e Branca", colors: ["#DF842F", "#F5F5F5"] },
  { label: "Faixa Laranja", colors: ["#DF842F"] },
  { label: "Faixa Laranja e Preta", colors: ["#DF842F", "#151515"] },
  { label: "Faixa Verde e Branca", colors: ["#368552", "#F5F5F5"] },
  { label: "Faixa Verde", colors: ["#368552"] },
  { label: "Faixa Verde e Preta", colors: ["#368552", "#151515"] },
  { label: "Faixa Azul", colors: ["#386DCE"] },
  { label: "Faixa Roxa", colors: ["#885BB0"] },
  { label: "Faixa Marrom", colors: ["#855B3A"] },
  { label: "Faixa Preta", colors: ["#151515"] },
  { label: "Faixa Vermelha e Preta", colors: ["#BD3434", "#151515"] },
  { label: "Faixa Vermelha e Branca", colors: ["#BD3434", "#F5F5F5"] },
  { label: "Faixa Vermelha", colors: ["#BD3434"] },
];
export const beltPalette = [
  { name: "Branca", color: "#F5F5F5" },
  { name: "Cinza", color: "#929292" },
  { name: "Amarela", color: "#E5C432" },
  { name: "Laranja", color: "#DF842F" },
  { name: "Verde", color: "#368552" },
  { name: "Azul", color: "#386DCE" },
  { name: "Roxa", color: "#885BB0" },
  { name: "Marrom", color: "#855B3A" },
  { name: "Preta", color: "#151515" },
  { name: "Vermelha", color: "#BD3434" },
];
export const bjjAdultBelts = bjjBelts.filter((b) =>
  [
    "Faixa Branca",
    "Faixa Azul",
    "Faixa Roxa",
    "Faixa Marrom",
    "Faixa Preta",
    "Faixa Vermelha e Preta",
    "Faixa Vermelha e Branca",
    "Faixa Vermelha",
  ].includes(b.label),
);
export const bjjKidsBelts = bjjBelts.slice(0, 13);
