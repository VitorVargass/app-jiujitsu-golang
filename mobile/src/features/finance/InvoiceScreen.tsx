import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { beginInvoiceCheckout } from "../../services/checkout-flow";
import { openPaymentURL } from "../../services/open-payment";
import { useState, useEffect, useRef } from "react";
import { CheckoutPanel } from "../payments/CheckoutPanel";
import { router, useLocalSearchParams } from "expo-router";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AcademyShell, PersonalGate } from "../shared/AcademyShell";
import { InvoiceActions } from "./InvoiceActions";
import {
  Badge,
  Button,
  Card,
  IconButton,
  Label,
  Loading,
  Notice,
} from "../../components/ui";
import { EditorDialog } from "../../components/EditorDialog";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Icon } from "../../components/Icon";
import { colors } from "../../theme";
import { api, academyPath } from "../../services/api";
import { queryClient, useSession } from "../../services/session";
import { portalLink } from "../../services/links";
import {
  Invoice,
  Checkout,
  Pix,
  money,
  statusLabel,
  paymentMethodLabel,
  ManualPaymentMethod,
} from "../../types/billing";
import { formatMonth } from "../../types/month";

export function InvoiceContent({ id }: { id: string }) {
  const { academy, role } = useSession(),
    a = academy!,
    { width } = useWindowDimensions();
  const { isWide } = useResponsiveLayout();
  const [message, setMessage] = useState(""),
    [confirmCancel, setConfirmCancel] = useState(false),
    [showPix, setShowPix] = useState(false);
  const returned = useLocalSearchParams<{
    order_nsu?: string;
    transaction_nsu?: string;
    slug?: string;
  }>();
  const returnAttempt = useRef("");
  const returnCheck = useMutation({
    mutationFn: () =>
      api(academyPath(a.id, "/invoices/" + id + "/payment-check"), {
        method: "POST",
        body: {
          order_nsu: returned.order_nsu,
          transaction_nsu: returned.transaction_nsu,
          slug: returned.slug,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
  useEffect(() => {
    const reference = [
      returned.order_nsu,
      returned.transaction_nsu,
      returned.slug,
    ].join(":");
    if (
      returned.order_nsu &&
      returned.transaction_nsu &&
      returned.slug &&
      returnAttempt.current !== reference
    ) {
      returnAttempt.current = reference;
      returnCheck.mutate();
    }
  }, [
    returned.order_nsu,
    returned.transaction_nsu,
    returned.slug,
    returnCheck,
  ]);
  const invoice = useQuery({
    queryKey: ["invoice", a.id, id],
    queryFn: () => api<Invoice>(academyPath(a.id, "/invoices/" + id)),
    refetchInterval: 10000,
  });
  const onlinePayment = useMutation({
    mutationFn: () =>
      beginInvoiceCheckout(
        () =>
          api<Checkout>(academyPath(a.id, "/invoices/" + id + "/checkout"), {
            method: "POST",
          }),
        openPaymentURL,
      ),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["invoice", a.id, id] });
      if (result.status !== "waiting" || !result.url) setShowPix(true);
    },
  });
  const pix = useMutation({
    mutationFn: () =>
      api<Pix>(academyPath(a.id, "/invoices/" + id + "/pix"), {
        method: "POST",
      }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["invoice", a.id, id] }),
  });
  const cancel = useMutation({
    mutationFn: () =>
      api(academyPath(a.id, "/invoices/" + id + "/cancel"), {
        method: "PATCH",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      setConfirmCancel(false);
      setMessage("Mensalidade cancelada.");
      pix.reset();
    },
  });
  const copy = useMutation({
    mutationFn: async (value: string) => {
      if (!(await Clipboard.setStringAsync(value)))
        throw new Error("Não foi possível copiar. Tente novamente.");
      setMessage("Copiado.");
    },
  });
  const i = invoice.data,
    paid = i?.status === "paid",
    closed = i?.status === "cancelled",
    currentPix =
      pix.data?.amount_cents === i?.amount_cents ? pix.data : undefined;
  function openPayment() {
    if (!i || paid || closed || onlinePayment.isPending || pix.isPending)
      return;
    setMessage("");
    if (i.payment_provider === "infinitepay") {
      if (
        i.payment_checkout?.status === "review" &&
        !i.payment_checkout.retryable
      ) {
        setShowPix(true);
        return;
      }
      onlinePayment.mutate();
      return;
    }
    setShowPix(true);
    pix.mutate();
  }
  return (
    <AcademyShell
      title="Mensalidade"
      swipeEnabled={false}
      titleAction={
        <IconButton
          icon="swap"
          label="Atualizar pagamento"
          disabled={invoice.isFetching}
          onPress={() => {
            setMessage("");
            void invoice.refetch();
          }}
        />
      }
    >
      {invoice.isPending ? (
        <Loading />
      ) : invoice.error ? (
        <Notice message={invoice.error.message} />
      ) : i ? (
        <View style={[s.layout, isWide && s.desktopLayout]}>
          <Card style={[s.summaryCard, isWide && { flex: 1.4 }]}>
            <View style={s.top}>
              <Label muted>{formatMonth(i.competence)}</Label>
              <Badge
                label={statusLabel[i.status]}
                tone={
                  paid
                    ? "mint"
                    : closed
                      ? "slate"
                      : i.status === "overdue"
                        ? "coral"
                        : "blue"
                }
              />
            </View>
            <Text style={s.amount}>{money(i.amount_cents)}</Text>
            <Text style={s.student}>{i.student_name}</Text>
            {role === "admin" ? (
              <Button
                compact
                secondary
                icon="users"
                onPress={() =>
                  router.push({
                    pathname: "/students/[id]",
                    params: { id: i.student_id },
                  })
                }
              >
                Ver aluno
              </Button>
            ) : null}
            <View style={s.due}>
              <Icon name="calendar" color={colors.muted} size={16} />
              <Label muted>
                Vencimento em {i.due_date.split("-").reverse().join("/")}
              </Label>
            </View>
            {i.discount_cents > 0 ? (
              <View style={s.breakdown}>
                <View style={s.line}>
                  <Label muted>Valor original</Label>
                  <Label>{money(i.original_amount_cents)}</Label>
                </View>
                <View style={s.line}>
                  <Label muted>Desconto</Label>
                  <Text style={s.discount}>−{money(i.discount_cents)}</Text>
                </View>
                <Label muted>{i.discount_reason}</Label>
              </View>
            ) : null}
            {paid ? (
              <View style={s.breakdown}>
                <View style={s.due}>
                  <Icon name="check-circle" size={20} color={colors.success} />
                  <Label>Pagamento confirmado</Label>
                </View>
                {i.payment_method ? (
                  <Label muted>
                    {i.payment_method === "asaas_pix"
                      ? "Pix confirmado pelo Asaas"
                      : i.payment_method === "infinitepay_pix"
                        ? "Pix confirmado pela InfinitePay"
                        : i.payment_method === "infinitepay_card"
                          ? "Cartão confirmado pela InfinitePay"
                          : "Registrado pela academia • " +
                            paymentMethodLabel[
                              i.payment_method as ManualPaymentMethod
                            ]}
                  </Label>
                ) : null}
                {i.paid_at ? (
                  <Label muted>
                    Recebido em{" "}
                    {new Date(i.paid_at).toLocaleDateString("pt-BR")}
                  </Label>
                ) : null}
              </View>
            ) : null}
          </Card>
          <Card style={[s.paymentCard, isWide && { flex: 1 }]}>
            <View style={s.paymentHeading}>
              <View style={s.walletIcon}>
                <Icon name="wallet" size={22} color={colors.primaryLight} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.paymentTitle}>Pagamento</Text>
                <Label muted>
                  {paid
                    ? "Recebimento confirmado"
                    : closed
                      ? "Mensalidade cancelada"
                      : i.payment_provider === "infinitepay"
                        ? "Pix ou cartão pela InfinitePay"
                        : "Pix da academia"}
                </Label>
              </View>
            </View>
            {role === "admin" ? (
              <InvoiceActions
                key={id}
                academyId={a.id}
                invoice={i}
                onCopy={() =>
                  copy.mutate(portalLink("/pay/" + a.id + "/" + id))
                }
                onPay={openPayment}
                paymentPending={onlinePayment.isPending || pix.isPending}
                onCancel={() => {
                  cancel.reset();
                  setConfirmCancel(true);
                }}
                onSaved={(updated) => {
                  pix.reset();
                  setMessage(
                    updated.status === "paid"
                      ? "Pagamento registrado."
                      : "Desconto atualizado.",
                  );
                  queryClient.setQueryData<Invoice>(
                    ["invoice", a.id, id],
                    (previous) => ({
                      ...updated,
                      payment_provider:
                        previous?.payment_provider || "infinitepay",
                    }),
                  );
                  void queryClient.invalidateQueries();
                }}
              />
            ) : !paid && !closed ? (
              <Button
                icon="wallet"
                loading={onlinePayment.isPending || pix.isPending}
                onPress={openPayment}
              >
                Pagar
              </Button>
            ) : (
              <Label muted>Nenhuma ação pendente.</Label>
            )}
            <Notice message={onlinePayment.error?.message} />
            {!paid &&
            !closed &&
            i.payment_provider === "infinitepay" &&
            i.payment_checkout ? (
              <CheckoutPanel
                inline
                key={i.payment_checkout.id}
                academyId={a.id}
                invoiceId={id}
                initial={i.payment_checkout}
              />
            ) : null}
            {role === "admin" ? (
              <Notice message={i.checkout_history_warning} />
            ) : null}
            {!paid && !closed ? (
              <View style={s.paymentHint}>
                <Icon name="lock" size={16} color={colors.muted} />
                <Text style={s.hintText}>
                  {i.payment_provider === "infinitepay"
                    ? "Você escolhe como pagar no checkout. A confirmação aparece aqui automaticamente."
                    : "A presença de uma mensalidade em aberto não confirma recebimento."}
                </Text>
              </View>
            ) : null}
          </Card>
        </View>
      ) : null}
      <Notice message={returnCheck.error?.message} />
      <Notice success message={message} />
      <Notice message={copy.error?.message} />
      {showPix && i?.payment_provider === "infinitepay" ? (
        <EditorDialog
          title="Pagamento da mensalidade"
          onClose={() => setShowPix(false)}
        >
          <CheckoutPanel
            academyId={a.id}
            invoiceId={id}
            initial={
              i.payment_checkout?.status === "paid"
                ? i.payment_checkout
                : (onlinePayment.data ?? i.payment_checkout)
            }
          />
        </EditorDialog>
      ) : showPix ? (
        <EditorDialog
          title={paid ? "Pagamento confirmado" : "Pagamento Pix"}
          pending={pix.isPending}
          onClose={() => setShowPix(false)}
        >
          {paid ? (
            <Notice success message="Esta mensalidade já está paga." />
          ) : pix.isPending ? (
            <Loading />
          ) : pix.error ? (
            <>
              <Notice message={pix.error.message} />
              <Button onPress={() => pix.mutate()}>Tentar novamente</Button>
            </>
          ) : currentPix?.payload ? (
            <>
              <Label muted>
                {i?.student_name} • {money(i?.amount_cents ?? 0)}
              </Label>
              {currentPix.environment === "sandbox" ? (
                <Notice message="Ambiente de teste. Este Pix não recebe pagamentos reais." />
              ) : null}
              <View style={s.qr}>
                <QRCode
                  value={currentPix.payload}
                  size={Math.max(150, Math.min(230, width - 112))}
                  color="black"
                  backgroundColor="white"
                />
              </View>
              <Label muted>
                Aguardando pagamento. A confirmação aparece após a consulta ao
                Asaas.
              </Label>
              <Button
                icon="qr"
                onPress={() => copy.mutate(currentPix.payload!)}
              >
                Copiar Pix Copia e Cola
              </Button>
              <Text selectable style={s.code}>
                {currentPix.payload}
              </Text>
              {currentPix.expires_at ? (
                <Label muted>
                  Válido até{" "}
                  {new Date(currentPix.expires_at).toLocaleString("pt-BR")}
                </Label>
              ) : null}
              <Button secondary compact onPress={() => pix.mutate()}>
                Consultar pagamento
              </Button>
            </>
          ) : (
            <Button onPress={() => pix.mutate()}>Gerar Pix atualizado</Button>
          )}
          <Notice message={copy.error?.message} />
          <Notice success message={message === "Copiado." ? message : ""} />
        </EditorDialog>
      ) : null}
      <ConfirmDialog
        visible={confirmCancel}
        title="Cancelar mensalidade?"
        message="O histórico será preservado. Se houver uma cobrança emitida, será necessário conferir seu estado antes de concluir o cancelamento."
        confirmLabel="Confirmar cancelamento"
        pending={cancel.isPending}
        error={cancel.error?.message}
        danger
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => cancel.mutate()}
      />
    </AcademyShell>
  );
}
export default function InvoiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <PersonalGate>
      <InvoiceContent key={id} id={id} />
    </PersonalGate>
  );
}
const s = StyleSheet.create({
  layout: { gap: 20 },
  desktopLayout: { flexDirection: "row", alignItems: "flex-start" },
  summaryCard: { minWidth: 0, padding: 26, gap: 20 },
  paymentCard: { minWidth: 0, padding: 24, gap: 20 },
  paymentHeading: { flexDirection: "row", alignItems: "center", gap: 12 },
  walletIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2B171B",
  },
  paymentTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 19,
    color: colors.text,
  },
  paymentHint: {
    flexDirection: "row",
    gap: 9,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  hintText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 19,
    color: colors.muted,
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  amount: {
    fontFamily: "Inter_700Bold",
    fontSize: 34,
    color: colors.text,
    letterSpacing: -1,
  },
  student: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: colors.text,
  },
  due: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  breakdown: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
    gap: 10,
  },
  line: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  discount: {
    fontFamily: "Inter_600SemiBold",
    color: colors.primaryLight,
    fontSize: 14,
  },
  qr: {
    backgroundColor: "white",
    padding: 16,
    alignSelf: "center",
    borderRadius: 12,
  },
  code: {
    color: colors.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 17,
  },
});
