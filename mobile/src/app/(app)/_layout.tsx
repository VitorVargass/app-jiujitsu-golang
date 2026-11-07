import { Redirect, Stack } from "expo-router";
import { useSession } from "../../services/session";
import { Page, Loading } from "../../components/ui";
import { SectionPagesProvider } from "../../features/shared/SectionPagesProvider";
import { useTheme } from "../../theme/ThemeProvider";

export { ScreenRecovery as ErrorBoundary } from "../../components/RouteRecovery";

export default function Layout() {
  const { colors } = useTheme();
  const { ready, session } = useSession();
  if (!ready)
    return (
      <Page>
        <Loading />
      </Page>
    );
  if (!session) return <Redirect href="/login" />;
  return (
    <SectionPagesProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          gestureEnabled: false,
          animation: "none",
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </SectionPagesProvider>
  );
}
