import { Redirect, Stack, useLocalSearchParams, Href } from "expo-router";
import { useSession } from "../../services/session";
import { safeNext } from "../../services/links";
export default function Layout() {
  const { ready, session } = useSession();
  const { next } = useLocalSearchParams<{ next?: string }>();
  if (ready && session)
    return (
      <Redirect
        href={session.kind === "device" ? "/kiosk" : (safeNext(next) as Href)}
      />
    );
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
