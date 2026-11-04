import { useQuery } from "@tanstack/react-query";
import { router, usePathname, Href } from "expo-router";
import { Card, Label, Button } from "../../components/ui";
import { api, academyPath } from "../../services/api";
import { useSession } from "../../services/session";
import type { Subscription } from "./types";
import { subscriptionDate } from "./types";
import { money } from "../../types/billing";
export function SubscriptionNotice() {
  const { academy, role, session } = useSession();
  const path = usePathname();
  const query = useQuery({
    queryKey: ["subscription", academy?.id],
    queryFn: () => api<Subscription>(academyPath(academy!.id, "/subscription")),
    enabled: !!academy && role === "admin" && session?.kind === "user",
    refetchInterval: 60000,
  });
  const v = query.data;
  if (
    path === "/subscription" ||
    role !== "admin" ||
    !v?.enabled ||
    (v.status === "active" && v.renewal_enabled && !v.renewal_soon)
  )
    return null;
  return (
    <Card>
      <Label>
        {v.status === "active"
          ? (v.renewal_enabled
              ? "Assinatura TatameMix: próximo vencimento em "
              : "Sua assinatura será encerrada em ") +
            subscriptionDate(v.paid_until) +
            "."
          : v.restricted
            ? "Assinatura TatameMix pendente. Novas operações estão restritas; consultas e pagamentos continuam disponíveis."
            : `Assinatura TatameMix: ${money(v.cycle?.amount_cents ?? v.amount_cents)}/mês. Regularize até ` +
              subscriptionDate(v.grace_until) +
              " para manter todas as operações."}
      </Label>
      <Button compact onPress={() => router.push("/subscription" as Href)}>
        Minha assinatura e pagamento
      </Button>
    </Card>
  );
}
