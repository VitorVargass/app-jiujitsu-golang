import { Redirect, Stack, useLocalSearchParams, Href } from "expo-router";
import { useSession } from "../../services/session";
import { safeNext } from "../../services/links";
import { Loading, Page } from "../../components/ui";

export default function Layout() {
  const { ready, session } = useSession();
  const { next } = useLocalSearchParams<{ next?: string }>();
  if (!ready)
    return (
      <Page>
        <Loading />
      </Page>
    );
  if (session) {
    return (
      <Redirect
        href={session.kind === "device" ? "/kiosk" : (safeNext(next) as Href)}
      />
    );
  }
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        animation: "none",
      }}
    />
  );
}
