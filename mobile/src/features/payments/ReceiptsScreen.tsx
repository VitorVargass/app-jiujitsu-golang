import { useState } from "react";
import { Linking, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AcademyShell, RoleGate } from "../shared/AcademyShell";
import {
  Button,
  Card,
  Field,
  Heading,
  Label,
  Loading,
  Notice,
  Badge,
  Row,
} from "../../components/ui";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { api, academyPath } from "../../services/api";
import { queryClient, useSession } from "../../services/session";

type Integration = {
  provider: string;
  connected: boolean;
  enabled?: boolean;
  available?: boolean;
  handle?: string;
  validated_at?: string | null;
};
function Content() {
  const { academy } = useSession();
  const a = academy!.id;
  const [handle, setHandle] = useState("");
  const [key, setKey] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const integration = useQuery({
    queryKey: ["bank", a],
    queryFn: () => api<Integration>(academyPath(a, "/payment-integration")),
  });
  const save = useMutation({
    mutationFn: () =>
      api<Integration>(academyPath(a, "/payment-integration"), {
        method: "PUT",
        body: { handle, api_key: key },
      }),
    onSuccess: (data) => {
      setKey("");
      setEditing(false);
      setConfirm(false);
      setMessage(
        "Configuração salva. Será validada após a confirmação bancária de um pagamento.",
      );
      queryClient.setQueryData(["bank", a], data);
    },
  });
  const toggle = useMutation({
    mutationFn: () =>
      api<Integration>(academyPath(a, "/payment-integration"), {
        method: "PATCH",
        body: { enabled: !integration.data?.enabled },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["bank", a], data);
      setMessage(
        data.enabled
          ? "Emissão de novos links retomada."
          : "Emissão suspensa. Links já emitidos e confirmações bancárias continuam sendo acompanhados.",
      );
    },
  });
  const data = integration.data;
  return (
    <AcademyShell
      title="Recebimentos"
      subtitle="Receba as mensalidades na conta da academia"
      swipeEnabled={false}
    >
      {integration.isPending ? (
        <Loading />
      ) : integration.error ? (
        <Card>
          <Notice message={integration.error.message} />
          <Button secondary onPress={() => void integration.refetch()}>
            Tentar novamente
          </Button>
        </Card>
      ) : (
        <>
          <Card>
            <Heading>InfinitePay</Heading>
            <Label>
              Conecte a conta da própria academia. O aluno paga no checkout da
              InfinitePay e o TatameMix acompanha a confirmação.
            </Label>
            <Badge
              label={
                data?.provider === "asaas"
                  ? "Asaas configurado · histórico preservado"
                  : data?.connected
                    ? data.validated_at
                      ? "Integração validada"
                      : "Configuração salva · ainda não validada"
                    : "Conta não conectada"
              }
              tone={data?.validated_at ? "mint" : "amber"}
            />
            {data?.handle ? <Label>InfiniteTag: ${data.handle}</Label> : null}
            {data?.connected ? (
              <Label>
                {data.enabled
                  ? "Emissão de links ativa na academia"
                  : "Emissão de novos links suspensa"}
              </Label>
            ) : null}
            {data?.available === false ? (
              <Notice message="O servidor ainda não liberou os pagamentos online. Você pode salvar a configuração quando a chave de proteção estiver disponível; isso não cria cobranças." />
            ) : null}
            <Label muted>
              Pix com taxa zero conforme as condições da InfinitePay. O cartão
              pode ter taxas do provedor. O recebimento é na conta InfinitePay
              da academia.
            </Label>
            <Row>
              <Button
                compact
                secondary
                onPress={() => {
                  setEditing(!editing);
                  setHandle(data?.handle || "");
                  setKey("");
                  save.reset();
                }}
              >
                {editing
                  ? "Fechar configuração"
                  : data?.connected
                    ? "Substituir conexão"
                    : "Conectar InfinitePay"}
              </Button>
              {data?.provider === "infinitepay" && data.connected ? (
                <Button
                  compact
                  secondary
                  disabled={toggle.isPending}
                  onPress={() => toggle.mutate()}
                >
                  {data.enabled
                    ? "Suspender novos links"
                    : "Retomar novos links"}
                </Button>
              ) : null}
            </Row>
            <Notice message={toggle.error?.message} />
          </Card>
          {editing ? (
            <Card>
              <Heading>Conectar InfinitePay</Heading>
              <Label>
                1. No app InfinitePay, abra Vendas → Checkout → Configurações.
              </Label>
              <Label>
                2. Habilite o Checkout Integrado e crie uma chave para o
                TatameMix.
              </Label>
              <Label>
                3. Preencha sua InfiniteTag e cole a chave abaixo. Não informe a
                senha da sua conta.
              </Label>
              <Button
                compact
                secondary
                onPress={() =>
                  void Linking.openURL(
                    "https://ajuda.infinitepay.io/pt-BR/articles/10766888-como-usar-o-checkout-integrado-da-infinitepay",
                  )
                }
              >
                Abrir instruções oficiais
              </Button>
              <Field
                label="InfiniteTag da academia"
                value={handle}
                onChangeText={setHandle}
                autoCapitalize="none"
                editable={!save.isPending}
              />
              <Field
                label="Chave de integração"
                value={key}
                onChangeText={setKey}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="off"
                editable={!save.isPending}
              />
              <Label muted>
                A chave é protegida no servidor e não será exibida novamente. A
                configuração anterior será preservada para conferir pagamentos
                antigos.
              </Label>
              <Button
                disabled={
                  !handle.trim() || key.trim().length < 16 || save.isPending
                }
                onPress={() => setConfirm(true)}
              >
                Salvar conexão
              </Button>
            </Card>
          ) : null}
        </>
      )}
      <View>
        <Notice success message={message} />
      </View>
      <ConfirmDialog
        visible={confirm}
        title="Conectar esta conta?"
        message="Confira se a chave e a InfiniteTag pertencem à academia. Os novos pagamentos serão direcionados à conta identificada pela chave. Salvar não movimenta dinheiro."
        confirmLabel="Confirmar conexão"
        pending={save.isPending}
        error={save.error?.message}
        onCancel={() => setConfirm(false)}
        onConfirm={() => save.mutate()}
      />
    </AcademyShell>
  );
}
export default function ReceiptsScreen() {
  return (
    <RoleGate role="admin">
      <Content />
    </RoleGate>
  );
}
