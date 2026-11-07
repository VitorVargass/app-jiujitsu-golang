import { StyleSheet } from "react-native";
import { brand } from "./brand";

const accents = {
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
const colors = {
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
const lightAccents: Record<
  Accent,
  { color: string; soft: string; border: string }
> = {
  brand: { color: "#B51C2C", soft: "#FCE9EB", border: "#EAB2B8" },
  slate: { color: "#454951", soft: "#ECEEF1", border: "#CED1D7" },
  mint: { color: "#236443", soft: "#E3F3E9", border: "#A7D3B9" },
  blue: { color: "#355580", soft: "#E7EFFB", border: "#BCCDE5" },
  amber: { color: "#78501D", soft: "#FAEFD9", border: "#E3C794" },
  lavender: { color: "#594574", soft: "#F0EAF7", border: "#D6C6E6" },
  coral: { color: "#A4263B", soft: "#FBE8ED", border: "#E5B4BE" },
};
const lightColors = {
  background: "#F5F5F6",
  surface: "#FFFFFF",
  surfaceRaised: "#ECECEF",
  border: "#D1D2D7",
  borderSubtle: "#E1E2E6",
  primary: lightAccents.brand.color,
  primaryLight: lightAccents.brand.color,
  onPrimary: "#FFFFFF",
  text: "#202126",
  muted: "#585B65",
  success: lightAccents.mint.color,
  warning: lightAccents.amber.color,
  danger: lightAccents.coral.color,
};
const lightBrand = {
  ...brand,
  background: lightColors.background,
  surface: lightColors.surface,
  surfaceRaised: lightColors.surfaceRaised,
  border: lightColors.border,
  accent: lightColors.primary,
  accentLight: lightColors.primaryLight,
  accentSoft: lightAccents.brand.soft,
  accentBorder: lightAccents.brand.border,
  text: lightColors.text,
  muted: lightColors.muted,
};
export const palettes = {
  light: { colors: lightColors, accents: lightAccents, brand: lightBrand },
  dark: { colors, accents, brand },
};
export type ThemePalette = (typeof palettes)[keyof typeof palettes];

export function createThemedStyles<
  T extends Parameters<typeof StyleSheet.create>[0],
>(create: (palette: ThemePalette) => T) {
  return {
    light: StyleSheet.create(create(palettes.light)),
    dark: StyleSheet.create(create(palettes.dark)),
  };
}
export const roleLabel = {
  student: "Aluno",
  guardian: "Responsável",
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
