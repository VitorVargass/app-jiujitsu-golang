import { PlatformStyles } from "../components/PlatformStyles";
import { ScreenRecovery } from "../components/RouteRecovery";
import { FirstAccessGuard } from "../features/auth/FirstAccessGuard";
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as NavigationThemeProvider,
} from "expo-router";
import Head from "expo-router/head";
import { ThemeProvider, useTheme } from "../theme/ThemeProvider";

import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { SessionProvider, queryClient } from "../services/session";
import { Page, Loading } from "../components/ui";
export { RouteRecovery as ErrorBoundary } from "../components/RouteRecovery";

const fonts = {
  Inter_400Regular: require("@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf"),
  Inter_600SemiBold: require("@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf"),
  Inter_700Bold: require("@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf"),
};
export default function Layout() {
  return (
    <ThemeProvider>
      <ThemedLayout />
    </ThemeProvider>
  );
}

function ThemedLayout() {
  const { brand, colors, scheme } = useTheme();
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };
  const [loaded, error] = useFonts(fonts);
  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: brand.background }}>
      <PlatformStyles />
      <Head>
        <title>{brand.name}</title>
      </Head>
      {!loaded && !error ? (
        <Page>
          <Loading />
        </Page>
      ) : (
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <StatusBar style={scheme === "dark" ? "light" : "dark"} />
            <NavigationThemeProvider value={navigationTheme}>
              <Stack
                unstable_screenErrorBoundary={ScreenRecovery}
                screenOptions={{
                  headerShown: false,
                  gestureEnabled: false,
                  animation: "none",
                  contentStyle: { backgroundColor: brand.background },
                }}
              />
            </NavigationThemeProvider>
            <FirstAccessGuard />
          </SessionProvider>
        </QueryClientProvider>
      )}
    </SafeAreaProvider>
  );
}
