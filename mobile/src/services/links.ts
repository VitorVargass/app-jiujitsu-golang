import { Platform } from "react-native";
import { API_URL } from "./api";
export function safeNext(value?: string) {
  return value &&
    /^\/(invite\/[a-f0-9]{64}|pay\/[a-f0-9-]{36}\/[a-f0-9-]{36})$/.test(value)
    ? value
    : "/entry";
}
export function portalLink(path: string) {
  const base =
    process.env.EXPO_PUBLIC_PORTAL_URL ||
    (Platform.OS === "web" ? window.location.origin : API_URL);
  return base.replace(/\/$/, "") + path;
}
