import { useState } from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { colors } from "../../theme";
import { Icon } from "../../components/Icon";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Form from "./StudentForm";
import { AcademyShell, RoleGate } from "../shared/AcademyShell";
import {
  Button,
  Card,
  Chip,
  Avatar,
  IconButton,
  SearchBar,
  Heading,
  Label,
  Loading,
  Notice,
  Row,
} from "../../components/ui";
import { Pagination } from "../../components/Pagination";
import { api, academyPath } from "../../services/api";
import { useSession } from "../../services/session";
import { Catalog, Student, Page, money } from "../../types/billing";
function ListContent() {
  const { academy } = useSession();
  const a = academy!;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [modality, setModality] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const modalities = useQuery({
    queryKey: ["modalities", a.id],
    queryFn: () => api<Catalog[]>(academyPath(a.id, "/modalities")),
  });
  const list = useQuery({
    queryKey: ["students", a.id, search, status, modality, page],
    queryFn: () =>
      api<Page<Student>>(
        academyPath(
          a.id,
          "/students?search=" +
            encodeURIComponent(search) +
            "&status=" +
            status +
            "&modality_id=" +
            modality +
            "&page=" +
            page,
        ),
      ),
  });
  const selectedModality = modalities.data?.find((m) => m.id === modality);
  return (
    <AcademyShell
      title="Alunos"
      titleAction={
        <Button
          compact
          icon="plus"
          onPress={() =>
            router.push({ pathname: "/students/[id]", params: { id: "new" } })
          }
        >
          Novo aluno
        </Button>
      }
    >
      <View style={{ gap: 12 }}>
        <SearchBar
          label="Buscar aluno pelo nome"
          placeholder="Buscar por nome..."
          value={search}
          onChangeText={(v) => {
            setSearch(v);
            setPage(1);
          }}
          action={
            <IconButton
              icon="sliders"
              label="Filtros de modalidade"
              expanded={showFilters}
              selected={showFilters || !!modality}
              onPress={() => setShowFilters((v) => !v)}
            />
          }
        />
        <View style={listStyles.statusTabs}>
          {[
            ["", "Todos"],
            ["active", "Ativos"],
            ["inactive", "Inativos"],
          ].map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: status === value }}
              onPress={() => {
                setStatus(value);
                setPage(1);
              }}
              style={[
                listStyles.statusTab,
                status === value && listStyles.statusSelected,
              ]}
            >
              <Text
                style={[
                  listStyles.statusText,
                  status === value && { color: colors.text },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {showFilters ? (
        <Card>
          <Heading>Filtrar por modalidade</Heading>
          <Row>
            <Chip
              selected={!modality}
              onPress={() => {
                setModality("");
                setPage(1);
              }}
            >
              Todas
            </Chip>
            {modalities.data?.map((m) => (
              <Chip
                key={m.id}
                selected={m.id === modality}
                onPress={() => {
                  setModality(m.id);
                  setPage(1);
                }}
              >
                {m.name}
              </Chip>
            ))}
          </Row>
          <Notice message={modalities.error?.message} />
        </Card>
      ) : null}
      {selectedModality && !showFilters ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={"Remover filtro " + selectedModality.name}
          onPress={() => {
            setModality("");
            setPage(1);
          }}
          style={listStyles.filterSummary}
        >
          <Text style={listStyles.filterText}>{selectedModality.name}</Text>
          <Icon name="close" size={14} color={colors.muted} />
        </Pressable>
      ) : null}
      {list.data ? (
        <Text style={listStyles.count}>
          {list.data.total} {list.data.total === 1 ? "aluno" : "alunos"}
          {search || status || modality
            ? list.data.total === 1
              ? " encontrado"
              : " encontrados"
            : list.data.total === 1
              ? " cadastrado"
              : " cadastrados"}
        </Text>
      ) : null}
      {list.isPending ? (
        <Loading />
      ) : list.error ? (
        <Notice message={list.error.message} />
      ) : list.data?.items.length ? (
        <View style={listStyles.list}>
          {list.data.items.map((s, index) => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={"Abrir cadastro de " + s.name}
              onPress={() =>
                router.push({
                  pathname: "/students/[id]",
                  params: { id: s.id },
                })
              }
              style={({ pressed }) => [
                listStyles.studentRow,
                index > 0 && listStyles.rowDivider,
                pressed && { backgroundColor: colors.surfaceRaised },
              ]}
            >
              <Avatar name={s.name} />
              <View style={listStyles.studentInfo}>
                <Text numberOfLines={1} style={listStyles.studentName}>
                  {s.name}
                </Text>
                <Text numberOfLines={1} style={listStyles.studentMeta}>
                  {s.modality_details?.length
                    ? s.modality_details
                        .map((d) => {
                          const name = modalities.data?.find(
                            (m) => m.id === d.modality_id,
                          )?.name;
                          return (
                            (name ?? "Modalidade") +
                            (d.belt ? " • " + d.belt : "")
                          );
                        })
                        .join(" / ")
                    : s.belt}
                </Text>
                <View style={listStyles.situation}>
                  <View
                    style={[
                      listStyles.statusDot,
                      s.status === "inactive" && {
                        backgroundColor: colors.muted,
                      },
                    ]}
                  />
                  <Text style={listStyles.studentMeta}>
                    {s.status === "active" ? "Ativo" : "Inativo"}
                  </Text>
                </View>
              </View>
              <View style={listStyles.amount}>
                <Text style={listStyles.amountText}>
                  {s.billing?.enabled
                    ? money(s.billing.amount_cents)
                    : "Sem cobrança"}
                </Text>
                {s.billing?.enabled ? (
                  <Text style={listStyles.studentMeta}>por mês</Text>
                ) : null}
              </View>
              <Icon name="chevron-right" size={16} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={listStyles.empty}>
          <Icon name="users" size={32} color={colors.muted} />
          <Heading>Nenhum aluno encontrado</Heading>
          <Label muted>
            {search || status || modality
              ? "Ajuste a busca ou os filtros."
              : "Comece pelo botão Novo aluno."}
          </Label>
        </View>
      )}
      {list.data ? (
        <Pagination page={page} total={list.data.total} onChange={setPage} />
      ) : null}
    </AcademyShell>
  );
}
const listStyles = StyleSheet.create({
  statusTabs: {
    flexDirection: "row",
    gap: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#262626",
  },
  statusTab: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 2,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  statusSelected: { borderBottomColor: colors.text },
  statusText: { fontFamily: "Lato_700Bold", fontSize: 14, color: colors.muted },
  count: { fontFamily: "Lato_400Regular", fontSize: 12, color: colors.muted },
  list: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#292929",
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  studentRow: {
    minHeight: 100,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: "#292929" },
  studentInfo: { flex: 1, minWidth: 0, gap: 4 },
  studentName: { color: colors.text, fontFamily: "Lato_700Bold", fontSize: 15 },
  studentMeta: {
    color: colors.muted,
    fontFamily: "Lato_400Regular",
    fontSize: 11,
    lineHeight: 15,
  },
  situation: { flexDirection: "row", alignItems: "center", gap: 5 },
  statusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.success,
  },
  amount: { alignItems: "flex-end", gap: 3, maxWidth: 90 },
  amountText: { fontFamily: "Lato_700Bold", color: colors.text, fontSize: 12 },
  filterSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  filterText: {
    fontFamily: "Lato_400Regular",
    color: colors.muted,
    fontSize: 12,
  },
  empty: { alignItems: "center", gap: 12, paddingVertical: 40 },
});

export default function StudentsScreen() {
  return (
    <RoleGate role="admin">
      <ListContent />
    </RoleGate>
  );
}
function DetailContent({ id }: { id: string }) {
  const { academy } = useSession();
  const a = academy!;
  const student = useQuery({
    queryKey: ["student", a.id, id],
    queryFn: () => api<Student>(academyPath(a.id, "/students/" + id)),
    enabled: id !== "new",
  });
  const mods = useQuery({
    queryKey: ["modalities", a.id],
    queryFn: () => api<Catalog[]>(academyPath(a.id, "/modalities")),
  });
  const plans = useQuery({
    queryKey: ["plans", a.id],
    queryFn: () => api<Catalog[]>(academyPath(a.id, "/plans")),
  });
  if (mods.isPending || plans.isPending || (id !== "new" && student.isPending))
    return (
      <AcademyShell title="Cadastro">
        <Loading />
      </AcademyShell>
    );
  const error = mods.error || plans.error || student.error;
  if (error)
    return (
      <AcademyShell title="Cadastro">
        <Notice message={error.message} />
      </AcademyShell>
    );
  if (mods.data?.some((m) => typeof m.amount_cents !== "number"))
    return (
      <AcademyShell title="Cadastro do aluno">
        <Notice message="Cadastro por etapas aguardando atualização da API." />
      </AcademyShell>
    );
  return (
    <Form
      key={id}
      initial={student.data}
      modalities={mods.data ?? []}
      plans={plans.data ?? []}
    />
  );
}
export function StudentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <RoleGate role="admin">
      <DetailContent id={id} />
    </RoleGate>
  );
}
