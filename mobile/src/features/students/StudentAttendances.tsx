import { useState } from "react";
import { StudentAttendanceOverview } from "./StudentAttendanceOverview";
import { StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  Chip,
  Empty,
  Heading,
  IconButton,
  Label,
  Loading,
  Notice,
  Row,
} from "../../components/ui";
import { Icon } from "../../components/Icon";
import { ManualAttendance } from "../attendance/ManualAttendance";
import { Pagination } from "../../components/Pagination";
import { api, academyPath } from "../../services/api";
import { useSession } from "../../services/session";
import { Attendance } from "../../types";
import { Page } from "../../types/billing";
import { colors, accents, displayTime } from "../../theme";

function historyDate(value: string, zone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: zone,
    dateStyle: "medium",
  }).format(new Date(value));
}
function localMonth(zone: string) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  return (
    p.find((x) => x.type === "year")!.value +
    "-" +
    p.find((x) => x.type === "month")!.value
  );
}
function moveMonth(value: string, step: number) {
  const [y, m] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + step, 1)).toISOString().slice(0, 7);
}
function monthLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(value + "-01T12:00:00Z"));
}
export function StudentAttendances({
  studentId,
  own = false,
  canRecord = true,
}: {
  studentId?: string;
  own?: boolean;
  canRecord?: boolean;
}) {
  if (!own && studentId)
    return (
      <StudentAttendanceOverview studentId={studentId} canRecord={canRecord} />
    );
  return (
    <PersonalAttendances
      studentId={studentId}
      own={own}
      canRecord={canRecord}
    />
  );
}
function PersonalAttendances({
  studentId,
  own = false,
  canRecord = true,
}: {
  studentId?: string;
  own?: boolean;
  canRecord?: boolean;
}) {
  const { academy, role } = useSession(),
    a = academy!;
  const [month, setMonth] = useState(() => localMonth(a.timezone)),
    [all, setAll] = useState(false),
    [page, setPage] = useState(1);
  const endpoint = own
    ? "/me/attendances?"
    : "/attendances?student_id=" + studentId + "&";
  const identity = own ? "own" : studentId;
  const history = useQuery({
    queryKey: ["student-attendances", a.id, identity, all ? "" : month, page],
    queryFn: () =>
      api<Page<Attendance>>(
        academyPath(
          a.id,
          endpoint +
            "month=" +
            (all ? "" : month) +
            "&page=" +
            page +
            "&page_size=25",
        ),
      ),
    refetchInterval: 15000,
  });
  const summary = useQuery({
    queryKey: ["student-attendance-summary", a.id, identity],
    queryFn: () =>
      api<Page<Attendance>>(academyPath(a.id, endpoint + "page=1&page_size=1")),
    refetchInterval: 15000,
  });
  const last = summary.data?.items[0];
  function changeMonth(step: number) {
    setAll(false);
    setMonth((v) => moveMonth(v, step));
    setPage(1);
  }
  return (
    <>
      <View style={s.stats}>
        <View style={[s.stat, { borderColor: accents.blue.soft }]}>
          <Text style={s.caption}>Presenças registradas</Text>
          <Text style={s.number}>{summary.data?.total ?? "—"}</Text>
          <Text style={s.caption}>Em todo o histórico</Text>
        </View>
        <View style={[s.stat, { borderColor: accents.mint.soft }]}>
          <Text style={s.caption}>Último treino</Text>
          <Text style={s.last}>
            {last
              ? historyDate(last.starts_at ?? last.checked_in_at, a.timezone)
              : summary.isPending
                ? "Carregando…"
                : "Sem presenças"}
          </Text>
          <Text style={s.caption}>
            {last ? last.class_name : "Sem treinos registrados"}
          </Text>
        </View>
      </View>
      {summary.error ? <Notice message={summary.error.message} /> : null}
      <Card>
        <View style={s.heading}>
          <View style={{ flex: 1, gap: 4 }}>
            <Heading>Presenças nas aulas</Heading>
            <Label muted>
              Presenças confirmadas no tablet ou lançadas pelo gestor.
            </Label>
          </View>
          <Icon name="calendar" color={accents.blue.color} />
        </View>
        {!own && studentId && role === "admin" ? (
          <ManualAttendance studentId={studentId} disabled={!canRecord} />
        ) : null}
        <View style={s.month}>
          <IconButton
            icon="chevron-left"
            label="Mês anterior"
            onPress={() => changeMonth(-1)}
          />
          <Text accessibilityLiveRegion="polite" style={s.monthName}>
            {all ? "Todo o histórico" : monthLabel(month)}
          </Text>
          <IconButton
            icon="chevron-right"
            label="Próximo mês"
            onPress={() => changeMonth(1)}
          />
        </View>
        <Row>
          <Chip
            selected={!all && month === localMonth(a.timezone)}
            onPress={() => {
              setMonth(localMonth(a.timezone));
              setAll(false);
              setPage(1);
            }}
          >
            Este mês
          </Chip>
          <Chip
            selected={all}
            onPress={() => {
              setAll(true);
              setPage(1);
            }}
          >
            Todos os meses
          </Chip>
        </Row>
        {history.isPending ? (
          <Loading />
        ) : history.error ? (
          <>
            <Notice message={history.error.message} />
            <Button compact secondary onPress={() => void history.refetch()}>
              Tentar novamente
            </Button>
          </>
        ) : (
          <>
            <Label muted>
              {history.data.total}{" "}
              {history.data.total === 1
                ? "presença neste período"
                : "presenças neste período"}
            </Label>
            {history.data.items.length ? (
              history.data.items.map((p) => (
                <View key={p.id} style={s.item}>
                  <View style={s.tick}>
                    <Icon
                      name="check-circle"
                      color={accents.mint.color}
                      size={20}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 5, minWidth: 0 }}>
                    <Text style={s.className}>{p.class_name}</Text>
                    {p.modality_name ? (
                      <Text style={s.caption}>
                        {p.modality_name}
                        {p.starts_at
                          ? " · Aula às " + displayTime(p.starts_at, a.timezone)
                          : ""}
                      </Text>
                    ) : null}
                    <Text style={s.caption}>
                      {historyDate(p.starts_at ?? p.checked_in_at, a.timezone)}{" "}
                      ·{" "}
                      {p.source === "manager"
                        ? "Lançado pelo gestor"
                        : "Check-in no tablet"}{" "}
                      {p.source === "manager"
                        ? ""
                        : displayTime(p.checked_in_at, a.timezone)}
                    </Text>
                    {p.source === "manager" ? (
                      <Text style={s.caption}>
                        Registrado em {historyDate(p.checked_in_at, a.timezone)}{" "}
                        às {displayTime(p.checked_in_at, a.timezone)}
                      </Text>
                    ) : null}
                  </View>
                  <Badge label="Presente" tone="mint" />
                </View>
              ))
            ) : (
              <Empty>
                {all
                  ? "Este aluno ainda não tem presenças registradas."
                  : "Nenhuma presença neste mês. Consulte os meses anteriores ou todo o histórico."}
              </Empty>
            )}
            <Pagination
              page={page}
              total={history.data.total}
              onChange={setPage}
            />
          </>
        )}
      </Card>
    </>
  );
}
const s = StyleSheet.create({
  stats: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  stat: {
    flex: 1,
    minWidth: 140,
    padding: 16,
    gap: 8,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
  },
  caption: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
  number: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: colors.text,
  },
  last: { fontFamily: "Inter_700Bold", fontSize: 16, color: colors.text },
  heading: { flexDirection: "row", gap: 12, alignItems: "center" },
  month: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 4,
  },
  monthName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: colors.text,
    flex: 1,
    textAlign: "center",
    textTransform: "capitalize",
  },
  item: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingVertical: 16,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tick: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: accents.mint.soft,
  },
  className: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
});
