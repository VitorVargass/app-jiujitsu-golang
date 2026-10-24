import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AcademyShell, RoleGate } from "../shared/AcademyShell";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  Empty,
  Field,
  Heading,
  IconButton,
  Label,
  Loading,
  Notice,
  Row,
} from "../../components/ui";
import { EditorDialog } from "../../components/EditorDialog";
import { ResponsiveGrid } from "../../components/ResponsiveGrid";
import { api, academyPath, APIError } from "../../services/api";
import { queryClient, useSession } from "../../services/session";
import { colors } from "../../theme";

type Manager = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  status: "active" | "blocked";
};

function ManagerEditor({
  academyId,
  onClose,
  onSaved,
}: {
  academyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [existing, setExisting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const save = useMutation({
    mutationFn: () =>
      api<Manager>(academyPath(academyId, "/managers"), {
        method: "POST",
        body: existing
          ? { email: email.trim(), link_existing: true }
          : { name: name.trim(), email: email.trim(), password },
      }),
    onSuccess: () => {
      setPassword("");
      void queryClient.invalidateQueries({ queryKey: ["managers", academyId] });
      void queryClient.invalidateQueries({ queryKey: ["members", academyId] });
      onSaved();
    },
  });
  function mode(value: boolean) {
    setExisting(value);
    setPassword("");
    setShowPassword(false);
    setError("");
    save.reset();
  }
  function submit() {
    if (save.isPending) return;
    if (!email.trim()) {
      setError("Informe o e-mail da pessoa.");
      return;
    }
    if (!existing && name.trim().length < 2) {
      setError("Informe o nome da pessoa.");
      return;
    }
    if (!existing && password.length < 8) {
      setError("Defina uma senha com pelo menos 8 caracteres.");
      return;
    }
    setError("");
    save.mutate();
  }
  return (
    <EditorDialog
      title="Adicionar gestor"
      pending={save.isPending}
      onClose={onClose}
      footer={
        <>
          <Button compact secondary disabled={save.isPending} onPress={onClose}>
            Cancelar
          </Button>
          <Button compact loading={save.isPending} onPress={submit}>
            {existing ? "Vincular como gestor" : "Criar acesso de gestor"}
          </Button>
        </>
      }
    >
      <Label>
        A pessoa terá acesso à gestão desta academia, incluindo alunos,
        financeiro e configurações.
      </Label>
      <Row>
        <Chip
          selected={!existing}
          onPress={() => {
            if (!save.isPending) mode(false);
          }}
        >
          Nova conta
        </Chip>
        <Chip
          selected={existing}
          onPress={() => {
            if (!save.isPending) mode(true);
          }}
        >
          Conta existente
        </Chip>
      </Row>
      {existing ? (
        <Label muted>
          Informe o e-mail usado no TatameMix. O vínculo com esta academia será
          criado ou reativado. O nome e a senha da conta serão preservados.
        </Label>
      ) : (
        <Field
          label="Nome do gestor"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoComplete="name"
          maxLength={100}
          editable={!save.isPending}
        />
      )}
      <Field
        label="E-mail do gestor"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoComplete="email"
        maxLength={254}
        editable={!save.isPending}
      />
      {!existing ? (
        <View style={{ gap: 8 }}>
          <Field
            label="Senha de acesso"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="new-password"
            maxLength={72}
            editable={!save.isPending}
          />
          <Row>
            <IconButton
              icon={showPassword ? "eye-off" : "eye"}
              label={
                showPassword
                  ? "Ocultar senha do gestor"
                  : "Mostrar senha do gestor"
              }
              disabled={save.isPending}
              onPress={() => setShowPassword((v) => !v)}
            />
            <View style={{ flex: 1 }}>
              <Label muted>
                De 8 a 72 bytes. A senha não será exibida após salvar.
              </Label>
            </View>
          </Row>
        </View>
      ) : null}
      <Notice message={error || save.error?.message} />
      {!existing &&
      save.error instanceof APIError &&
      save.error.code === "account_exists" ? (
        <Button compact secondary onPress={() => mode(true)}>
          Usar conta existente
        </Button>
      ) : null}
    </EditorDialog>
  );
}
function Content() {
  const { academy, session } = useSession();
  const academyId = academy!.id;
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");
  const managers = useQuery({
    queryKey: ["managers", academyId],
    queryFn: () => api<Manager[]>(academyPath(academyId, "/managers")),
  });
  return (
    <AcademyShell
      title="Gestores"
      subtitle="Pessoas que administram esta academia"
      swipeEnabled={false}
      titleAction={
        <Button
          compact
          icon="plus"
          onPress={() => {
            setMessage("");
            setAdding(true);
          }}
        >
          Adicionar gestor
        </Button>
      }
    >
      <Label muted>
        Cada gestor usa seu próprio e-mail e senha para acessar a mesma
        academia. Os dados e as configurações são compartilhados entre os
        gestores.
      </Label>
      <Notice success message={message} />
      {managers.isPending ? (
        <Loading />
      ) : managers.error ? (
        <Card>
          <Notice message={managers.error.message} />
          <Button compact secondary onPress={() => void managers.refetch()}>
            Tentar novamente
          </Button>
        </Card>
      ) : managers.data?.length ? (
        <>
          <Text style={s.count}>
            {managers.data.length}{" "}
            {managers.data.length === 1
              ? "gestor cadastrado"
              : "gestores cadastrados"}
          </Text>
          <ResponsiveGrid>
            {managers.data.map((manager) => (
              <Card key={manager.id}>
                <View style={s.heading}>
                  <Avatar name={manager.name} />
                  <View style={s.identity}>
                    <Heading>{manager.name}</Heading>
                    <Text selectable style={s.email}>
                      {manager.email}
                    </Text>
                  </View>
                </View>
                <Row>
                  <Badge
                    label={
                      manager.status === "active"
                        ? "Gestor ativo"
                        : "Acesso bloqueado"
                    }
                    tone={manager.status === "active" ? "mint" : "slate"}
                  />
                  {session?.kind === "user" &&
                  manager.user_id === session.user.id ? (
                    <Badge label="Você" tone="brand" />
                  ) : null}
                </Row>
              </Card>
            ))}
          </ResponsiveGrid>
        </>
      ) : (
        <Empty>Nenhum gestor encontrado.</Empty>
      )}
      {adding ? (
        <ManagerEditor
          academyId={academyId}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            setMessage(
              "Gestor adicionado. A pessoa já pode entrar na academia com seu próprio e-mail e senha.",
            );
          }}
        />
      ) : null}
    </AcademyShell>
  );
}
export default function ManagersScreen() {
  return (
    <RoleGate role="admin">
      <Content />
    </RoleGate>
  );
}
const s = StyleSheet.create({
  count: { color: colors.muted, fontFamily: "Inter_400Regular", fontSize: 12 },
  heading: { flexDirection: "row", alignItems: "center", gap: 12 },
  identity: { flex: 1, minWidth: 0, gap: 6 },
  email: {
    color: colors.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 20,
  },
});
