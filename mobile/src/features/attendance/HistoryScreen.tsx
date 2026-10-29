import { useStudentScope, StudentSelector } from "../student/useStudentScope";
import { useContext, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { AcademyShell, RoleGate, PersonalGate } from "../shared/AcademyShell";
import {
  Button,
  Card,
  Chip,
  IconButton,
  Loading,
  Notice,
  Row,
} from "../../components/ui";
import { MonthPicker } from "../../components/BillingDatePicker";
import { FormScrollContext } from "../../components/FormScrollContext";
import { Icon } from "../../components/Icon";
import { ManualAttendance } from "./ManualAttendance";
import { AttendanceFilters, HistoryFilters } from "./HistoryFilters";
import { HistoryList } from "./HistoryList";
import { Pagination } from "../../components/Pagination";
import { api, academyPath } from "../../services/api";
import { useSession } from "../../services/session";
import { Attendance } from "../../types";
import { Page } from "../../types/billing";
import { academyDate } from "../../types/attendance";
import { accents, colors } from "../../theme";

function RemoveFilter({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={"Remover filtro: " + label}
      onPress={onPress}
      style={({ pressed }) => [s.filterTag, pressed && { opacity: 0.7 }]}
    >
      <Text style={s.tagText}>{label}</Text>
      <Icon name="close" size={14} color={colors.primaryLight} />
    </Pressable>
  );
}
function Content({ admin }: { admin: boolean }) {
  const { academy } = useSession();
  const a = academy!;
  const scope = useStudentScope(!admin);
  const [page, setPage] = useState(1);
  const [thisMonth, setThisMonth] = useState(() =>
    academyDate(a.timezone).slice(0, 7),
  );
  const [month, setMonth] = useState(thisMonth);
  const [filters, setFilters] = useState<AttendanceFilters>({
    classroom: null,
    student: null,
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const history = useQuery({
    queryKey: [
      "history",
      a.id,
      admin,
      scope.id,
      page,
      month,
      filters.classroom?.id ?? "",
      filters.student?.id ?? "",
    ],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), month });
      if (!admin && scope.id) params.set("student_id", scope.id);
      if (admin && filters.classroom)
        params.set("class_id", filters.classroom.id);
      if (admin && filters.student)
        params.set("student_id", filters.student.id);
      return api<Page<Attendance>>(
        academyPath(
          a.id,
          (admin ? "/attendances" : "/me/attendances") + "?" + params,
        ),
      );
    },
    refetchInterval: 10000,
  });
  function changeMonth(value: string) {
    setMonth(value);
    setPage(1);
  }
  function applyFilters(value: AttendanceFilters) {
    setFilters(value);
    setPage(1);
    setFilterOpen(false);
  }
  const filterCount = Number(!!filters.classroom) + Number(!!filters.student);
  return (
    <AcademyShell
      wide={admin}
      title={admin ? "Histórico de presenças" : "Minhas presenças"}
      subtitle={
        admin
          ? "Quem treinou, quando e em qual turma."
          : "Seus treinos, organizados por dia."
      }
    >
      {!admin ? (
        <StudentSelector scope={scope} onChange={() => setPage(1)} />
      ) : null}
      <Card style={s.filters}>
        <View style={s.filterRow}>
          <View style={s.month}>
            <MonthPicker
              label="Período dos treinos"
              value={month}
              allowClear
              onChange={changeMonth}
            />
          </View>
          {admin ? (
            <IconButton
              icon="sliders"
              label={filterCount ? "Filtros (" + filterCount + ")" : "Filtros"}
              selected={filterCount > 0}
              expanded={filterOpen}
              onPress={() => setFilterOpen(true)}
            />
          ) : null}
        </View>
        <Row>
          <Chip
            selected={month === thisMonth}
            onPress={() => {
              const current = academyDate(a.timezone).slice(0, 7);
              setThisMonth(current);
              changeMonth(current);
            }}
          >
            Este mês
          </Chip>
          <Chip selected={!month} onPress={() => changeMonth("")}>
            Todos os meses
          </Chip>
        </Row>
        {filterCount ? (
          <View style={s.tags}>
            {filters.classroom ? (
              <RemoveFilter
                label={filters.classroom.name}
                onPress={() => applyFilters({ ...filters, classroom: null })}
              />
            ) : null}
            {filters.student ? (
              <RemoveFilter
                label={filters.student.name}
                onPress={() => applyFilters({ ...filters, student: null })}
              />
            ) : null}
          </View>
        ) : null}
      </Card>
      <View style={s.resultsHeader}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            accessibilityRole="header"
            accessibilityLiveRegion="polite"
            style={s.total}
          >
            {history.isPending || history.isError
              ? "—"
              : history.data.total.toLocaleString("pt-BR")}
            <Text style={s.totalWord}>
              {history.data?.total === 1 ? " presença" : " presenças"}
            </Text>
          </Text>
          <Text style={s.caption}>
            {history.data && !history.isError && history.data.total > 0
              ? Math.min(
                  (page - 1) * history.data.page_size + 1,
                  history.data.total,
                ) +
                "–" +
                Math.min(page * history.data.page_size, history.data.total) +
                " de " +
                history.data.total +
                " registros"
              : "Organizados pelo dia do treino"}
          </Text>
        </View>
        {admin ? <ManualAttendance label="Registrar" /> : null}
        <IconButton
          icon="swap"
          label="Atualizar presenças"
          disabled={history.isFetching}
          onPress={() => void history.refetch()}
        />
      </View>
      {history.isPending ? (
        <Loading />
      ) : history.error ? (
        <Card>
          <Notice message={history.error.message} />
          <Button compact secondary onPress={() => void history.refetch()}>
            Tentar novamente
          </Button>
        </Card>
      ) : history.data.items.length ? (
        <>
          <HistoryList
            items={history.data.items}
            timezone={a.timezone}
            admin={admin}
          />
          <HistoryPagination
            page={page}
            total={history.data.total}
            size={history.data.page_size}
            onChange={setPage}
          />
        </>
      ) : (
        <Card style={s.empty}>
          <View style={s.emptyIcon}>
            <Icon name="calendar" size={26} color={colors.muted} />
          </View>
          <Text style={s.heading}>Nenhuma presença por aqui</Text>
          <Text style={s.emptyText}>
            Não encontramos registros para este período
            {filterCount ? " e estes filtros" : ""}. Experimente consultar outro
            mês ou todo o histórico.
          </Text>
          {month || filterCount ? (
            <Button
              compact
              secondary
              onPress={() => {
                changeMonth("");
                applyFilters({ classroom: null, student: null });
              }}
            >
              Ver todo o histórico
            </Button>
          ) : null}
        </Card>
      )}
      {admin && filterOpen ? (
        <HistoryFilters
          academyId={a.id}
          value={filters}
          onClose={() => setFilterOpen(false)}
          onApply={applyFilters}
        />
      ) : null}
    </AcademyShell>
  );
}
function HistoryPagination({
  onChange,
  ...props
}: {
  page: number;
  total: number;
  size: number;
  onChange: (page: number) => void;
}) {
  const resetScroll = useContext(FormScrollContext);
  return (
    <Pagination
      {...props}
      onChange={(page) => {
        onChange(page);
        resetScroll?.();
      }}
    />
  );
}
export default function HistoryScreen({ admin = false }: { admin?: boolean }) {
  return admin ? (
    <RoleGate role="admin">
      <Content key="academy" admin />
    </RoleGate>
  ) : (
    <PersonalGate>
      <Content key="personal" admin={false} />
    </PersonalGate>
  );
}
const s = StyleSheet.create({
  total: {
    fontFamily: "Inter_700Bold",
    color: colors.text,
    fontSize: 24,
    lineHeight: 30,
  },
  totalWord: {
    fontFamily: "Inter_600SemiBold",
    color: colors.text,
    fontSize: 13,
  },
  caption: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  filters: { gap: 12, padding: 16 },
  filterRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    flexWrap: "wrap",
    gap: 12,
  },
  month: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 150,
    minWidth: 0,
    maxWidth: 400,
  },
  tags: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  filterTag: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: accents.brand.border,
    backgroundColor: accents.brand.soft,
  },
  tagText: {
    flexShrink: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    lineHeight: 18,
    color: colors.primaryLight,
  },
  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  heading: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: colors.text,
  },
  empty: { alignItems: "center", paddingVertical: 30, gap: 14 },
  emptyIcon: {
    height: 58,
    width: 58,
    borderRadius: 20,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: colors.muted,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 360,
  },
});
