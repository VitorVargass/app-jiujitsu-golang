import { useEffect, useRef } from "react";
import { Linking } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { Button, Label, Loading, Notice } from "../../components/ui";
import { api, academyPath } from "../../services/api";
import { queryClient } from "../../services/session";
import { Checkout, money } from "../../types/billing";
export function CheckoutPanel({
  academyId,
  invoiceId,
  initial,
}: {
  academyId: string;
  invoiceId: string;
  initial?: Checkout;
}) {
  const checkout = useMutation({
    mutationFn: () =>
      api<Checkout>(
        academyPath(academyId, "/invoices/" + invoiceId + "/checkout"),
        { method: "POST" },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["invoice", academyId, invoiceId],
      });
    },
  });
  const check = useMutation({
    mutationFn: () =>
      api<Checkout>(
        academyPath(academyId, "/invoices/" + invoiceId + "/payment-check"),
        { method: "POST", body: {} },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
  const open = useMutation({
    mutationFn: async (url: string) => {
      await Linking.openURL(url);
    },
  });
  const started = useRef(false);
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      checkout.mutate();
    }
  }, [checkout]);
  const result =
    initial?.status === "paid" || initial?.status === "review"
      ? initial
      : check.data || checkout.data || initial;
  return (
    <>
      {checkout.isPending ? <Loading /> : null}
      <Notice
        message={
          checkout.error?.message || check.error?.message || open.error?.message
        }
      />
      {result?.status === "paid" ? (
        <Notice success message="Pagamento confirmado pela InfinitePay." />
      ) : result?.status === "review" ? (
        <Notice
          message={
            result.review_reason ||
            "Pagamento em conferência. Não gere outra cobrança; a academia deve consultar a InfinitePay."
          }
        />
      ) : result?.url ? (
        <>
          <Label>{money(result.amount_cents)}</Label>
          <Label>
            O Pix e as opções de cartão serão apresentados no checkout da
            InfinitePay.
          </Label>
          <Button onPress={() => open.mutate(result.url!)}>
            Abrir pagamento na InfinitePay
          </Button>
          <Label muted>
            Aguardando confirmação. Voltar do checkout não confirma o pagamento;
            consultamos a InfinitePay antes de registrar o recebimento.
          </Label>
        </>
      ) : null}
      {result?.status !== "paid" ? (
        <Button
          compact
          secondary
          loading={check.isPending}
          onPress={() => check.mutate()}
        >
          Conferir pagamento
        </Button>
      ) : null}
      {checkout.error ? (
        <Button
          compact
          secondary
          loading={checkout.isPending}
          onPress={() => checkout.mutate()}
        >
          Tentar novamente
        </Button>
      ) : null}
    </>
  );
}
