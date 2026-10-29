export function firstBillingMonth(month: string, day: number, today: string) {
  if (
    !/^\d{4}-\d{2}$/.test(month) ||
    !Number.isInteger(day) ||
    day < 1 ||
    day > 31
  )
    return month;
  const due = (m: string) => {
    const [y, n] = m.split("-").map(Number);
    return (
      m +
      "-" +
      String(Math.min(day, new Date(Date.UTC(y, n, 0)).getUTCDate())).padStart(
        2,
        "0",
      )
    );
  };
  if (due(month) >= today) return month;
  const current = today.slice(0, 7);
  if (due(current) >= today) return current;
  const [y, m] = current.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
}
