import { View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { Button, Label, Notice } from "../../components/ui";
import { CopyField } from "../../components/CopyField";
import { api, academyPath } from "../../services/api";
import { portalLink } from "../../services/links";
import { queryClient } from "../../services/session";

type TemporaryAccess = {
  email: string;
  temporary_password: string;
  expires_at: string;
};

export function StudentTemporaryAccess({
  academyId,
  studentId,
  email,
  linked,
  active,
}: {
  academyId: string;
  studentId: string;
  email: string;
  linked: boolean;
  active: boolean;
}) {
  const create = useMutation({
    mutationFn: () =>
      api<TemporaryAccess>(
        academyPath(academyId, "/students/" + studentId + "/temporary-access"),
        {
          method: "POST",
        },
      ),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["student", academyId, studentId],
      });
      void queryClient.invalidateQueries({ queryKey: ["students", academyId] });
    },
  });
  const result = create.data;
  if (result) {
    const message = [
      "Seu acesso à academia",
      "Endereço: " + portalLink("/login"),
      "E-mail: " + result.email,
      "Senha temporária: " + result.temporary_password,
      "No primeiro acesso, escolha sua senha pessoal.",
      "Use até " + new Date(result.expires_at).toLocaleString("pt-BR") + ".",
    ].join("\n");
    return (
      <View style={{ width: "100%", gap: 12 }}>
        <Notice
          success
          message="Conta criada. Copie os dados para enviar ao aluno."
        />
        <CopyField
          label="Senha temporária"
          value={result.temporary_password}
          buttonLabel="Copiar senha"
        />
        <CopyField
          label="Mensagem para o aluno"
          value={message}
          buttonLabel="Copiar acesso completo"
        />
      </View>
    );
  }
  if (linked || !active) return null;
  return (
    <View style={{ width: "100%", gap: 10 }}>
      <Label muted>
        Crie uma conta com senha temporária para o aluno adulto. Ele escolhe a
        própria senha no primeiro acesso. Para menores, use a conta do
        responsável pela matrícula pelo link.
      </Label>
      <View style={{ alignItems: "flex-start" }}>
        <Button
          icon="lock"
          loading={create.isPending}
          disabled={!email}
          onPress={() => create.mutate()}
        >
          Criar acesso com senha
        </Button>
      </View>
      {!email ? (
        <Label muted>Informe o e-mail próprio do aluno no cadastro.</Label>
      ) : null}
      <Notice message={create.error?.message} />
    </View>
  );
}
