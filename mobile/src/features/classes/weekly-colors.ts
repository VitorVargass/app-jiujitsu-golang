import type { Class } from "../../types";
import { accents } from "../../theme";
const tones = [
  accents.brand,
  accents.slate,
  accents.blue,
  accents.lavender,
  accents.amber,
];
export function modalityColor(item: Class) {
  const name = item.modality_name || "Modalidade";
  if (name.toLowerCase().includes("jiu")) return accents.brand;
  const hash = Array.from(name.toLowerCase()).reduce(
    (sum, c) => sum + c.charCodeAt(0),
    0,
  );
  return tones[hash % tones.length];
}
