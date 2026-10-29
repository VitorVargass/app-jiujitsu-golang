import { Linking, Platform } from "react-native";
export async function openPaymentURL(url: string) {
  // Same-tab navigation avoids popup blockers after the async API request.
  if (Platform.OS === "web") {
    window.location.assign(url);
    return;
  }
  await Linking.openURL(url);
}
