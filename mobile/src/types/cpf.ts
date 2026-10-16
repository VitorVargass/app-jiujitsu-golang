export const cpfDigits = (value: string) =>
  value.replace(/\D/g, "").slice(0, 11);
export function formatCPF(value: string) {
  const n = cpfDigits(value);
  return n
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}
export function validCPF(value: string) {
  const n = cpfDigits(value);
  if (n.length !== 11 || /^(\d)\1+$/.test(n)) return false;
  for (let length = 9; length <= 10; length++) {
    const sum = n
      .slice(0, length)
      .split("")
      .reduce((s, d, i) => s + Number(d) * (length + 1 - i), 0);
    const remainder = (sum * 10) % 11;
    if ((remainder === 10 ? 0 : remainder) !== Number(n[length])) return false;
  }
  return true;
}
