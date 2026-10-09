import { useEffect } from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Page, Loading, Notice } from "../../components/ui";
import { api } from "../../services/api";
import { useSession } from "../../services/session";
import { Academy } from "../../types";
import { InvoiceContent } from "../finance/InvoiceScreen";
export default function PaymentLinkScreen() {
  const { academyId, invoiceId } = useLocalSearchParams<{
    academyId: string;
    invoiceId: string;
  }>();
  const { ready, session, academy, select } = useSession();
  const list = useQuery({
    queryKey: ["payment-link-academies", academyId],
    queryFn: () => api<Academy[]>("/v1/me/academies"),
    enabled: ready && session?.kind === "user",
  });
  const selected = list.data?.find((a) => a.id === academyId);
  useEffect(() => {
    if (selected && academy?.id !== selected.id)
      select(
        selected,
        selected.roles.includes("admin") && selected.status === "active"
          ? "admin"
          : "student",
      );
  }, [selected, academy?.id, select]);
  if (!ready)
    return (
      <Page>
        <Loading />
      </Page>
    );
  if (!session)
    return (
      <Redirect
        href={{
          pathname: "/login",
          params: { next: "/pay/" + academyId + "/" + invoiceId },
        }}
      />
    );
  if (session.kind === "device") return <Redirect href="/kiosk" />;
  if (list.error)
    return (
      <Page>
        <Notice message={list.error.message} />
      </Page>
    );
  if (list.isPending)
    return (
      <Page>
        <Loading />
      </Page>
    );
  if (!selected)
    return (
      <Page title="Mensalidade">
        <Notice message="Esta conta ainda não está vinculada à academia. Aceite seu convite ou entre com a conta do aluno." />
      </Page>
    );
  if (academy?.id !== academyId)
    return (
      <Page>
        <Loading />
      </Page>
    );
  return <InvoiceContent id={invoiceId} />;
}
