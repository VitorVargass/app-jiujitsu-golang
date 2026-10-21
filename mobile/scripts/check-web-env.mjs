// Called by the hosted build; local Expo/export commands remain available.
function publicOrigin(name, required = false) {
  const value = process.env[name]?.trim();
  if (!value && !required) return;
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      name + ": configure a URL pública HTTPS no painel da hospedagem.",
    );
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.hostname === "localhost" ||
    url.hostname.endsWith(".localhost") ||
    url.hostname.startsWith("127.") ||
    url.hostname === "[::1]" ||
    url.hostname.endsWith(".railway.internal")
  ) {
    throw new Error(
      name +
        ": informe somente a origem pública HTTPS, sem /v1, credenciais ou parâmetros.",
    );
  }
}
try {
  if (process.env.EXPO_PUBLIC_API_URL?.trim() !== "same-origin") {
    publicOrigin("EXPO_PUBLIC_API_URL", true);
  }
  publicOrigin("EXPO_PUBLIC_PORTAL_URL");
  console.log("Configuração web verificada.");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
