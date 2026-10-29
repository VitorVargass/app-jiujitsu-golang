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

export type GraduationPreset = {
  id: string;
  name: string;
  modalityName: string;
  note: string;
  belts: BeltOption[];
};
const color = Object.fromEntries(beltPalette.map((c) => [c.name, c.color]));
function bands(labels: string[], prefix = "Faixa"): BeltOption[] {
  return labels.map((label) => ({
    label: prefix + " " + label,
    colors: label.split(" e ").map((name) => color[name] ?? "#E8DCC0"),
  }));
}
export const graduationPresets: GraduationPreset[] = [
  {
    id: "bjj-adult",
    name: "Jiu-Jitsu adulto",
    modalityName: "Jiu-Jitsu",
    note: "Faixas adultas e superiores. Confira as regras da sua equipe.",
    belts: bjjAdultBelts,
  },
  {
    id: "bjj-kids",
    name: "Jiu-Jitsu infantil",
    modalityName: "Jiu-Jitsu infantil",
    note: "Branca e grupos cinza, amarelo, laranja e verde.",
    belts: bjjKidsBelts,
  },
  {
    id: "bjj-all",
    name: "Jiu-Jitsu completo",
    modalityName: "Jiu-Jitsu",
    note: "Faixas infantis e adultas no mesmo cadastro.",
    belts: bjjBelts,
  },
  {
    id: "judo",
    name: "Judô",
    modalityName: "Judô",
    note: "Cores de referência da CBJ; ajuste faixas intermediárias da sua academia.",
    belts: bands([
      "Branca",
      "Cinza",
      "Azul",
      "Amarela",
      "Laranja",
      "Verde",
      "Roxa",
      "Marrom",
      "Preta",
      "Vermelha e Branca",
      "Vermelha",
    ]),
  },
  {
    id: "karate-shorin",
    name: "Karatê · Shorin-ryu",
    modalityName: "Karatê",
    note: "Modelo Shidokan do Brasil. Outros estilos podem usar outra sequência.",
    belts: bands([
      "Branca",
      "Amarela",
      "Laranja",
      "Azul",
      "Verde",
      "Roxa",
      "Marrom",
      "Preta",
    ]),
  },
  {
    id: "taekwondo",
    name: "Taekwondo · cores básicas",
    modalityName: "Taekwondo",
    note: "Cores agrupadas da CBTKD. Adicione pontas e Gubs conforme sua escola.",
    belts: bands(["Branca", "Amarela", "Verde", "Azul", "Vermelha", "Preta"]),
  },
  {
    id: "kickboxing",
    name: "Kickboxing",
    modalityName: "Kickboxing",
    note: "Faixas coloridas da CBKB e faixa preta.",
    belts: bands([
      "Branca",
      "Amarela",
      "Laranja",
      "Verde",
      "Azul",
      "Marrom",
      "Preta",
    ]),
  },
  {
    id: "muay-boran",
    name: "Muay Thai Boran · FPMTB",
    modalityName: "Muay Thai",
    note: "Prajieds do 1º ao 10º Khan da FPMTB. Outras equipes podem usar cores diferentes.",
    belts: bands(
      [
        "Branca",
        "Amarela",
        "Amarela e Branca",
        "Verde",
        "Verde e Branca",
        "Azul",
        "Azul e Branca",
        "Marrom",
        "Marrom e Branca",
        "Vermelha",
      ],
      "Prajied",
    ).map((b, i) => ({ ...b, label: i + 1 + "º Khan · " + b.label })),
  },
  {
    id: "capoeira-abada",
    name: "Capoeira · ABADÁ adulto",
    modalityName: "Capoeira",
    note: "Cordas do sistema adulto ABADÁ; adapte ao grupo da academia.",
    belts: bands(
      [
        "Crua",
        "Crua e Amarela",
        "Amarela",
        "Amarela e Laranja",
        "Laranja",
        "Laranja e Azul",
        "Azul",
        "Azul e Verde",
        "Verde",
        "Verde e Roxa",
        "Roxa",
        "Roxa e Marrom",
        "Marrom",
        "Marrom e Vermelha",
        "Vermelha",
        "Vermelha e Branca",
        "Branca",
      ],
      "Corda",
    ),
  },
  {
    id: "none",
    name: "Sem faixas",
    modalityName: "",
    note: "Para modalidades cadastradas sem sistema de graduação, como Boxe ou MMA.",
    belts: [],
  },
];
export function graduationPresetFor(options: BeltOption[]) {
  return graduationPresets.find(
    (p) => JSON.stringify(p.belts) === JSON.stringify(options),
  );
}
export function copyPresetBelts(preset: GraduationPreset): BeltOption[] {
  return preset.belts.map((b) => ({ label: b.label, colors: [...b.colors] }));
}
