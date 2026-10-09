import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { SessionProvider, queryClient } from "../services/session";
import { Page, Loading } from "../components/ui";
const fonts = {
  Montserrat_600SemiBold: require("@expo-google-fonts/montserrat/600SemiBold/Montserrat_600SemiBold.ttf"),
  Montserrat_700Bold: require("@expo-google-fonts/montserrat/700Bold/Montserrat_700Bold.ttf"),
  Lato_400Regular: require("@expo-google-fonts/lato/400Regular/Lato_400Regular.ttf"),
  Lato_700Bold: require("@expo-google-fonts/lato/700Bold/Lato_700Bold.ttf"),
};
export default function Layout() {
  const [loaded, error] = useFonts(fonts);
  return (
    <SafeAreaProvider>
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
                contentStyle: { backgroundColor: "#080808" },
              }}
            />
          </SessionProvider>
        </QueryClientProvider>
      )}
    </SafeAreaProvider>
  );
}
