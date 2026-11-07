import { useEffect, useState } from "react";
import { Text } from "react-native";
import { useMutation } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { Button, Label, Loading, Notice, Row } from "../../components/ui";
import { api, academyPath } from "../../services/api";
import { queryClient } from "../../services/session";
import { openPaymentURL } from "../../services/open-payment";
import {
  beginInvoiceCheckout,
  checkoutExpired,
  checkoutURL,
} from "../../services/checkout-flow";
import { Checkout, money } from "../../types/billing";
import { useTheme } from "../../theme/ThemeProvider";


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
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  const [validated, setValidated] = useState<Checkout>();
  const [, tick] = useState(0);
  const refresh = () =>
    void queryClient.invalidateQueries({
      queryKey: ["invoice", academyId, invoiceId],
    });
  const checkout = useMutation({
    mutationFn: () =>
      beginInvoiceCheckout(
        () =>
          api<Checkout>(
            academyPath(academyId, "/invoices/" + invoiceId + "/checkout"),
            { method: "POST" },
          ),
        openPaymentURL,
      ),
    onMutate: () => {
      setValidated(undefined);
      check.reset();
      setCopied(false);
    },
    onSuccess: refresh,
  });
  const check = useMutation({
    onMutate: () => setValidated(undefined),
    mutationFn: () =>
      api<Checkout>(
        academyPath(academyId, "/invoices/" + invoiceId + "/payment-check"),
        { method: "POST", body: {} },
      ),
    onSuccess: () => void queryClient.invalidateQueries(),
  });
  const copy = useMutation({
    mutationFn: async () => {
      setCopied(false);
      const current = result;
      if (!current?.url || current.customer_changed)
        throw new Error("Nenhum link disponível para copiar.");
      if (!(await Clipboard.setStringAsync(checkoutURL(current.url))))
        throw new Error("Não foi possível copiar o link.");
      setCopied(true);
    },
  });
  const result =
    initial?.status === "paid" || initial?.customer_changed
      ? initial
      : validated || check.data || checkout.data || initial;
  const expired = result ? checkoutExpired(result) : false;
  useEffect(() => {
    if (!result?.expires_at || result.status === "paid") return;
    const timer = setInterval(() => tick((v) => v + 1), 15000);
    return () => clearInterval(timer);
  }, [result?.expires_at, result?.status]);
  return (
    <>
      {checkout.isPending ? <Loading /> : null}
      <Notice
        message={
          checkout.error?.message || check.error?.message || copy.error?.message
        }
      />
      {result?.status === "paid" ? (
        <Notice success message="Pagamento confirmado pela InfinitePay." />
      ) : (
        <>
          {expired ? (
            <Notice message="A validade informada deste link terminou. Você ainda pode abri-lo para conferir na InfinitePay. Transações pendentes serão conferidas antes de outra emissão." />
          ) : result?.status === "review" ? (
            <Notice
              message={
                result.review_reason ||
                "Checkout em conferência. Consulte a academia antes de gerar outro link."
              }
            />
          ) : null}
          {result?.url && !result.customer_changed ? (
            <>
              <Label>
                {inline
                  ? "Link do pagamento"
                  : "Checkout emitido · " + money(result.amount_cents)}
              </Label>
              <Row>
                {result.url ? (
                  <Button
                    compact
                    loading={checkout.isPending}
                    onPress={() => void openPaymentURL(checkoutURL(result.url!))}
                  >
                    Abrir link de pagamento
                  </Button>
                ) : null}
                <Button
                  compact
                  secondary
                  loading={copy.isPending}
                  onPress={() => copy.mutate()}
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
                {result.expires_at
                  ? `Válido até ${new Date(result.expires_at).toLocaleString("pt-BR")}. Após expirar, gere um novo link.`
                  : "Este é o link já emitido para esta mensalidade."}
              </Label>
            </>
          ) : result && !expired && !result.customer_changed ? (
            <Label muted>
              O provedor não devolveu um link recuperável. A academia precisa
              conferir a emissão na InfinitePay; não vamos gerar outra cobrança
              automaticamente.
            </Label>
          ) : null}
          {copied && !result?.customer_changed ? (
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
          {result?.customer_changed && result.expires_at ? (
            <Label muted>
              O link anterior vence em{" "}
              {new Date(result.expires_at).toLocaleString("pt-BR")}. Após esse
              horário, use Gerar novo link.
            </Label>
          ) : null}
          {!result ||
          result.retryable ||
          checkout.error ||
          (expired &&
            (result.status === "waiting" || result.customer_changed)) ? (
            <Button
              compact
              secondary
              loading={checkout.isPending}
              onPress={() => checkout.mutate()}
            >
              {expired
                ? "Gerar novo link"
                : result
                  ? "Tentar emitir novamente"
                  : "Gerar link de pagamento"}
            </Button>
          ) : null}
        </>
      )}
    </>
  );
}
