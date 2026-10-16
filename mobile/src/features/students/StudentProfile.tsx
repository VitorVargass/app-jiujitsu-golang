import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { Icon } from "../../components/Icon";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Field,
  Heading,
  Label,
  Notice,
} from "../../components/ui";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { EditorDialog } from "../../components/EditorDialog";
import { Catalog, Student } from "../../types/billing";
import { formatCPF } from "../../types/cpf";
import { formatBirth, ageOn } from "../../types/age";
import { StudentEnrollment } from "./StudentEnrollment";
import { StudentAttendances } from "./StudentAttendances";
import { colors, accents } from "../../theme";
import { api, academyPath } from "../../services/api";
import { queryClient, useSession } from "../../services/session";
import { portalLink } from "../../services/links";
import { AcademyShell } from "../shared/AcademyShell";
import StudentForm from "./StudentForm";
import { StudentSection, StudentSectionEditor } from "./StudentSectionEditor";

function Edit({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [s.edit, pressed && { opacity: 0.6 }]}
    >
      <Icon name="edit" size={16} color={accents.blue.color} />
    </Pressable>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.detail}>
      <Text style={s.caption}>{label}</Text>
      <Text selectable style={s.value}>
        {value || "Não informado"}
      </Text>
    </View>
  );
}
export default function StudentProfile({
  student,
  modalities,
  plans,
}: {
  student: Student;
  modalities: Catalog[];
  plans: Catalog[];
}) {
  const { academy } = useSession(),
    a = academy!;
  const [tab, setTab] = useState<"enrollment" | "attendance" | "personal">(
    "enrollment",
  );
  const [editor, setEditor] = useState<StudentSection | null>(null),
    [full, setFull] = useState<number | null>(null);
  const [menu, setMenu] = useState(false),
    [archive, setArchive] = useState(false),
    [message, setMessage] = useState(""),
    [link, setLink] = useState("");
  const archived = !!student.archived_at;
  const age = ageOn(student.birth_date, a.timezone);
  const invite = useMutation({
    mutationFn: () =>
      api<{ token: string }>(
        academyPath(a.id, "/students/" + student.id + "/invitations"),
        { method: "POST" },
      ),
    onSuccess: async (result) => {
      const value = portalLink("/invite/" + result.token);
      setLink(value);
      const copied = await Clipboard.setStringAsync(value);
      setMessage(
        copied
          ? "Convite copiado. Envie ao aluno; válido por sete dias."
          : "Convite gerado. Copie o link abaixo.",
      );
    },
  });
  const revoke = useMutation({
    mutationFn: () =>
      api(academyPath(a.id, "/students/" + student.id + "/invitations"), {
        method: "DELETE",
      }),
    onSuccess: () => {
      setLink("");
      setMessage("Convites pendentes revogados.");
    },
  });
  const lifecycle = useMutation({
    mutationFn: () =>
      api<Student>(
        academyPath(
          a.id,
          "/students/" + student.id + (archived ? "/restore" : "/archive"),
        ),
        { method: "POST" },
      ),
    onSuccess: (value) => {
      queryClient.setQueryData(["student", a.id, student.id], value);
      void queryClient.invalidateQueries();
      setArchive(false);
      setMessage(
        archived
          ? "Aluno restaurado. Revise a competência antes de ativar a cobrança."
          : "Aluno arquivado. Históricos e débitos preservados.",
      );
    },
  });
  if (full !== null)
    return (
      <StudentForm
        initial={student}
        modalities={modalities}
        plans={plans}
        startStep={full}
        onExit={() => setFull(null)}
      />
    );
  function edit(section: StudentSection) {
    setMessage("");
    setEditor(section);
  }
  return (
    <AcademyShell
      title="Aluno"
      swipeEnabled={false}
      titleAction={
        <Button
          compact
          secondary
          icon="chevron-left"
          onPress={() => router.replace("/students")}
        >
          Alunos
        </Button>
      }
    >
      <Notice success message={message} />
      <View style={s.hero}>
        <View style={s.identity}>
          <Avatar name={student.name} />
          <View style={{ flex: 1, gap: 8, minWidth: 0 }}>
            <Text style={s.name}>{student.name}</Text>
            <Badge
              label={
                archived
                  ? "Arquivado"
                  : student.status === "active"
                    ? "Aluno ativo"
                    : "Inativo"
              }
              tone={
                archived
                  ? "amber"
                  : student.status === "active"
                    ? "mint"
                    : "coral"
              }
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Opções do aluno"
            onPress={() => setMenu(true)}
            style={s.edit}
          >
            <Icon name="more" color={colors.muted} />
          </Pressable>
        </View>
        {archived ? (
          <View style={{ gap: 12 }}>
            <Label muted>
              O cadastro está preservado. Restaure para permitir novos treinos.
            </Label>
            <Button
              compact
              onPress={() => {
                lifecycle.reset();
                setArchive(true);
              }}
            >
              Restaurar aluno
            </Button>
          </View>
        ) : null}
      </View>
      <View accessibilityRole="tablist" style={s.tabs}>
        {(
          [
            { id: "enrollment", label: "Matrícula", icon: "wallet" },
            { id: "attendance", label: "Presenças", icon: "calendar" },
            { id: "personal", label: "Dados", icon: "users" },
          ] as const
        ).map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item.id }}
            onPress={() => setTab(item.id)}
            style={[s.tab, tab === item.id && s.tabActive]}
          >
            <Icon
              name={item.icon}
              size={18}
              color={tab === item.id ? accents.mint.color : colors.muted}
            />
            <Text
              style={[s.tabText, tab === item.id && { color: colors.text }]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {tab === "enrollment" ? (
        <StudentEnrollment
          student={student}
          modalities={modalities}
          plans={plans}
          timezone={a.timezone}
          onEdit={edit}
          onContract={() => setFull(student.birth_date ? 1 : 0)}
        />
      ) : null}
      {tab === "attendance" ? (
        <StudentAttendances key={student.id} studentId={student.id} />
      ) : null}
      {tab === "personal" ? (
        <>
          <Card>
            <View style={s.sectionHeading}>
              <View style={s.titleWithIcon}>
                <Icon name="edit" size={18} color={accents.blue.color} />
                <Heading>Dados pessoais</Heading>
              </View>
              {!archived ? (
                <Edit
                  label="Editar dados pessoais"
                  onPress={() => edit("personal")}
                />
              ) : null}
            </View>
            <View style={s.details}>
              <Detail
                label="CPF do aluno"
                value={
                  student.cpf
                    ? formatCPF(student.cpf)
                    : "Pendente de atualização"
                }
              />
              <Detail
                label="Nascimento"
                value={
                  student.birth_date
                    ? formatBirth(student.birth_date) +
                      (age !== null ? " · " + age + " anos" : "")
                    : "Pendente de atualização"
                }
              />
              <Detail label="E-mail" value={student.email} />
              <Detail label="Celular" value={student.phone} />
              <Detail
                label="Telefone alternativo"
                value={student.alternate_phone}
              />
            </View>
          </Card>
          <Card>
            <View style={s.sectionHeading}>
              <View style={s.titleWithIcon}>
                <Icon name="qr" size={18} color={accents.amber.color} />
                <Heading>Acesso do aluno</Heading>
              </View>
              <Badge
                label={student.user_id ? "Conta vinculada" : "Sem conta"}
                tone={student.user_id ? "mint" : "blue"}
              />
            </View>
            <Label muted>
              {student.user_id
                ? "O aluno já pode entrar no portal para consultar mensalidades, presenças e QR."
                : "O convite permite ao aluno criar uma conta ou entrar com uma existente para acessar seu portal."}
            </Label>
            {!archived && !student.user_id ? (
              <View style={{ alignItems: "flex-start", gap: 10 }}>
                <Button
                  compact
                  icon="plus"
                  loading={invite.isPending}
                  onPress={() => invite.mutate()}
                >
                  Gerar convite
                </Button>
                {link ? (
                  <>
                    <Field
                      label="Convite do aluno"
                      value={link}
                      editable={false}
                      selectTextOnFocus
                    />
                    <Button
                      compact
                      secondary
                      loading={revoke.isPending}
                      onPress={() => revoke.mutate()}
                    >
                      Revogar convite
                    </Button>
                  </>
                ) : null}
              </View>
            ) : null}
            <Notice message={invite.error?.message || revoke.error?.message} />
          </Card>
        </>
      ) : null}
      {editor ? (
        <StudentSectionEditor
          key={typeof editor === "string" ? editor : editor.rank}
          academyId={a.id}
          timezone={a.timezone}
          student={student}
          modalities={modalities}
          section={editor}
          onClose={() => setEditor(null)}
        />
      ) : null}
      {menu ? (
        <EditorDialog title="Opções do aluno" onClose={() => setMenu(false)}>
          {!archived ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setMenu(false);
                setFull(0);
              }}
              style={s.menuItem}
            >
              <Icon name="edit" size={18} color={colors.muted} />
              <Text style={s.value}>Editar cadastro completo</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              lifecycle.reset();
              setMenu(false);
              setArchive(true);
            }}
            style={s.menuItem}
          >
            <Icon
              name="users"
              size={18}
              color={archived ? colors.primary : colors.danger}
            />
            <Text
              style={[
                s.value,
                { color: archived ? colors.primary : colors.danger },
              ]}
            >
              {archived ? "Restaurar aluno" : "Arquivar aluno"}
            </Text>
          </Pressable>
          <Label muted>
            {archived
              ? "Restaure o mesmo cadastro, com CPF e histórico."
              : "Arquivar interrompe novos treinos e cobranças, preservando o cadastro e os débitos."}
          </Label>
        </EditorDialog>
      ) : null}
      <ConfirmDialog
        visible={archive}
        title={archived ? "Restaurar aluno?" : "Arquivar aluno?"}
        message={
          archived
            ? "O aluno poderá treinar novamente. A cobrança automática permanecerá desativada até você revisar a competência e ativá-la."
            : "Novos check-ins e mensalidades serão interrompidos. CPF, QR, graduações, histórico e débitos serão preservados."
        }
        confirmLabel={
          archived ? "Confirmar restauração" : "Confirmar arquivamento"
        }
        pending={lifecycle.isPending}
        error={lifecycle.error?.message}
        onCancel={() => setArchive(false)}
        onConfirm={() => lifecycle.mutate()}
      />
    </AcademyShell>
  );
}
const s = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    padding: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  tabActive: { backgroundColor: accents.mint.soft },
  tabText: { fontFamily: "Lato_700Bold", fontSize: 13, color: colors.muted },

  hero: {
    padding: 20,
    gap: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: accents.blue.border,
    backgroundColor: colors.surface,
  },
  identity: { flexDirection: "row", alignItems: "center", gap: 14 },
  name: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 22,
    lineHeight: 30,
    color: colors.text,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    alignItems: "flex-start",
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  titleWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    flexShrink: 1,
  },
  edit: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  value: {
    fontFamily: "Lato_700Bold",
    fontSize: 14,
    color: colors.text,
    lineHeight: 21,
    flexShrink: 1,
  },
  caption: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: colors.muted,
    lineHeight: 19,
  },
  textAction: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    minHeight: 44,
    flexWrap: "wrap",
  },
  actionText: {
    fontFamily: "Lato_700Bold",
    fontSize: 12,
    color: accents.blue.color,
  },
  amount: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 28,
    color: colors.text,
  },
  amountSuffix: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: colors.muted,
  },
  detailRow: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  detail: { gap: 5, minWidth: 120, flexGrow: 1, flexBasis: "44%" },
  details: { flexDirection: "row", flexWrap: "wrap", gap: 20 },
  payer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: 10,
  },
  menuItem: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    minHeight: 48,
  },
});
