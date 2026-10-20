import { Redirect } from "expo-router";

// Keep saved links working without making this a step in the login flow.
export default function OnboardingScreen() {
  return <Redirect href="/entry" />;
}
