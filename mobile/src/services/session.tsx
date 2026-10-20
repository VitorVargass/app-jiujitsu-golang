import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { QueryClient, useQuery } from "@tanstack/react-query";
import { api, APIError, setToken, setUnauthorized } from "./api";
import { Academy, Role, User } from "../types";
import { accessRole, academyAccesses, AccessPreference } from "./access";

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
  academies: Academy[];
  academiesLoading: boolean;
  academiesError: Error | null;
  reloadAcademies: () => void;
  selection: AccessPreference | null;
  login: (data: { token: string; user: User }) => Promise<void>;
  logout: () => Promise<void>;
  select: (a: Academy, role: Role) => void;
  activateDevice: (
    data: Extract<LoginState, { kind: "device" }>,
  ) => Promise<void>;
};
const SessionContext = createContext<Context | null>(null);
async function readStored(key: string) {
  return Platform.OS === "web"
    ? sessionStorage.getItem(key)
    : SecureStore.getItemAsync(key);
}
async function writeStored(key: string, value: string | null) {
  if (Platform.OS === "web") {
    if (value !== null) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } else if (value !== null) await SecureStore.setItemAsync(key, value);
  else await SecureStore.deleteItemAsync(key);
}
async function readPreference(
  userId: string,
): Promise<AccessPreference | null> {
  try {
    const raw = await readStored("tatame.access." + userId);
    if (!raw) return null;
    const value = JSON.parse(raw);
    const role = accessRole(value?.role);
    return role && typeof value.academyId === "string"
      ? { academyId: value.academyId, role }
      : null;
  } catch {
    return null;
  }
}
const noAcademies: Academy[] = [];
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<LoginState | null>(null);
  const [ready, setReady] = useState(false);
  const [selection, setSelection] = useState<AccessPreference | null>(null);
  const activeUser = useRef("");
  const save = useCallback(
    async (value: LoginState | null, previous?: AccessPreference | null) => {
      await writeStored("tatame.session", value ? JSON.stringify(value) : null);
      activeUser.current = value?.kind === "user" ? value.user.id : "";
      setToken(value?.token);
      setSelection(previous ?? null);
      queryClient.clear();
      setSession(value);
    },
    [],
  );
  useEffect(() => {
    let alive = true;
    setUnauthorized(() => {
      void save(null);
    });
    async function restore() {
      try {
        const raw = await readStored("tatame.session");
        const value = raw ? (JSON.parse(raw) as LoginState) : null;
        const saved =
          value?.kind === "user" ? await readPreference(value.user.id) : null;
        if (!alive) return;
        activeUser.current = value?.kind === "user" ? value.user.id : "";
        setToken(value?.token);
        setSession(value);
        setSelection(saved);
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
  }, [save]);
  const userId = session?.kind === "user" ? session.user.id : "";
  const list = useQuery({
    queryKey: ["academies", userId],
    queryFn: () => api<Academy[]>("/v1/me/academies"),
    enabled: ready && !!userId,
  });
  const academies = list.data ?? noAcademies;
  // Stored IDs are only preferences: never restore an academy or role without
  // validating the current API response.
  const selected =
    selection &&
    academyAccesses(academies).find(
      (item) =>
        item.academy.id === selection.academyId && item.role === selection.role,
    );
  const select = useCallback(
    (a: Academy, role: Role) => {
      const approvedRole = accessRole(role);
      if (!userId || activeUser.current !== userId || !approvedRole) return;
      if (!academyAccesses([a]).some((item) => item.role === approvedRole))
        return;
      const next: AccessPreference = { academyId: a.id, role: approvedRole };
      queryClient.setQueryData<Academy[]>(
        ["academies", userId],
        (previous = []) =>
          [...previous.filter((item) => item.id !== a.id), a].sort(
            (left, right) => left.name.localeCompare(right.name),
          ),
      );
      setSelection(next);
      // Remembering navigation is optional; a storage failure must not block access.
      void writeStored("tatame.access." + userId, JSON.stringify(next)).catch(
        () => {},
      );
    },
    [userId],
  );
  const login = useCallback(
    async (data: { token: string; user: User }) => {
      const previous = await readPreference(data.user.id);
      await save({ kind: "user", ...data }, previous);
    },
    [save],
  );
  const logout = useCallback(async () => {
    if (session?.kind === "user") {
      try {
        await api("/v1/auth/logout", { method: "POST" });
      } catch {
        /* Still remove local credentials. */
      }
    } else if (session?.kind === "device") {
      try {
        await api("/v1/academies/" + session.academy_id + "/devices/current", {
          method: "DELETE",
        });
      } catch (error) {
        if (!(error instanceof APIError) || error.status !== 401) throw error;
      }
    }
    await save(null);
  }, [session, save]);
  return (
    <SessionContext.Provider
      value={{
        ready,
        session,
        academy: selected?.academy ?? null,
        role: selected?.role ?? null,
        academies,
        academiesLoading: ready && !!userId && list.isPending,
        academiesError: userId ? list.error : null,
        reloadAcademies: () => {
          void list.refetch();
        },
        selection,
        login,
        logout,
        select,
        activateDevice: save,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("SessionProvider required");
  return value;
}
