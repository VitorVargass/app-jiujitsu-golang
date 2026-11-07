import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Platform, useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import { palettes } from "./index";

export type AppearancePreference = "system" | "light" | "dark";
const storageKey = "tatame.appearance";
const ThemeContext = createContext({
  scheme: "dark" as "light" | "dark",
  preference: "system" as AppearancePreference,
  setPreference: (_value: AppearancePreference): Promise<void> =>
    Promise.resolve(),
});

function parsePreference(value: string | null): AppearancePreference {
  return value === "light" || value === "dark" ? value : "system";
}

function initialPreference(): AppearancePreference {
  if (Platform.OS === "web") {
    try {
      return parsePreference(localStorage.getItem(storageKey));
    } catch {
      return "system";
    }
  }
  return "system";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreference] = useState(initialPreference);
  const [ready, setReady] = useState(Platform.OS === "web");
  useEffect(() => {
    if (Platform.OS === "web") return;
    let active = true;
    void SecureStore.getItemAsync(storageKey)
      .then((value) => {
        if (active) setPreference(parsePreference(value));
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  async function savePreference(value: AppearancePreference) {
    if (Platform.OS === "web") localStorage.setItem(storageKey, value);
    else await SecureStore.setItemAsync(storageKey, value);
    setPreference(value);
  }

  const scheme = preference === "system" ? (system ?? "light") : preference;
  return (
    <ThemeContext.Provider
      value={{ scheme, preference, setPreference: savePreference }}
    >
      {ready && children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const appearance = useContext(ThemeContext);
  return { ...appearance, ...palettes[appearance.scheme] };
}

export function useThemedStyles<T>(styles: Record<"light" | "dark", T>) {
  return styles[useContext(ThemeContext).scheme];
}
