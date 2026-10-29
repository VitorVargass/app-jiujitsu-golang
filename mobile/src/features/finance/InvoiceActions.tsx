import { useState } from "react";
import { View, Pressable, Text } from "react-native";
import { Icon, IconName } from "../../components/Icon";
import { colors } from "../../theme";
import { formatMonth } from "../../types/month";
import { useMutation, useQuery } from "@tanstack/react-query";
import { EditorDialog } from "../../components/EditorDialog";
import {
  Button,
  Chip,
  Field,
  Heading,
  Label,
  Loading,
  Notice,
  Row,
  IconButton,
} from "../../components/ui";
import { api, academyPath } from "../../services/api";
import {
  Invoice,
  InvoiceAdjustment,
  ManualPaymentMethod,
  money,
  parseMoney,
  paymentMethodLabel,
} from "../../types/billing";

type Edit = { kind: "discount" | "payment"; invoice: Invoice };
type Change =
  | {
      kind: "discount";
      discount_cents: number;
      expected_amount_cents: number;
      reason: string;
    }
  | {
      kind: "payment";
      method: ManualPaymentMethod;
      note: string;
      expected_amount_cents: number;
    };

export function InvoiceActions({
  academyId,
  invoice,
  onSaved,
  onCopy,
  onPay,
  paymentPending = false,
  onCancel,
}: {
  academyId: string;
  invoice: Invoice;
  onSaved: (invoice: Invoice) => void;
  onCopy: () => void;
  onPay: () => void;
  paymentPending?: boolean;
  onCancel: () => void;
}) {
  const [edit, setEdit] = useState<Edit | null>(null);
  const [discount, setDiscount] = useState("");
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<ManualPaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [menu, setMenu] = useState(false);
  const history = useQuery({
    queryKey: ["invoice-history", academyId, invoice.id],
    queryFn: () =>
      api<InvoiceAdjustment[]>(
        academyPath(academyId, "/invoices/" + invoice.id + "/history"),
      ),
    enabled: showHistory,
  });
  const change = useMutation({
    mutationFn: ({ kind, ...body }: Change) =>
      api<Invoice>(
        academyPath(
          academyId,
          "/invoices/" +
            invoice.id +
            (kind === "discount" ? "/discount" : "/manual-payment"),
        ),
        {
          method: kind === "discount" ? "PATCH" : "POST",
          body,
        },
      ),
    onSuccess: (value) => {
      setEdit(null);
      onSaved(value);
    },
  });
  function open(kind: Edit["kind"]) {
    change.reset();
    setError("");
    setEdit({ kind, invoice });
    setDiscount((invoice.discount_cents / 100).toFixed(2).replace(".", ","));
    setReason(invoice.discount_reason);
    setNote("");
    setMethod("cash");
  }
  let preview: number | null = null;
  if (edit?.kind === "discount") {
    try {
      preview = edit.invoice.original_amount_cents - parseMoney(discount);
    } catch {
      /* Field validation is shown on submit. */
    }
  }
  function save() {
    if (!edit) return;
    setError("");
    try {
      if (edit.kind === "discount") {
        const cents = parseMoney(discount);
        if (
          !Number.isSafeInteger(cents) ||
          cents < 0 ||
          cents >= edit.invoice.original_amount_cents
        )
          throw new Error(
            "O desconto deve ser menor que o valor original. Use 0 para remover.",
          );
        if (reason.trim().length < 3)
          throw new Error("Informe o motivo do desconto.");
        change.mutate({
          kind: "discount",
          discount_cents: cents,
          expected_amount_cents: edit.invoice.amount_cents,
          reason: reason.trim(),
        });
      } else {
        change.mutate({
          kind: "payment",
          method,
          note: note.trim(),
          expected_amount_cents: edit.invoice.amount_cents,
        });
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const openInvoice = invoice.status === "open" || invoice.status === "overdue";
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1 }}>
          {openInvoice ? (
            <Button icon="wallet" loading={paymentPending} onPress={onPay}>
              {invoice.payment_checkout?.url ? "Continuar pagamento" : "Pagar"}
            </Button>
          ) : (
            <Button compact secondary icon="mail" onPress={onCopy}>
              Copiar link
            </Button>
          )}
        </View>
        {openInvoice ? (
          <IconButton
            icon="mail"
            label="Copiar link para o aluno"
            onPress={onCopy}
          />
        ) : null}
        <IconButton
          icon="more"
          label="Mais ações da mensalidade"
          onPress={() => setMenu(true)}
        />
      </View>
      {menu ? (
        <EditorDialog
          title="Ações da mensalidade"
          onClose={() => setMenu(false)}
        >
          {openInvoice ? (
            <>
              <ActionRow
                icon="check-circle"
                label="Registrar pagamento recebido por fora"
                onPress={() => {
                  setMenu(false);
                  open("payment");
                }}
              />
              <ActionRow
                icon="edit"
                label={
                  invoice.discount_cents
                    ? "Editar desconto"
                    : "Aplicar desconto"
                }
                onPress={() => {
                  setMenu(false);
                  open("discount");
                }}
              />
            </>
          ) : null}
          <ActionRow
            icon="calendar"
            label="Ver histórico de ajustes"
            onPress={() => {
              setMenu(false);
              setShowHistory(true);
            }}
          />
          {openInvoice ? (
            <ActionRow
              icon="close"
              label="Cancelar mensalidade"
              danger
              onPress={() => {
                setMenu(false);
                onCancel();
              }}
            />
          ) : null}
        </EditorDialog>
      ) : null}
      {showHistory ? (
        <EditorDialog
          title="Histórico de ajustes"
          onClose={() => setShowHistory(false)}
        >
          {history.isPending ? (
            <Loading />
          ) : history.error ? (
            <Notice message={history.error.message} />
          ) : history.data?.length ? (
            history.data.map((h) => (
              <View
                key={h.id}
                style={{
                  gap: 6,
                  paddingBottom: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Label>
                  {h.kind === "checkout_retired"
                    ? "Conferência do checkout"
                    : h.kind === "discount"
                      ? "Desconto: " + money(h.discount_cents)
                      : h.kind === "bank_payment"
                        ? h.payment_method === "infinitepay_pix"
                          ? "Pix confirmado pela InfinitePay"
                          : "Cartão confirmado pela InfinitePay"
                        : "Pagamento registrado • " +
                          paymentMethodLabel[
                            h.payment_method as ManualPaymentMethod
                          ]}
                </Label>
                <Label muted>
                  {h.actor_name} •{" "}
                  {new Date(h.created_at).toLocaleString("pt-BR")}
                </Label>
                <Label muted>
                  {h.kind === "discount"
                    ? money(h.previous_amount_cents) +
                      " → " +
                      money(h.amount_cents)
                    : money(h.amount_cents)}
                </Label>
                {h.note ? <Label muted>{h.note}</Label> : null}
              </View>
            ))
          ) : (
            <Label muted>Nenhuma movimentação registrada.</Label>
          )}
        </EditorDialog>
      ) : null}
      {edit ? (
        <EditorDialog
          title={
            edit.kind === "discount"
              ? "Desconto nesta mensalidade"
              : "Pagamento recebido por fora"
          }
          pending={change.isPending}
          onClose={() => setEdit(null)}
          footer={
            <>
              <Button
                secondary
                compact
                disabled={change.isPending}
                onPress={() => setEdit(null)}
              >
                Voltar
              </Button>
              <Button compact loading={change.isPending} onPress={save}>
                {edit.kind === "discount"
                  ? "Salvar desconto"
                  : "Confirmar recebimento"}
              </Button>
            </>
          }
        >
          <Label>
            {edit.invoice.student_name} • {formatMonth(edit.invoice.competence)}
          </Label>
          {edit.kind === "discount" ? (
            <>
              <Label>
                Valor original: {money(edit.invoice.original_amount_cents)}
              </Label>
              <Field
                label="Desconto (R$)"
                value={discount}
                onChangeText={setDiscount}
                keyboardType="decimal-pad"
                maxLength={12}
              />
              <Field
                label="Motivo do desconto"
                value={reason}
                onChangeText={setReason}
                maxLength={300}
                placeholder="Ex.: acordo para este mês"
              />
              {preview !== null && preview > 0 ? (
                <Heading>Total a pagar: {money(preview)}</Heading>
              ) : null}
              <Label muted>
                O valor das próximas mensalidades continua igual. Use desconto 0
                para remover o desconto atual.
              </Label>
            </>
          ) : (
            <>
              <Heading>
                Valor recebido: {money(edit.invoice.amount_cents)}
              </Heading>
              <Label>Como você recebeu?</Label>
              <Row>
                {(Object.keys(paymentMethodLabel) as ManualPaymentMethod[]).map(
                  (key) => (
                    <Chip
                      key={key}
                      selected={method === key}
                      onPress={() => setMethod(key)}
                    >
                      {paymentMethodLabel[key]}
                    </Chip>
                  ),
                )}
              </Row>
              <Field
                label="Observação (opcional)"
                value={note}
                onChangeText={setNote}
                maxLength={500}
                placeholder="Ex.: recebido na recepção"
              />
              <Label muted>
                Esta ação registra o recebimento pela academia. Ela não
                movimenta dinheiro.
              </Label>
            </>
          )}
          <Label muted>
            {invoice.payment_provider === "infinitepay"
              ? "Descontos devem ser definidos antes de gerar o link de pagamento. Um link já emitido mantém o valor original."
              : "Se houver Pix emitido, vamos conferir o pagamento e encerrar a cobrança pendente no Asaas antes de concluir."}
          </Label>
          <Notice message={error || change.error?.message} />
        </EditorDialog>
      ) : null}
    </>
  );
}

function ActionRow({
  label,
  icon,
  onPress,
  danger = false,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        minHeight: 52,
        gap: 12,
        paddingHorizontal: 8,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon
        name={icon}
        size={20}
        color={danger ? colors.danger : colors.muted}
      />
      <Text
        style={{
          flex: 1,
          fontFamily: "Inter_600SemiBold",
          color: danger ? colors.danger : colors.text,
          fontSize: 14,
        }}
      >
        {label}
      </Text>
      <Icon name="chevron-right" size={16} color={colors.muted} />
    </Pressable>
  );
}
