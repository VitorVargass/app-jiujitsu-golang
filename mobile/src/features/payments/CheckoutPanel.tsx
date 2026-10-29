import { useState } from "react";
import { Text } from "react-native";
import { useMutation } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { Button, Label, Loading, Notice, Row } from "../../components/ui";
import { api, academyPath } from "../../services/api";
import { queryClient } from "../../services/session";
import { openPaymentURL } from "../../services/open-payment";
import { checkoutURL } from "../../services/checkout-flow";
import { Checkout, money } from "../../types/billing";
import { colors } from "../../theme";

export function CheckoutPanel({
  academyId,
  invoiceId,
  initial,
  inline = false,
}: {
  academyId: string;
  invoiceId: string;
  initial?: Checkout;
  inline?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const refresh = () =>
    void queryClient.invalidateQueries({
      queryKey: ["invoice", academyId, invoiceId],
    });
  const checkout = useMutation({
    mutationFn: () =>
      api<Checkout>(
        academyPath(academyId, "/invoices/" + invoiceId + "/checkout"),
        { method: "POST" },
      ),
    onSuccess: refresh,
  });
  const check = useMutation({
    mutationFn: () =>
      api<Checkout>(
        academyPath(academyId, "/invoices/" + invoiceId + "/payment-check"),
        { method: "POST", body: {} },
      ),
    onSuccess: () => void queryClient.invalidateQueries(),
  });
  const open = useMutation({
    mutationFn: (url: string) => openPaymentURL(checkoutURL(url)),
  });
  const copy = useMutation({
    mutationFn: async (url: string) => {
      if (!(await Clipboard.setStringAsync(checkoutURL(url))))
        throw new Error("Não foi possível copiar o link.");
      setCopied(true);
    },
  });
  const result =
    initial?.status === "paid"
      ? initial
      : check.data || checkout.data || initial;
  return (
    <>
      {checkout.isPending ? <Loading /> : null}
      <Notice
        message={
          checkout.error?.message ||
          check.error?.message ||
          open.error?.message ||
          copy.error?.message
        }
      />
      {result?.status === "paid" ? (
        <Notice success message="Pagamento confirmado pela InfinitePay." />
      ) : (
        <>
          {result?.status === "review" ? (
            <Notice
              message={
                result.review_reason ||
                "Checkout em conferência. Consulte a academia antes de gerar outro link."
              }
            />
          ) : null}
          {result?.url ? (
            <>
              <Label>
                {inline
                  ? "Link do pagamento"
                  : "Checkout emitido · " + money(result.amount_cents)}
              </Label>
              <Row>
                {!inline ? (
                  <Button
                    compact
                    loading={open.isPending}
                    onPress={() => open.mutate(result.url!)}
                  >
                    {result.expired || result.status === "review"
                      ? "Consultar link original"
                      : "Continuar pagamento"}
                  </Button>
                ) : null}
                <Button
                  compact
                  secondary
                  loading={copy.isPending}
                  onPress={() => copy.mutate(result.url!)}
                >
                  Copiar link
                </Button>
              </Row>
              <Text
                selectable
                style={{ fontSize: 12, color: colors.muted, flexShrink: 1 }}
              >
                {result.url}
              </Text>
              <Label muted>
                {result.expired
                  ? "O prazo previsto terminou; a InfinitePay determina se o link ainda aceita pagamento. Este é o mesmo link, não uma nova cobrança."
                  : "Você pode voltar e usar este mesmo link depois. A abertura do checkout não registra pagamento."}
              </Label>
            </>
          ) : result ? (
            <Label muted>
              O provedor não devolveu um link recuperável. A academia precisa
              conferir a emissão na InfinitePay; não vamos gerar outra cobrança
              automaticamente.
            </Label>
          ) : null}
          {copied ? (
            <Notice success message="Link do checkout copiado." />
          ) : null}
          {result ? (
            <Button
              compact
              secondary
              loading={check.isPending}
              onPress={() => check.mutate()}
            >
              Conferir pagamento
            </Button>
          ) : null}
          {!result || result.retryable || checkout.error ? (
            <Button
              compact
              secondary
              loading={checkout.isPending}
              onPress={() => checkout.mutate()}
            >
              {result ? "Tentar emitir novamente" : "Gerar link de pagamento"}
            </Button>
          ) : null}
        </>
      )}
    </>
  );
}
