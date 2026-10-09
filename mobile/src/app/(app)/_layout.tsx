import { Redirect, Stack } from "expo-router";
import { useSession } from "../../services/session";
import { Page, Loading } from "../../components/ui";
import { SectionPagesProvider } from "../../features/shared/SectionPagesProvider";
export default function Layout() {
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
        }}
      />
    </SectionPagesProvider>
  );
}
