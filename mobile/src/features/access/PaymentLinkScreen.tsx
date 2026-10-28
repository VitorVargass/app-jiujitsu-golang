import { useEffect } from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import { Page, Loading, Notice, Button } from "../../components/ui";
import { automaticAccess } from "../../services/access";
import { useSession } from "../../services/session";
import { InvoiceContent } from "../finance/InvoiceScreen";

export default function PaymentLinkScreen() {
  const { academyId, invoiceId, order_nsu, transaction_nsu, slug } =
    useLocalSearchParams<{
      academyId: string;
      invoiceId: string;
      order_nsu?: string;
      transaction_nsu?: string;
      slug?: string;
    }>();
  const {
    ready,
    session,
    academy,
    role,
    select,
    academies,
    academiesLoading,
    academiesError,
    reloadAcademies,
  } = useSession();
  const selected = academies.find((a) => a.id === academyId);
  const target = selected && automaticAccess([selected], "student");
  const atTarget = target && academy?.id === academyId && role === target.role;
  useEffect(() => {
    if (target && !atTarget) select(target.academy, target.role);
  }, [target, atTarget, select]);
  const callback = new URLSearchParams();
  if (
    typeof order_nsu === "string" &&
    typeof transaction_nsu === "string" &&
    typeof slug === "string"
  ) {
    callback.set("order_nsu", order_nsu);
    callback.set("transaction_nsu", transaction_nsu);
    callback.set("slug", slug);
  }
  const next =
    "/pay/" +
    academyId +
    "/" +
    invoiceId +
    (callback.size ? "?" + callback.toString() : "");
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
          params: { next },
        }}
      />
    );
  if (session.kind === "device") return <Redirect href="/kiosk" />;
  if (academiesLoading)
    return (
      <Page>
        <Loading />
      </Page>
    );
  if (academiesError)
    return (
      <Page title="Mensalidade">
        <Notice message={academiesError.message} />
        <Button onPress={reloadAcademies}>Tentar novamente</Button>
      </Page>
    );
  if (!target)
    return (
      <Page title="Mensalidade">
        <Notice message="Esta conta não tem acesso à academia desta cobrança. Aceite seu convite ou entre com a conta do aluno." />
      </Page>
    );
  if (!atTarget)
    return (
      <Page>
        <Loading />
      </Page>
    );
  return <InvoiceContent id={invoiceId} />;
}
