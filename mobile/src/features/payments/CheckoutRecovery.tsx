import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { EditorDialog } from "../../components/EditorDialog";
import { Icon } from "../../components/Icon";
import {
  Button,
  Field,
  Heading,
  Label,
  Loading,
  Notice,
  Row,
} from "../../components/ui";
import { api, academyPath } from "../../services/api";
import { queryClient } from "../../services/session";
import { openPaymentURL } from "../../services/open-payment";
import { checkoutURL } from "../../services/checkout-flow";
import { money } from "../../types/billing";
import { colors } from "../../theme";

type Record = {
  id: string;
  reference: string;
  state: string;
  url?: string;
  amount_cents: number;
  created_at: string;
  retired_at: string | null;
  retired_by?: string;
  retirement_note?: string;
  review_reason?: string;
};
export function CheckoutRecovery({
  academyId,
  invoiceId,
  onClose,
}: {
  academyId: string;
  invoiceId: string;
  onClose: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false),
    [note, setNote] = useState(""),
    [copied, setCopied] = useState(false);
  const base = academyPath(academyId, "/invoices/" + invoiceId);
  const history = useQuery({
    queryKey: ["invoice-checkouts", academyId, invoiceId],
    queryFn: () => api<Record[]>(base + "/checkouts"),
  });
  const current = history.data?.find((v) => !v.retired_at);
  const open = useMutation({
    mutationFn: (url: string) => openPaymentURL(checkoutURL(url)),
  });
  const copy = useMutation({
    mutationFn: async (url: string) => {
      if (!(await Clipboard.setStringAsync(checkoutURL(url))))
        throw new Error("Não foi possível copiar.");
      setCopied(true);
    },
  });
  const retire = useMutation({
    mutationFn: () =>
      api(base + "/checkout-retirement", {
        method: "POST",
        body: {
          attempt_id: current?.id,
          confirmed_invalidated: confirmed,
          note: note.trim(),
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["invoice", academyId, invoiceId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["invoice-history", academyId, invoiceId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["invoice-checkouts", academyId, invoiceId],
      });
      onClose();
    },
  });
  return (
    <EditorDialog
      title="Gerenciar checkout"
      pending={retire.isPending}
      onClose={onClose}
    >
      <Label>
        O checkout já foi emitido com um valor fixo. Você pode recuperar o link
        ou registrar a conferência necessária antes de alterar a mensalidade.
      </Label>
      {history.isPending ? (
        <Loading />
      ) : history.error ? (
        <>
          <Notice message={history.error.message} />
          <Button onPress={() => void history.refetch()}>
            Tentar novamente
          </Button>
        </>
      ) : null}
      {history.data?.map((v) => (
        <View
          key={v.id}
          style={{
            gap: 10,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Heading>
            {money(v.amount_cents)} ·{" "}
            {v.retired_at ? "Anterior" : "Checkout atual"}
          </Heading>
          <Label muted>
            {new Date(v.created_at).toLocaleString("pt-BR")} · Referência{" "}
            {v.reference}
          </Label>
          {v.url ? (
            <>
              <Row>
                <Button compact secondary onPress={() => open.mutate(v.url!)}>
                  Consultar link
                </Button>
                <Button compact secondary onPress={() => copy.mutate(v.url!)}>
                  Copiar link
                </Button>
              </Row>
              <Text selectable style={{ color: colors.muted, fontSize: 12 }}>
                {v.url}
              </Text>
            </>
          ) : (
            <Label muted>
              Link não recebido na emissão. Confira a referência com a
              InfinitePay.
            </Label>
          )}
          {v.retired_at ? (
            <Label muted>
              Conferência registrada por {v.retired_by} em{" "}
              {new Date(v.retired_at).toLocaleString("pt-BR")}:{" "}
              {v.retirement_note}
            </Label>
          ) : null}
          <Notice message={v.review_reason} />
        </View>
      ))}
      <Notice success message={copied ? "Link copiado." : undefined} />
      <Notice
        message={
          open.error?.message || copy.error?.message || retire.error?.message
        }
      />
      {current && current.state !== "paid" ? (
        <>
          <Heading>Precisa alterar o valor?</Heading>
          <Label>
            Primeiro confira na InfinitePay que não houve recebimento e que o
            link anterior foi inutilizado. Se isso não for possível no painel,
            peça confirmação ao suporte da InfinitePay.
          </Label>
          <Notice message="Registrar esta conferência não cancela o link no provedor. Não confirme apenas porque o aluno não pagou ou porque você clicou em Pagar por engano." />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel="Confirmei na InfinitePay que o link foi inutilizado e não houve pagamento"
            accessibilityState={{ checked: confirmed }}
            onPress={() => setConfirmed(!confirmed)}
            style={{
              flexDirection: "row",
              gap: 12,
              alignItems: "center",
              minHeight: 48,
            }}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: confirmed ? colors.primary : colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {confirmed ? (
                <Icon
                  name="check-circle"
                  size={20}
                  color={colors.primaryLight}
                />
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <Label>
                Conferi: link inutilizado e nenhum pagamento recebido.
              </Label>
            </View>
          </Pressable>
          <Field
            label="Evidência ou protocolo da conferência"
            value={note}
            onChangeText={setNote}
            placeholder="Descreva o que foi confirmado na InfinitePay"
            multiline
          />
          <Button
            loading={retire.isPending}
            disabled={!confirmed || note.trim().length < 10}
            onPress={() => retire.mutate()}
          >
            Registrar conferência e liberar edição
          </Button>
          <Label muted>
            O link antigo ficará no histórico. Você poderá editar o desconto e
            gerar um novo checkout depois.
          </Label>
        </>
      ) : null}
    </EditorDialog>
  );
}
