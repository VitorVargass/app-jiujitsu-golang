import { Redirect, Stack } from "expo-router";
import { useSession } from "../../services/session";
import { Page, Loading } from "../../components/ui";
export default function Layout() {
  const { ready, session } = useSession();
  if (!ready)
    return (
      <Page>
        <Loading />
      </Page>
    );
  if (!session) return <Redirect href="/login" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
