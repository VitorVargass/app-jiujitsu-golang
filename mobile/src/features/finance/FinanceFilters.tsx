import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { EditorDialog } from "../../components/EditorDialog";
import { MonthPicker } from "../../components/BillingDatePicker";
import {
  Button,
  Chip,
  Label,
  Loading,
  Notice,
  Row,
  SearchBar,
} from "../../components/ui";
import { api, academyPath } from "../../services/api";
import { Invoice, Page, Student, statusLabel } from "../../types/billing";
import { academyDate } from "../../types/attendance";
import { accents, colors } from "../../theme";

export type FinanceFilterValue = {
  month: string;
  status: Invoice["status"] | "";
  student: { id: string; name: string } | null;
};

export function defaultFinanceFilters(timezone: string): FinanceFilterValue {
  return {
    month: academyDate(timezone).slice(0, 7),
    status: "",
    student: null,
  };
}

export function FinanceFilters({
  academyId,
  timezone,
  value,
  student = false,
  onApply,
  onClose,
}: {
  academyId: string;
  timezone: string;
  value: FinanceFilterValue;
  student?: boolean;
  onApply: (value: FinanceFilterValue) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [search, setSearch] = useState("");
  const term = search.trim();
  const students = useQuery({
    queryKey: ["finance-filter-students", academyId, term],
    queryFn: async () => {
      const path =
        "/students?search=" + encodeURIComponent(term) + "&page_size=10";
      const [current, archived] = await Promise.all([
        api<Page<Student>>(academyPath(academyId, path)),
        api<Page<Student>>(academyPath(academyId, path + "&status=archived")),
      ]);
      const items = Array.from(
        new Map(
          [...current.items, ...archived.items].map((item) => [item.id, item]),
        ).values(),
      ).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      const overlap = current.items.filter((item) =>
        archived.items.some((old) => old.id === item.id),
      ).length;
      return {
        items: items.slice(0, 10),
        total: current.total + archived.total - overlap,
      };
    },
    enabled: !student && term.length >= 2,
  });

  return (
    <EditorDialog
      title="Filtros do financeiro"
      onClose={onClose}
      footer={
        <>
          <Button
            compact
            secondary
            onPress={() => {
              setDraft(defaultFinanceFilters(timezone));
              setSearch("");
            }}
          >
            Restaurar padrão
          </Button>
          <Button compact onPress={() => onApply(draft)}>
            Aplicar filtros
          </Button>
        </>
      }
    >
      <View style={s.section}>
        <MonthPicker
          label="Mês das mensalidades"
          value={draft.month}
          allowClear
          onChange={(month) => setDraft({ ...draft, month })}
        />
        <Text style={s.hint}>
          O padrão é este mês. Você também pode consultar outros meses ou todo o
          período.
        </Text>
      </View>
      <View style={s.section}>
        <Label>Situação do pagamento</Label>
        <Row>
          {(["", "open", "paid", "overdue", "cancelled"] as const).map(
            (status) => (
              <Chip
                key={status}
                selected={draft.status === status}
                onPress={() => setDraft({ ...draft, status })}
              >
                {status ? statusLabel[status] : "Todas"}
              </Chip>
            ),
          )}
        </Row>
      </View>
      {!student ? (
        <View style={s.section}>
          <Label>Aluno</Label>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Filtrar mensalidades por aluno"
          >
            <StudentOption
              label="Todos os alunos"
              selected={!draft.student}
              onPress={() => setDraft({ ...draft, student: null })}
            />
            {draft.student ? (
              <StudentOption
                label={draft.student.name}
                selected
                onPress={() => undefined}
              />
            ) : null}
          </View>
          <SearchBar
            label="Buscar aluno no financeiro"
            placeholder="Digite o nome do aluno"
            value={search}
            onChangeText={setSearch}
          />
          {term.length >= 2 ? (
            students.isFetching ? (
              <Loading />
            ) : students.error ? (
              <>
                <Notice message={students.error.message} />
                <Button
                  compact
                  secondary
                  onPress={() => void students.refetch()}
                >
                  Tentar novamente
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
                    <StudentOption
                      key={item.id}
                      label={item.name}
                      description={
                        item.archived_at ? "Aluno arquivado" : undefined
                      }
                      selected={false}
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
                    Nenhum aluno encontrado. Tente outro nome.
                  </Text>
                ) : null}
                {students.data &&
                students.data.total > students.data.items.length ? (
                  <Text style={s.hint}>
                    Refine o nome para encontrar mais resultados.
                  </Text>
                ) : null}
              </View>
            )
          ) : (
            <Text style={s.hint}>
              Digite ao menos 2 caracteres para buscar, inclusive alunos
              arquivados.
            </Text>
          )}
        </View>
      ) : null}
    </EditorDialog>
  );
}

function StudentOption({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        s.option,
        selected && s.selected,
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={s.name}>{label}</Text>
        {description ? <Text style={s.hint}>{description}</Text> : null}
      </View>
      <View style={[s.radio, selected && { borderColor: colors.primaryLight }]}>
        {selected ? <View style={s.dot} /> : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  section: { gap: 12 },
  hint: {
    color: colors.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 19,
  },
  option: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 12,
    marginBottom: 4,
  },
  selected: {
    backgroundColor: accents.brand.soft,
    borderColor: accents.brand.border,
  },
  name: { color: colors.text, fontFamily: "Inter_600SemiBold", fontSize: 13 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primaryLight,
  },
});
