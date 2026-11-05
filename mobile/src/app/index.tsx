import { Redirect } from "expo-router";
import { useSession } from "../services/session";
import { Loading, Page } from "../components/ui";
import LandingScreen from "../features/marketing/LandingScreen";
export default function Index() {
  const { ready, session } = useSession();
  if (!ready)
    return (
      <Page>
        <Loading />
      </Page>
    );
  if (!session) return <LandingScreen />;
  return <Redirect href={session.kind === "device" ? "/kiosk" : "/entry"} />;
}
