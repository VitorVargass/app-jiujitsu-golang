import { useRef, useState } from "react";
import { router, useLocalSearchParams, Redirect } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Page,
  Button,
  Card,
  Field,
  Heading,
  Label,
  Loading,
  Notice,
  Badge,
} from "../../components/ui";
import { api } from "../../services/api";
import { useSession } from "../../services/session";
import { Academy } from "../../types";
import { Student } from "../../types/billing";
import { cpfDigits, formatCPF, validCPF } from "../../types/cpf";

type InvitationPreview = {
  academy_id: string;
  academy_name: string;
  student_name: string;
  cpf_registered: boolean;
  expires_at: string;
};

export default function InvitationScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <InvitationForm key={token} token={token} />;
}

function InvitationForm({ token }: { token: string }) {
  const { ready, session, select, logout } = useSession();
  const [cpf, setCPF] = useState("");
  const [acceptedAcademy, setAcceptedAcademy] = useState("");
  const submitting = useRef(false);
  const personal = session?.kind === "user";
  const validToken = typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
  const preview = useQuery({
    queryKey: ["invitation-preview", token, personal ? session.user.id : ""],
    queryFn: () => api<InvitationPreview>("/v1/invitations/" + token),
    enabled: ready && personal && validToken && !acceptedAcademy,
    retry: false,
  });
  const enter = useMutation({
    mutationFn: async (academyId: string) => {
      const academies = await api<Academy[]>("/v1/me/academies");
      const academy = academies.find((a) => a.id === academyId);
      if (!academy) throw new Error("Atualize suas academias para continuar.");
      select(academy, "student");
      router.replace("/student");
    },
  });
  const accept = useMutation({
    mutationFn: async () => {
      if (!preview.data)
        throw new Error("Confira o convite antes de continuar.");
      if (!preview.data.cpf_registered && cpf.trim() && !validCPF(cpf))
        throw new Error("Informe um CPF válido do próprio aluno.");
      return api<Student>("/v1/invitations/" + token + "/accept", {
        method: "POST",
        body:
          !preview.data.cpf_registered && cpf.trim()
            ? { cpf: cpfDigits(cpf) }
            : {},
      });
    },
    onSuccess: (student) => {
      setAcceptedAcademy(student.academy_id);
      enter.mutate(student.academy_id);
    },
  });
  async function confirm() {
    if (submitting.current || acceptedAcademy) return;
    submitting.current = true;
    try {
      await accept.mutateAsync();
    } catch {
      // The mutation displays the error and retains the typed CPF.
    } finally {
      submitting.current = false;
    }
  }
  if (!ready)
    return (
      <Page>
        <Loading />
      </Page>
    );
  if (!session)
    return (
      <Redirect
        href={{ pathname: "/login", params: { next: "/invite/" + token } }}
      />
    );
  const busy = accept.isPending || enter.isPending;
  return (
    <Page title="Convite da academia">
      {!personal ? (
        <Notice message="Este convite é pessoal. Entre com a conta do aluno para continuar." />
      ) : !validToken ? (
        <Notice message="Convite inválido. Peça um novo link à academia." />
      ) : acceptedAcademy ? (
        <>
          <Notice
            success
            message="Cadastro vinculado com sucesso. Este convite já foi utilizado."
          />
          <Notice message={enter.error?.message} />
          <Button
            loading={enter.isPending}
            onPress={() => enter.mutate(acceptedAcademy)}
          >
            Acessar minha academia
          </Button>
        </>
      ) : preview.isPending ? (
        <Loading />
      ) : preview.error ? (
        <>
          <Notice message={preview.error.message} />
          <Button secondary onPress={() => void preview.refetch()}>
            Conferir convite novamente
          </Button>
          <Label muted>
            Se você já aceitou este convite, acesse normalmente sua academia.
          </Label>
          <Button secondary onPress={() => router.replace("/entry")}>
            Minhas academias
          </Button>
        </>
      ) : preview.data ? (
        <>
          <Card>
            <Badge label="Convite pessoal • uso único" tone="blue" />
            <Label muted>Você está entrando em</Label>
            <Heading>{preview.data.academy_name}</Heading>
            <Label>Aluno: {preview.data.student_name}</Label>
            <Label>Conta: {personal ? session.user.email : ""}</Label>
            <Label muted>
              Este link vincula somente este aluno a esta academia. Você terá
              acesso às suas mensalidades e presenças.
            </Label>
            {preview.data.cpf_registered ? (
              <Label muted>
                O CPF já foi informado pela academia. Se houver um erro, peça ao
                gestor para corrigir o cadastro.
              </Label>
            ) : (
              <>
                <Field
                  label="Seu CPF (opcional)"
                  value={cpf}
                  onChangeText={(value) => setCPF(formatCPF(value))}
                  keyboardType="number-pad"
                  placeholder="000.000.000-00"
                  maxLength={14}
                  editable={!busy}
                />
                <Label muted>
                  Este é um dado cadastral do aluno. No tablet, ele usará seu
                  número de 5 dígitos ou QR Code.
                </Label>
              </>
            )}
            <Label muted>
              Válido até{" "}
              {new Date(preview.data.expires_at).toLocaleDateString("pt-BR")}.
              Ao confirmar, este link não poderá ser utilizado novamente.
            </Label>
          </Card>
          <Notice message={accept.error?.message} />
          <Button loading={busy} onPress={() => void confirm()}>
            Confirmar vínculo com a academia
          </Button>
        </>
      ) : null}
      <Button secondary disabled={busy} onPress={() => void logout()}>
        Entrar com outra conta
      </Button>
    </Page>
  );
}
