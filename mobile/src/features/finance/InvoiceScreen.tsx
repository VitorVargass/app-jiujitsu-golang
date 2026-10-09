import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { View, Text } from "react-native";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AcademyShell } from "../shared/AcademyShell";
import {
  Button,
  Card,
  Heading,
  Label,
  Loading,
  Notice,
} from "../../components/ui";
import { api, academyPath } from "../../services/api";
import { queryClient, useSession } from "../../services/session";
import { portalLink } from "../../services/links";
import { Invoice, Pix, money, statusLabel } from "../../types/billing";
export function InvoiceContent({ id }: { id: string }) {
  const { academy, role } = useSession();
  const a = academy!;
  const [message, setMessage] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const invoice = useQuery({
    queryKey: ["invoice", a.id, id],
    queryFn: () => api<Invoice>(academyPath(a.id, "/invoices/" + id)),
    refetchInterval: 10000,
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
    },
  });
  const copy = useMutation({
    mutationFn: async (value: string) => {
      if (!(await Clipboard.setStringAsync(value)))
        throw new Error(
          "Não foi possível copiar. Selecione o código ou link abaixo.",
        );
      setMessage("Copiado.");
    },
  });
  const i = invoice.data;
  const paid = i?.status === "paid" || pix.data?.status === "paid";
  const closed = i?.status === "cancelled";
  return (
    <AcademyShell title="Mensalidade">
      {invoice.isPending ? (
        <Loading />
      ) : invoice.error ? (
        <Notice message={invoice.error.message} />
      ) : i ? (
        <Card>
          <Heading>{money(i.amount_cents)}</Heading>
          <Label>
            {i.student_name} • {i.competence}
          </Label>
          <Label muted>
            Vencimento: {i.due_date.split("-").reverse().join("/")}
          </Label>
          <Label>{paid ? "✓ Paga" : statusLabel[i.status]}</Label>
          {i.paid_at ? (
            <Label muted>
              Confirmado em {new Date(i.paid_at).toLocaleDateString("pt-BR")}
            </Label>
          ) : null}
        </Card>
      ) : null}
      <Notice
        message={
          pix.error?.message || cancel.error?.message || copy.error?.message
        }
      />
      <Notice success message={message} />
      {role === "admin" && copy.variables?.startsWith("http") ? (
        <Text
          selectable
          style={{ color: "#ADADAD", fontFamily: "Lato_400Regular" }}
        >
          {copy.variables}
        </Text>
      ) : null}
      {paid ? (
        <Notice success message="Pagamento confirmado pela academia." />
      ) : i && !closed ? (
        <>
          <Button loading={pix.isPending} onPress={() => pix.mutate()}>
            {pix.data?.payload ? "Consultar / atualizar Pix" : "Pagar com Pix"}
          </Button>
          {pix.data?.status === "waiting" && pix.data.payload ? (
            <Card>
              <Heading>Aguardando pagamento</Heading>
              {pix.data.environment === "sandbox" ? (
                <Notice message="Ambiente de teste. Este Pix não recebe pagamentos reais." />
              ) : null}
              <View
                style={{
                  backgroundColor: "white",
                  padding: 20,
                  alignSelf: "center",
                }}
              >
                <QRCode
                  value={pix.data.payload}
                  size={230}
                  color="black"
                  backgroundColor="white"
                />
              </View>
              <Label muted>
                Use o QR Code ou cole o código no aplicativo do seu banco. A
                confirmação aparece após a consulta ao Asaas.
              </Label>
              <Text
                selectable
                style={{
                  color: "#ADADAD",
                  fontFamily: "Lato_400Regular",
                  fontSize: 12,
                }}
              >
                {pix.data.payload}
              </Text>
              <Button onPress={() => copy.mutate(pix.data!.payload!)}>
                Copiar Pix Copia e Cola
              </Button>
              {pix.data.expires_at ? (
                <Label muted>
                  Válido até{" "}
                  {new Date(pix.data.expires_at).toLocaleString("pt-BR")}
                </Label>
              ) : null}
            </Card>
          ) : null}
        </>
      ) : null}
      {role === "admin" ? (
        <>
          <Button
            secondary
            onPress={() => copy.mutate(portalLink("/pay/" + a.id + "/" + id))}
          >
            Copiar link para o aluno
          </Button>
          {i && !paid && !closed ? (
            <Card>
              <Button
                secondary
                onPress={() => setConfirmCancel(!confirmCancel)}
              >
                Cancelar mensalidade
              </Button>
              {confirmCancel ? (
                <>
                  <Label>Cancelar esta mensalidade e seu Pix pendente?</Label>
                  <Button
                    loading={cancel.isPending}
                    onPress={() => cancel.mutate()}
                  >
                    Confirmar cancelamento
                  </Button>
                </>
              ) : null}
            </Card>
          ) : null}
        </>
      ) : null}
      <Button secondary onPress={() => void invoice.refetch()}>
        Atualizar pagamento
      </Button>
    </AcademyShell>
  );
}
export default function InvoiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { academy } = useSession();
  if (!academy)
    return (
      <AcademyShell title="Mensalidade">
        <Button onPress={() => router.replace("/onboarding")}>
          Escolher academia
        </Button>
      </AcademyShell>
    );
  return <InvoiceContent id={id} />;
}
