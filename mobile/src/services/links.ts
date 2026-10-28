import { Platform } from "react-native";
import { API_URL } from "./api";
export { safeNext } from "./safe-next";
export function portalLink(path: string) {
  const base =
    process.env.EXPO_PUBLIC_PORTAL_URL ||
    (Platform.OS === "web" ? window.location.origin : API_URL);
  return base.replace(/\/$/, "") + path;
}
