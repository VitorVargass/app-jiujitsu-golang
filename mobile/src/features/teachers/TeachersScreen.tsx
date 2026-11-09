import { useState } from "react";
import { Text, View } from "react-native";
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
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { EditorDialog } from "../../components/EditorDialog";
import { ResponsiveGrid } from "../../components/ResponsiveGrid";
import { api, academyPath, APIError } from "../../services/api";
import { queryClient, useSession } from "../../services/session";
import { useThemedStyles } from "../../theme/ThemeProvider";
import { createThemedStyles } from "../../theme";

type Teacher = {
  can_remove: boolean;
  id: string;
  user_id: string;
  name: string;
  email: string;
  status: "active" | "blocked";
};

function TeacherEditor({
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
      api<Teacher>(academyPath(academyId, "/teachers"), {
        method: "POST",
        body: existing
          ? { email: email.trim(), link_existing: true }
          : { name: name.trim(), email: email.trim(), password },
      }),
    onSuccess: () => {
      setPassword("");
      void queryClient.invalidateQueries({ queryKey: ["teachers", academyId] });
      void queryClient.invalidateQueries({ queryKey: ["members", academyId] });
      void queryClient.invalidateQueries({ queryKey: ["academies"] });
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
      title="Adicionar professor"
      pending={save.isPending}
      onClose={onClose}
      footer={
        <>
          <Button compact secondary disabled={save.isPending} onPress={onClose}>
            Cancelar
          </Button>
          <Button compact loading={save.isPending} onPress={submit}>
            {existing ? "Vincular como professor" : "Criar acesso de professor"}
          </Button>
        </>
      }
    >
      <Label>
        A pessoa terá acesso aos alunos, presenças e graduações desta academia.
        Não terá acesso ao financeiro ou às configurações.
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
          label="Nome do professor"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoComplete="name"
          maxLength={100}
          editable={!save.isPending}
        />
      )}
      <Field
        label="E-mail do professor"
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
                  ? "Ocultar senha do professor"
                  : "Mostrar senha do professor"
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
  const s = useThemedStyles(themedS);
  const { academy, session } = useSession();
  const academyId = academy!.id;
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Teacher | null>(null);
  const remove = useMutation({
    mutationFn: (teacher: Teacher) =>
      api(academyPath(academyId, "/teachers/" + teacher.id), {
        method: "DELETE",
      }),
    onSuccess: () => {
      setRemoving(null);
      setMessage("Acesso de professor removido.");
      void queryClient.invalidateQueries({ queryKey: ["teachers", academyId] });
      void queryClient.invalidateQueries({ queryKey: ["members", academyId] });
      void queryClient.invalidateQueries({ queryKey: ["academies"] });
    },
  });
  const [message, setMessage] = useState("");
  const teachers = useQuery({
    queryKey: ["teachers", academyId],
    queryFn: () => api<Teacher[]>(academyPath(academyId, "/teachers")),
  });
  return (
    <AcademyShell
      title="Professores"
      subtitle="Pessoas que acompanham os alunos desta academia"
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
          Adicionar professor
        </Button>
      }
    >
      <Label muted>
        Cada professor usa seu próprio e-mail e senha para acompanhar alunos,
        turmas, presenças e graduações, sem acesso ao financeiro.
      </Label>
      <Notice success message={message} />
      {teachers.isPending ? (
        <Loading />
      ) : teachers.error ? (
        <Card>
          <Notice message={teachers.error.message} />
          <Button compact secondary onPress={() => void teachers.refetch()}>
            Tentar novamente
          </Button>
        </Card>
      ) : teachers.data?.length ? (
        <>
          <Text style={s.count}>
            {teachers.data.length}{" "}
            {teachers.data.length === 1
              ? "professor cadastrado"
              : "professores cadastrados"}
          </Text>
          <ResponsiveGrid>
            {teachers.data.map((teacher) => (
              <Card key={teacher.id}>
                <View style={s.heading}>
                  <Avatar name={teacher.name} />
                  <View style={s.identity}>
                    <Heading>{teacher.name}</Heading>
                    <Text selectable style={s.email}>
                      {teacher.email}
                    </Text>
                  </View>
                </View>
                <Row>
                  <Badge
                    label={
                      teacher.status === "active"
                        ? "Professor ativo"
                        : "Acesso bloqueado"
                    }
                    tone={teacher.status === "active" ? "mint" : "slate"}
                  />
                  {session?.kind === "user" &&
                  teacher.user_id === session.user.id ? (
                    <Badge label="Você" tone="brand" />
                  ) : null}
                </Row>
                {teacher.can_remove ? (
                  <Button
                    compact
                    danger
                    onPress={() => {
                      remove.reset();
                      setRemoving(teacher);
                    }}
                  >
                    Remover professor
                  </Button>
                ) : null}
              </Card>
            ))}
          </ResponsiveGrid>
        </>
      ) : (
        <Empty>Nenhum professor encontrado.</Empty>
      )}
      <ConfirmDialog
        visible={!!removing}
        title="Remover professor?"
        message={
          (removing?.name ?? "Esta pessoa") +
          " perderá o acesso de professor nesta academia. A conta, os históricos e outros papéis serão preservados."
        }
        confirmLabel="Remover professor"
        danger
        pending={remove.isPending}
        error={remove.error?.message}
        onCancel={() => {
          if (!remove.isPending) setRemoving(null);
        }}
        onConfirm={() => {
          if (removing && !remove.isPending) remove.mutate(removing);
        }}
      />
      {adding ? (
        <TeacherEditor
          academyId={academyId}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            setMessage(
              "Professor adicionado. A pessoa já pode entrar na academia com seu próprio e-mail e senha.",
            );
          }}
        />
      ) : null}
    </AcademyShell>
  );
}
export default function TeachersScreen() {
  return (
    <RoleGate role="admin">
      <Content />
    </RoleGate>
  );
}
const themedS = createThemedStyles(({ colors }) => ({
  count: { color: colors.muted, fontFamily: "Inter_400Regular", fontSize: 12 },
  heading: { flexDirection: "row", alignItems: "center", gap: 12 },
  identity: { flex: 1, minWidth: 0, gap: 6 },
  email: {
    color: colors.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 20,
  },
}));
