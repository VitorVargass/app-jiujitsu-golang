import { Redirect } from "expo-router";
import { useSession } from "../services/session";
import { Loading, Page } from "../components/ui";
export default function Index() {
  const { ready, session } = useSession();
  if (!ready)
    return (
      <Page>
        <Loading />
      </Page>
    );
  return (
    <Redirect
      href={
        !session
          ? "/login"
          : session.kind === "device"
            ? "/kiosk"
            : "/onboarding"
      }
    />
  );
}
