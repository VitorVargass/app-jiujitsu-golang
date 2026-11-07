import { useEffect } from "react";
import { router, usePathname } from "expo-router";
import { useSession } from "../../services/session";

export function FirstAccessGuard() {
  const { ready, session } = useSession();
  const pathname = usePathname();
  const required =
    session?.kind === "user" && session.user.password_change_required;
  useEffect(() => {
    if (ready && required && pathname !== "/first-access") {
      router.replace("/first-access");
    }
  }, [ready, required, pathname]);
  return null;
}
