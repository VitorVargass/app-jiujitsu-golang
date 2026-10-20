import { useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import QRCode from "react-native-qrcode-svg";
import { PersonalGate, AcademyShell } from "../shared/AcademyShell";
import {
  Button,
  Card,
  Field,
  Heading,
  Label,
  Loading,
  Notice,
  Badge,
} from "../../components/ui";
import { EditorDialog } from "../../components/EditorDialog";
import { Icon } from "../../components/Icon";
import { api, academyPath } from "../../services/api";
import { queryClient, useSession } from "../../services/session";
import { formatCPF, cpfDigits, validCPF } from "../../types/cpf";
import { Participation } from "../../types";
import { StudentAttendances } from "../students/StudentAttendances";
import { colors, accents } from "../../theme";

function EditCPF({
  profile,
  onClose,
}: {
  profile: Participation;
  onClose: () => void;
}) {
  const [cpf, setCPF] = useState(formatCPF(profile.cpf));
  const save = useMutation({
    mutationFn: () => {
      if (!validCPF(cpf)) throw new Error("Informe seu CPF válido.");
      return api<Participation>(
        academyPath(profile.academy_id, "/me/participation"),
        { method: "PATCH", body: { cpf: cpfDigits(cpf) } },
      );
    },
    onSuccess: (v) => {
      queryClient.setQueryData(["participation", profile.academy_id], v);
      void queryClient.invalidateQueries();
      onClose();
    },
  });
  return (
    <EditorDialog
      title="Meu CPF"
      onClose={onClose}
      pending={save.isPending}
      footer={
        <>
          <Button compact secondary onPress={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button
            compact
            loading={save.isPending}
            onPress={() => save.mutate()}
          >
            Salvar CPF
          </Button>
        </>
      }
    >
      <Field
        label="Meu CPF"
        value={cpf}
        onChangeText={(v) => setCPF(formatCPF(v))}
        keyboardType="number-pad"
        maxLength={14}
        editable={!save.isPending}
      />
      <Label muted>
        Use seu próprio CPF para registrar presença no tablet da academia.
      </Label>
      <Notice message={save.error?.message} />
    </EditorDialog>
  );
}
function Content() {
  const { academy } = useSession(),
    a = academy!;
  const { width } = useWindowDimensions();
  const [editing, setEditing] = useState(false);
  const q = useQuery({
    queryKey: ["participation", a.id],
    queryFn: () => api<Participation>(academyPath(a.id, "/me/participation")),
  });
  return (
    <AcademyShell title="Minha participação" swipeEnabled={false}>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <>
          <Notice message={q.error.message} />
          <Button secondary compact onPress={() => void q.refetch()}>
            Tentar novamente
          </Button>
        </>
      ) : (
        <>
          <Card>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <Icon name="users" color={accents.blue.color} />
              <View style={{ flex: 1, minWidth: 165, gap: 5 }}>
                <Heading>{q.data.name}</Heading>
                <Label muted>{q.data.email}</Label>
              </View>
            </View>
            <Label muted>
              Seu histórico de treinos é independente de plano ou mensalidade.
            </Label>
            <Badge
              label={
                q.data.has_student_registration
                  ? "Também possui matrícula de aluno"
                  : "Participação sem matrícula financeira"
              }
              tone="blue"
            />
            <View style={s.identity}>
              <View style={{ flex: 1, minWidth: 165, gap: 5 }}>
                <Text style={s.caption}>CPF para presença</Text>
                <Text selectable style={s.cpf}>
                  {q.data.cpf ? formatCPF(q.data.cpf) : "Não informado"}
                </Text>
              </View>
              <Button
                compact
                secondary
                icon="edit"
                onPress={() => setEditing(true)}
              >
                {q.data.cpf ? "Editar CPF" : "Informar CPF"}
              </Button>
            </View>
            {q.data.cpf && q.data.can_check_in ? (
              <View style={{ alignItems: "center", gap: 10 }}>
                <View
                  style={{
                    backgroundColor: "white",
                    padding: 20,
                    borderRadius: 12,
                  }}
                >
                  <QRCode
                    value={q.data.qr_token}
                    size={Math.min(180, width - 120)}
                    color="black"
                    backgroundColor="white"
                  />
                </View>
                <Label muted>
                  Digite seu CPF ou apresente este QR no tablet.
                </Label>
              </View>
            ) : (
              <Notice
                message={
                  q.data.can_check_in
                    ? "Informe seu CPF antes do primeiro check-in."
                    : "Sua participação está inativa para novos check-ins. O histórico continua disponível."
                }
              />
            )}
          </Card>
          <StudentAttendances own />
          {editing ? (
            <EditCPF profile={q.data} onClose={() => setEditing(false)} />
          ) : null}
        </>
      )}
    </AcademyShell>
  );
}
export default function ParticipationScreen() {
  return (
    <PersonalGate>
      <Content />
    </PersonalGate>
  );
}
const s = StyleSheet.create({
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  caption: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: colors.muted,
  },
  cpf: { fontFamily: "Inter_600SemiBold", fontSize: 18, color: colors.text },
});
