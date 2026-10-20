import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { EditorDialog } from "../../components/EditorDialog";
import { Icon, IconName } from "../../components/Icon";
import {
  Avatar,
  Button,
  Label,
  Loading,
  Notice,
  SearchBar,
} from "../../components/ui";
import { academyPath, api } from "../../services/api";
import { Class } from "../../types";
import { Page, Student } from "../../types/billing";
import { accents, colors } from "../../theme";

export type HistorySelection = { id: string; name: string } | null;
export type AttendanceFilters = {
  classroom: HistorySelection;
  student: HistorySelection;
};

function Option({
  label,
  description,
  selected,
  onPress,
  icon,
  avatar,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
  avatar?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={
        avatar && description ? label + ", " + description : label
      }
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        s.option,
        selected && s.chosen,
        pressed && { opacity: 0.7 },
      ]}
    >
      {avatar ? (
        <Avatar name={label} />
      ) : (
        <Icon
          name={icon ?? "users"}
          color={selected ? colors.primaryLight : colors.muted}
          size={20}
        />
      )}
      <View style={s.copy}>
        <Text style={s.name}>{label}</Text>
        {description ? <Text style={s.caption}>{description}</Text> : null}
      </View>
      <View style={[s.radio, selected && s.radioOn]}>
        {selected ? <View style={s.dot} /> : null}
      </View>
    </Pressable>
  );
}

export function HistoryFilters({
  academyId,
  value,
  onApply,
  onClose,
}: {
  academyId: string;
  value: AttendanceFilters;
  onApply: (value: AttendanceFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [search, setSearch] = useState("");
  const [classSearch, setClassSearch] = useState("");
  const term = search.trim();
  const classes = useQuery({
    queryKey: ["classes", academyId],
    queryFn: () => api<Class[]>(academyPath(academyId, "/classes")),
  });
  const students = useQuery({
    queryKey: ["attendance-history-students", academyId, term],
    queryFn: async () => {
      const path =
        "/students?search=" + encodeURIComponent(term) + "&page_size=10";
      const [current, archived] = await Promise.all([
        api<Page<Student>>(academyPath(academyId, path)),
        api<Page<Student>>(academyPath(academyId, path + "&status=archived")),
      ]);
      const combined = new Map(
        [...current.items, ...archived.items].map((item) => [item.id, item]),
      );
      const overlap = current.items.filter((item) =>
        archived.items.some((old) => old.id === item.id),
      ).length;
      return {
        items: Array.from(combined.values())
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
          .slice(0, 10),
        total: current.total + archived.total - overlap,
      };
    },
    enabled: term.length >= 2,
  });
  const visibleClasses = classes.data?.filter((c) =>
    (c.name + " " + c.modality_name)
      .toLocaleLowerCase("pt-BR")
      .includes(classSearch.trim().toLocaleLowerCase("pt-BR")),
  );
  return (
    <EditorDialog
      title="Filtrar presenças"
      onClose={onClose}
      footer={
        <>
          <Button
            compact
            secondary
            onPress={() => {
              setDraft({ classroom: null, student: null });
              setSearch("");
              setClassSearch("");
            }}
          >
            Limpar filtros
          </Button>
          <Button compact icon="check-circle" onPress={() => onApply(draft)}>
            Aplicar filtros
          </Button>
        </>
      }
    >
      <View style={s.section}>
        <Label>Turma</Label>
        {classes.data && classes.data.length > 6 ? (
          <SearchBar
            label="Buscar turma"
            placeholder="Nome ou modalidade"
            value={classSearch}
            onChangeText={setClassSearch}
          />
        ) : null}
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Filtrar por turma"
        >
          <Option
            label="Todas as turmas"
            icon="calendar"
            selected={!draft.classroom}
            onPress={() => setDraft({ ...draft, classroom: null })}
          />
          {classes.isPending ? (
            <Loading />
          ) : classes.error ? (
            <>
              <Notice message={classes.error.message} />
              <Button compact secondary onPress={() => void classes.refetch()}>
                Tentar carregar turmas
              </Button>
            </>
          ) : (
            <ScrollView
              style={{ maxHeight: 210 }}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {visibleClasses?.map((c) => (
                <Option
                  key={c.id}
                  label={c.name}
                  icon="calendar"
                  description={[c.modality_name, !c.active ? "Pausada" : ""]
                    .filter(Boolean)
                    .join(" · ")}
                  selected={draft.classroom?.id === c.id}
                  onPress={() =>
                    setDraft({
                      ...draft,
                      classroom: { id: c.id, name: c.name },
                    })
                  }
                />
              ))}
              {!visibleClasses?.length ? (
                <Text style={s.hint}>Nenhuma turma encontrada.</Text>
              ) : null}
            </ScrollView>
          )}
        </View>
      </View>
      <View style={s.section}>
        <Label>Aluno</Label>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Filtrar por aluno"
        >
          <Option
            label="Todos os alunos"
            selected={!draft.student}
            onPress={() => setDraft({ ...draft, student: null })}
          />
          {draft.student ? (
            <Option
              label={draft.student.name}
              avatar
              selected
              onPress={() => undefined}
            />
          ) : null}
        </View>
        <SearchBar
          label="Buscar aluno no histórico"
          placeholder="Busque por nome ou CPF"
          value={search}
          onChangeText={setSearch}
        />
        {term.length < 2 ? (
          <Text style={s.hint}>
            Digite ao menos 2 caracteres para encontrar um aluno, inclusive
            arquivado.
          </Text>
        ) : students.isFetching ? (
          <Loading />
        ) : students.error ? (
          <>
            <Notice message={students.error.message} />
            <Button compact secondary onPress={() => void students.refetch()}>
              Tentar buscar aluno
            </Button>
          </>
        ) : (
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Alunos encontrados"
          >
            {students.data?.items
              .filter((item) => item.id !== draft.student?.id)
              .map((item) => (
                <Option
                  key={item.id}
                  label={item.name}
                  avatar
                  selected={false}
                  description={[
                    item.archived_at
                      ? "Cadastro arquivado"
                      : item.status === "inactive"
                        ? "Cadastro inativo"
                        : "",
                    item.cpf
                      ? "CPF final " + item.cpf.replace(/\D/g, "").slice(-4)
                      : item.email,
                  ]
                    .filter(Boolean)
                    .join(" · ")}

                  onPress={() => {
                    setDraft({
                      ...draft,
                      student: { id: item.id, name: item.name },
                    });
                    setSearch("");
                  }}
                />
              ))}
            {!students.data?.items.length ? (
              <Text style={s.hint}>
                Nenhum aluno encontrado. Tente outro nome ou CPF.
              </Text>
            ) : null}
            {students.data &&
            students.data.total > students.data.items.length ? (
              <Text style={s.hint}>
                Mostrando os primeiros 10 resultados. Refine a busca para
                encontrar o aluno.
              </Text>
            ) : null}
          </View>
        )}
      </View>
    </EditorDialog>
  );
}

const s = StyleSheet.create({
  section: { gap: 12 },
  option: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    marginBottom: 4,
  },
  chosen: {
    backgroundColor: accents.brand.soft,
    borderColor: accents.brand.border,
  },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: colors.text },
  caption: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: colors.muted,
  },
  hint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 19,
    color: colors.muted,
    paddingVertical: 8,
  },
  radio: {
    height: 18,
    width: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: colors.primaryLight },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primaryLight,
  },
});
