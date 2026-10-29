export function safeNext(value?: string) {
  if (!value || value.length > 1200) return "/entry";
  const [path, query, ...extra] = value.split("?");
  if (path === "/subscription" && !extra.length) {
    const params = new URLSearchParams(query);
    const allowed = ["academy_id", "order_nsu", "transaction_nsu", "slug"];
    const seen = new Set<string>();
    for (const [key, v] of params) {
      if (
        !allowed.includes(key) ||
        seen.has(key) ||
        !v ||
        v.length > 200 ||
        /[\u0000-\u001f]/.test(v)
      )
        return "/entry";
      if (
        (key === "academy_id" || key === "order_nsu") &&
        !/^[a-f0-9-]{36}$/.test(v)
      )
        return "/entry";
      seen.add(key);
    }
    return value;
  }
  if (
    extra.length ||
    !/^\/((?:invite|enroll)\/[a-f0-9]{64}|pay\/[a-f0-9-]{36}\/[a-f0-9-]{36})$/.test(
      path,
    )
  )
    return "/entry";
  if (query) {
    if (!path.startsWith("/pay/")) return "/entry";
    const params = new URLSearchParams(query);
    for (const [key, v] of params) {
      if (
        !["order_nsu", "transaction_nsu", "slug"].includes(key) ||
        v.length > 200
      )
        return "/entry";
    }
  }
  return value;
}
