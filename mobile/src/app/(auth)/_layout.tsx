import { Redirect, Stack } from "expo-router";
import { useSession } from "../../services/session";
export default function Layout() {
  const { ready, session } = useSession();
  if (ready && session)
    return (
      <Redirect href={session.kind === "device" ? "/kiosk" : "/onboarding"} />
    );
  return <Stack screenOptions={{ headerShown: false }} />;
}
