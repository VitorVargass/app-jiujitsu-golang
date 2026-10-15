import { Platform } from "react-native";
import Constants from "expo-constants";
import { resolveAPIURL } from "./api-url";
let token: string | undefined;
let onUnauthorized: (() => void) | undefined;
export const API_URL = resolveAPIURL({
  configured: process.env.EXPO_PUBLIC_API_URL,
  platform: Platform.OS,
  development: __DEV__,
  expoHost:
    Constants.expoConfig?.hostUri || Constants.expoGoConfig?.debuggerHost,
  browserHost:
    typeof window !== "undefined" ? window.location.hostname : undefined,
});
if (__DEV__) console.info("[Tatame] API: " + API_URL);
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
  const requestToken = token;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 15000);
  try {
    const response = await fetch(API_URL + path, {
      method: options.method || "GET",
      signal: abort.signal,
      headers: {
        "Content-Type": "application/json",
        ...(requestToken ? { Authorization: "Bearer " + requestToken } : {}),
        ...(options.key ? { "Idempotency-Key": options.key } : {}),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw new APIError(
        response.status,
        "invalid_response",
        "A API respondeu em um formato inesperado. Confira o endereço do servidor.",
      );
    }
    if (!response.ok) {
      if (
        response.status === 401 &&
        requestToken === token &&
        !path.startsWith("/v1/auth/")
      )
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
      "Não foi possível alcançar a API da academia. Confira se o servidor está ligado e se o aparelho está na mesma rede.",
    );
  } finally {
    clearTimeout(timer);
  }
}
export const academyPath = (id: string, path: string) =>
  "/v1/academies/" + id + path;
