import { Platform } from "react-native";
let token: string | undefined;
let onUnauthorized: (() => void) | undefined;
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === "web" ? "http://127.0.0.1:8080" : "http://10.0.2.2:8080")
).replace(/\/$/, "");
export function setToken(value?: string) {
  token = value;
}
export function setUnauthorized(callback: () => void) {
  onUnauthorized = callback;
}
export class APIError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; key?: string } = {},
): Promise<T> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 15000);
  try {
    const response = await fetch(API_URL + path, {
      method: options.method || "GET",
      signal: abort.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(options.key ? { "Idempotency-Key": options.key } : {}),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401 && !path.startsWith("/v1/auth/"))
        onUnauthorized?.();
      throw new APIError(
        response.status,
        data.error?.code || "request_error",
        data.error?.message || "Não foi possível concluir.",
      );
    }
    return data;
  } catch (error) {
    if (error instanceof APIError) throw error;
    throw new APIError(
      0,
      "network_error",
      "Sem conexão com a academia. Verifique a internet e tente novamente.",
    );
  } finally {
    clearTimeout(timer);
  }
}
export const academyPath = (id: string, path: string) =>
  "/v1/academies/" + id + path;
