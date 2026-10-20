import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Chip, Field, Label, Notice, Row } from "../../components/ui";
import { Icon } from "../../components/Icon";
import { Class, Member } from "../../types";
import { Catalog } from "../../types/billing";
import { api, academyPath } from "../../services/api";
import { queryClient } from "../../services/session";
import { colors } from "../../theme";
import { ClassDialog } from "./ClassDialog";
import { WeeklyEditor } from "./WeeklyEditor";
import { emptyGroup, expandWeekly, groupWeekly } from "./weekly";

export function ClassEditor({
  academyId,
  initial,
  modalities,
  onClose,
}: {
  academyId: string;
  initial?: Class;
  modalities: Catalog[];
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [modality, setModality] = useState(initial?.modality_id ?? "");
  const [teacher, setTeacher] = useState(initial?.teacher_membership_id ?? "");
  const [details, setDetails] = useState(false);
  const [error, setError] = useState("");
  const [groups, setGroups] = useState(() => {
    const saved = groupWeekly(initial?.schedules ?? []);
    return saved.length ? saved : [emptyGroup()];
  });
  const members = useQuery({
    queryKey: ["members", academyId],
    queryFn: () => api<Member[]>(academyPath(academyId, "/members")),
    enabled: details,
  });
  const save = useMutation({
    mutationFn: (body: object) =>
      api<Class>(
        academyPath(academyId, "/classes" + (initial ? "/" + initial.id : "")),
        { method: initial ? "PATCH" : "POST", body },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      onClose();
    },
  });
  function submit() {
    try {
      const selected = modalities.find((m) => m.id === modality);
      if (!selected) throw new Error("Escolha a modalidade.");
      const title = name.trim() || selected.name;
      if (title.length < 2 || title.length > 100)
        throw new Error("O nome deve ter de 2 a 100 caracteres.");
      const schedules = expandWeekly(groups);
      setError("");
      save.mutate({
        name: title,
        modality_id: modality,
        teacher_membership_id: teacher,
        clear_teacher: !teacher,
        schedules,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Confira a agenda.");
    }
  }
  let count = 0;
  try {
    count = expandWeekly(groups).length;
  } catch {
    /* Incomplete drafts remain editable. */
  }
  return (
    <ClassDialog
      title={initial ? "Editar turma e agenda" : "Nova turma"}
      wide
      pending={save.isPending}
      onClose={onClose}
      footer={
        <>
          <Button compact secondary disabled={save.isPending} onPress={onClose}>
            Cancelar
          </Button>
          <Button compact loading={save.isPending} onPress={submit}>
            {initial ? "Salvar alterações" : "Criar turma"}
          </Button>
        </>
      }
    >
      <Label muted>
        Cadastre uma vez. A turma permanece na grade até você editar, pausar ou
        excluir.
      </Label>
      <View style={{ gap: 10 }}>
        <Label>Modalidade</Label>
        <Row>
          {modalities
            .filter((m) => m.active || m.id === initial?.modality_id)
            .map((m) => (
              <Chip
                key={m.id}
                selected={m.id === modality}
                onPress={save.isPending ? undefined : () => setModality(m.id)}
              >
                {m.name}
              </Chip>
            ))}
        </Row>
        {!modalities.length ? (
          <Notice message="Cadastre uma modalidade em Mais → Modalidades e planos." />
        ) : null}
      </View>
      <Field
        label="Nome da turma (opcional)"
        value={name}
        onChangeText={setName}
        placeholder={
          modalities.find((m) => m.id === modality)?.name ??
          "Ex.: Jiu-Jitsu Adulto"
        }
        editable={!save.isPending}
        autoCapitalize="words"
      />
      <WeeklyEditor
        groups={groups}
        onChange={(value) => {
          setGroups(value);
          setError("");
        }}
        disabled={save.isPending}
      />
      {count ? (
        <Label muted>
          {count} {count === 1 ? "horário semanal" : "horários semanais"} •
          Repetição contínua, sem data final.
        </Label>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: details }}
        disabled={save.isPending}
        onPress={() => setDetails(!details)}
        style={{
          flexDirection: "row",
          gap: 8,
          alignItems: "center",
          minHeight: 44,
        }}
      >
        <Icon name="users" size={16} color={colors.muted} />
        <Text
          style={{
            fontFamily: "Inter_600SemiBold",
            fontSize: 13,
            color: colors.muted,
          }}
        >
          {details ? "Ocultar responsável" : "Responsável (opcional)"}
        </Text>
      </Pressable>
      {details ? (
        <View style={{ gap: 12 }}>
          <Row>
            <Chip
              selected={!teacher}
              onPress={save.isPending ? undefined : () => setTeacher("")}
            >
              Sem professor
            </Chip>
            {members.data
              ?.filter(
                (m) => m.status === "active" && m.roles.includes("teacher"),
              )
              .map((m) => (
                <Chip
                  key={m.id}
                  selected={teacher === m.id}
                  onPress={save.isPending ? undefined : () => setTeacher(m.id)}
                >
                  {m.name}
                </Chip>
              ))}
          </Row>
          <Notice message={members.error?.message} />
        </View>
      ) : null}
      {initial ? (
        <Label muted>
          As mudanças atualizam a grade semanal. O histórico de presenças de
          cada dia é preservado.
        </Label>
      ) : null}
      <Notice message={error || save.error?.message} />
    </ClassDialog>
  );
}
