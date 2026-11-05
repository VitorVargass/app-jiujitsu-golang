import { useState } from "react";
import { Linking } from "react-native";
import { router } from "expo-router";
import { Page, Heading, Label, Button, Field, Notice } from "../components/ui";
import { privacyContact } from "../features/legal/content";
import { useSession } from "../services/session";
import { api } from "../services/api";

export default function DeleteAccount() {
  const { session } = useSession();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [received, setReceived] = useState(false);
  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      const result = await api<{ id: string; message: string }>(
        "/v1/auth/deletion-requests",
        { method: "POST", body: { password, confirm } },
      );
      setReceived(true);
      setMessage(`${result.message} Protocolo: ${result.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Tente novamente.");
    } finally {
      setPassword("");
      setBusy(false);
    }
  }
  return (
    <Page title="Excluir minha conta — TatameMix">
      <Heading>Solicitar exclusão da conta e dos dados</Heading>
      <Label>
        O atendimento verifica sua identidade e analisa os dados em todas as
        academias, inclusive seus perfis de aluno, responsável, professor e
        gestor. O pedido não significa exclusão concluída. Você recebe a
        conclusão pelo atendimento.
      </Label>
      <Label>
        Na conclusão, suas credenciais e sessões pessoais serão removidas, e os
        dados pessoais sem finalidade de conservação serão apagados ou
        anonimizados. Matrículas, presenças, graduações, dados de responsáveis e
        cobranças são revisados com cada academia; dados de outras pessoas e
        históricos compartilhados não são apagados automaticamente.
      </Label>
      <Label>
        Registros financeiros, contratuais e de segurança só podem ser
        conservados quando houver finalidade e justificativa aplicáveis. O
        atendimento informa os registros conservados, a finalidade e o prazo ou
        critério de término da retenção no seu caso. Não há prazo operacional
        fixo publicado. O protocolo mínimo é conservado enquanto necessário para
        acompanhar e comprovar o atendimento, com revisão na conclusão.
      </Label>
      <Label>
        Gestor: peça a transferência explícita da responsabilidade para outro
        gestor apto. Se você for o único gestor, o suporte organiza a
        transferência ou um encerramento separado e expressamente autorizado da
        academia antes da conclusão. Isso não impede receber seu pedido.
      </Label>
      <Label>
        A assinatura TatameMix pertence à academia e é compartilhada pelos
        gestores; não há débito automático implementado. Excluir a conta não
        cancela mensalidades, contratos, links externos ou cobranças pendentes,
        nem gera reembolso. O atendimento revisará renovação e responsabilidade
        com a academia e o provedor quando necessário. Arquivar aluno ou
        encerrar renovação não exclui sua conta.
      </Label>
      {session?.kind === "user" && !received ? (
        <>
          <Heading>Confirmar solicitação</Heading>
          <Label>
            Conta: {session.user.email}. O pedido abrange todos os seus
            vínculos, não apenas a academia selecionada.
          </Label>
          <Field
            label="Senha atual"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
          />
          <Button
            secondary
            disabled={busy}
            onPress={() => setConfirm(!confirm)}
          >
            {confirm
              ? "✓ Li as consequências e quero solicitar"
              : "Confirmar que li as consequências"}
          </Button>
          <Button
            danger
            loading={busy}
            disabled={!confirm || !password}
            onPress={() => void submit()}
          >
            Solicitar exclusão da minha conta e dados
          </Button>
        </>
      ) : null}
      <Notice message={message} />
      <Heading>Solicitar sem o aplicativo ou acompanhar</Heading>
      <Label>
        Envie um e-mail para {privacyContact} com o assunto “Exclusão de conta
        TatameMix”, o e-mail da conta e as academias envolvidas. Não precisa
        reinstalar o app. Se não tiver acesso ao e-mail cadastrado, informe isso
        para combinar uma verificação alternativa proporcional. Nunca envie
        senha, token ou dados completos de cartão. O suporte confirma o
        recebimento e verifica o controle do e-mail cadastrado antes de executar
        qualquer exclusão; informar um e-mail não autoriza excluir uma conta nem
        consultar sua existência.
      </Label>
      <Button
        secondary
        onPress={() =>
          void Linking.openURL(
            `mailto:${privacyContact}?subject=${encodeURIComponent("Exclusão de conta TatameMix")}`,
          ).catch(() =>
            setMessage(
              `Envie sua solicitação diretamente para ${privacyContact}.`,
            ),
          )
        }
      >
        Enviar pedido por e-mail
      </Button>
      <Button secondary onPress={() => router.push("/privacy")}>
        Aviso de Privacidade
      </Button>
      <Button
        secondary
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace("/login")
        }
      >
        Voltar
      </Button>
    </Page>
  );
}
