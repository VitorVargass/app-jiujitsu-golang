export function validDocument(value: string) {
  const n = value.replace(/\D/g, "");
  if (![11, 14].includes(n.length) || /^(\d)\1+$/.test(n)) return false;
  const digits = n.split("").map(Number);
  const check = (length: number, weights: number[]) => {
    const sum = digits
      .slice(0, length)
      .reduce((s, d, i) => s + d * weights[i], 0);
    const result = 11 - (sum % 11);
    return result > 9 ? 0 : result;
  };
  if (n.length === 11)
    return (
      check(9, [10, 9, 8, 7, 6, 5, 4, 3, 2]) === digits[9] &&
      check(10, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) === digits[10]
    );
  return (
    check(12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === digits[12] &&
    check(13, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === digits[13]
  );
}
