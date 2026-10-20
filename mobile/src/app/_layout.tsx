import { Stack } from "expo-router";
import Head from "expo-router/head";
import { brand } from "../theme/brand";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { SessionProvider, queryClient } from "../services/session";
import { Page, Loading } from "../components/ui";
const fonts = {
  Inter_400Regular: require("@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf"),
  Inter_600SemiBold: require("@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf"),
  Inter_700Bold: require("@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf"),
};
export default function Layout() {
  const [loaded, error] = useFonts(fonts);
  return (
    <SafeAreaProvider>
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
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                gestureEnabled: false,
                animation: "none",
                contentStyle: { backgroundColor: "#0F0F10" },
              }}
            />
          </SessionProvider>
        </QueryClientProvider>
      )}
    </SafeAreaProvider>
  );
}
