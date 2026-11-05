import { Redirect } from "expo-router";

// Native apps keep their direct sign-in experience.
export default function LandingScreen() {
  return <Redirect href="/login" />;
}
