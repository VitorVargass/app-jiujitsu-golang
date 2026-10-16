import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { QueryClient } from "@tanstack/react-query";
import { api, APIError, setToken, setUnauthorized } from "./api";
import { Academy, Role, User } from "../types";
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15000 },
    mutations: { retry: false },
  },
});
export type LoginState =
  | { kind: "user"; token: string; user: User }
  | {
      kind: "device";
      token: string;
      academy_id: string;
      academy_name: string;
      device_id: string;
    };
type Context = {
  ready: boolean;
  session: LoginState | null;
  academy: Academy | null;
  role: Role | null;
  login: (data: { token: string; user: User }) => Promise<void>;
  logout: () => Promise<void>;
  select: (a: Academy, role: Role) => void;
  activateDevice: (
    data: Extract<LoginState, { kind: "device" }>,
  ) => Promise<void>;
};
const SessionContext = createContext<Context | null>(null);
async function persist(value: LoginState | null) {
  const data = value ? JSON.stringify(value) : null;
  if (Platform.OS === "web") {
    if (data) sessionStorage.setItem("tatame.session", data);
    else sessionStorage.removeItem("tatame.session");
    return;
  }
  if (data) await SecureStore.setItemAsync("tatame.session", data);
  else await SecureStore.deleteItemAsync("tatame.session");
}
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<LoginState | null>(null),
    [ready, setReady] = useState(false),
    [academy, setAcademy] = useState<Academy | null>(null),
    [role, setRole] = useState<Role | null>(null);
  async function save(value: LoginState | null) {
    await persist(value);
    setToken(value?.token);
    setSession(value);
    setAcademy(null);
    setRole(null);
    queryClient.clear();
  }
  useEffect(() => {
    let alive = true;
    setUnauthorized(() => {
      void save(null);
    });
    async function restore() {
      try {
        const raw =
          Platform.OS === "web"
            ? sessionStorage.getItem("tatame.session")
            : await SecureStore.getItemAsync("tatame.session");
        if (raw && alive) {
          const value = JSON.parse(raw) as LoginState;
          setToken(value.token);
          setSession(value);
        }
      } catch {
        if (alive) setToken(undefined);
      } finally {
        if (alive) setReady(true);
      }
    }
    void restore();
    return () => {
      alive = false;
    };
  }, []);
  const value: Context = {
    ready,
    session,
    academy,
    role,
    login: async (data) => save({ kind: "user", ...data }),
    activateDevice: save,
    logout: async () => {
      if (session?.kind === "user") {
        try {
          await api("/v1/auth/logout", { method: "POST" });
        } catch {
          /* Local credentials must still be removed. */
        }
      } else if (session?.kind === "device") {
        try {
          await api(
            "/v1/academies/" + session.academy_id + "/devices/current",
            { method: "DELETE" },
          );
        } catch (error) {
          if (!(error instanceof APIError) || error.status !== 401) throw error;
        }
      }
      await save(null);
    },
    select: (a, r) => {
      setAcademy(a);
      setRole(r);
      queryClient.clear();
    },
  };
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("SessionProvider required");
  return value;
}
