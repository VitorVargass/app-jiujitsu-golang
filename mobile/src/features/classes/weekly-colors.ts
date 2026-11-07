import type { Class } from "../../types";
import type { ThemePalette } from "../../theme";
export function modalityColor(item: Class, accents: ThemePalette["accents"]) {
  const tones = [
    accents.brand,
    accents.slate,
    accents.blue,
    accents.lavender,
    accents.amber,
  ];
  const name = item.modality_name || "Modalidade";
  if (name.toLowerCase().includes("jiu")) return accents.brand;
  const hash = Array.from(name.toLowerCase()).reduce(
    (sum, c) => sum + c.charCodeAt(0),
    0,
  );
  return tones[hash % tones.length];
}
