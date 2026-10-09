type APIAddress = {
  configured?: string;
  platform: string;
  development: boolean;
  expoHost?: string | null;
  browserHost?: string;
};

/** Explicit URLs always win. "auto" discovers only the local Expo development host. */
export function resolveAPIURL({
  configured,
  platform,
  development,
  expoHost,
  browserHost,
}: APIAddress) {
  const explicit = configured?.trim();
  if (explicit && explicit !== "auto") return explicit.replace(/\/$/, "");
  if (development && (explicit === "auto" || !explicit)) {
    const host = platform === "web" ? browserHost : expoHost;
    if (host) {
      try {
        const hostname = new URL(host.includes("://") ? host : "http://" + host)
          .hostname;
        if (hostname) return "http://" + hostname + ":8080";
      } catch {
        // No usable Expo host: retain the standard emulator fallback.
      }
    }
  }
  return platform === "web" ? "http://127.0.0.1:8080" : "http://10.0.2.2:8080";
}
