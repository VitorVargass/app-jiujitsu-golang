export function safeNext(value?: string) {
  if (!value || value.length > 1200) return "/entry";
  const [path, query, ...extra] = value.split("?");
  if (
    extra.length ||
    !/^\/(invite\/[a-f0-9]{64}|pay\/[a-f0-9-]{36}\/[a-f0-9-]{36})$/.test(path)
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
