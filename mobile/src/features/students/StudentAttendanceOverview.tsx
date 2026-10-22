import { useContext, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, IconButton, Loading, Notice } from "../../components/ui";
import { Icon } from "../../components/Icon";
import { MonthPicker } from "../../components/BillingDatePicker";
import { Pagination } from "../../components/Pagination";
import { FormScrollContext } from "../../components/FormScrollContext";
import { ManualAttendanceDialog } from "../attendance/ManualAttendance";
import { api, academyPath } from "../../services/api";
import { useSession } from "../../services/session";
import type { Attendance } from "../../types";
import type { Page } from "../../types/billing";
import { academyDate } from "../../types/attendance";
import { shiftMonth } from "../../types/month";
import { accents, colors, displayTime } from "../../theme";
import {
  attendanceDay,
  attendanceDayLabel,
  groupAttendanceDays,
  loadAttendanceMonth,
} from "./attendance-calendar";
import { StudentAttendanceCalendar } from "./StudentAttendanceCalendar";
import { StudentAttendanceDay } from "./StudentAttendanceDay";

const pageSize = 5;
export function StudentAttendanceOverview({
  studentId,
  canRecord,
}: {
  studentId: string;
  canRecord: boolean;
}) {
  const { academy, role } = useSession(),
    a = academy!;
  const { width } = useWindowDimensions();
  const resetScroll = useContext(FormScrollContext);
  const today = academyDate(a.timezone),
    currentMonth = today.slice(0, 7);
  const [month, setMonth] = useState(currentMonth),
    [all, setAll] = useState(false);
  const [view, setView] = useState<"calendar" | "list">("calendar"),
    [page, setPage] = useState(1);
  const [day, setDay] = useState<string | null>(null),
    [recordDay, setRecordDay] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const mayRecord = role === "admin" && canRecord;
  const base = "/attendances?student_id=" + studentId;
  const monthly = useQuery({
    queryKey: ["student-attendance-month", a.id, studentId, month],
    queryFn: () =>
      loadAttendanceMonth((next) =>
        api<Page<Attendance>>(
          academyPath(
            a.id,
            base + "&month=" + month + "&page=" + next + "&page_size=100",
          ),
        ),
      ),
    enabled: !all,
    refetchInterval: 15000,
  });
  const history = useQuery({
    queryKey: ["student-attendances", a.id, studentId, "all", page, pageSize],
    queryFn: () =>
      api<Page<Attendance>>(
        academyPath(a.id, base + "&page=" + page + "&page_size=" + pageSize),
      ),
    enabled: all,
    refetchInterval: 15000,
  });
  const summary = useQuery({
    queryKey: ["student-attendance-summary", a.id, studentId],
    queryFn: () =>
      api<Page<Attendance>>(academyPath(a.id, base + "&page=1&page_size=1")),
    refetchInterval: 15000,
  });
  const groups = useMemo(
    () => groupAttendanceDays(monthly.data ?? [], a.timezone),
    [monthly.data, a.timezone],
  );
  const counts = new Map(
    [...groups].map(([date, records]) => [date, records.length]),
  );
  const query = all ? history : monthly;
  const total = all ? history.data?.total : monthly.data?.length;
  const rows = all
    ? (history.data?.items ?? [])
    : (monthly.data ?? []).slice((page - 1) * pageSize, page * pageSize);
  const last = summary.data?.items[0];
  const lastLabel = last
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: a.timezone,
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      }).format(new Date(last.starts_at ?? last.checked_in_at))
    : summary.isPending || summary.error
      ? "—"
      : "Sem registros";
  function chooseMonth(value: string) {
    setAll(!value);
    if (value) setMonth(value);
    else setView("list");
    setPage(1);
    setMessage("");
  }
  function chooseView(value: "calendar" | "list") {
    if (value === "calendar") setAll(false);
    setView(value);
    setPage(1);
    resetScroll();
  }
  function renderRows() {
    return (
      <Card style={s.listCard}>
        <View style={s.listHeading}>
          <Text style={s.heading}>
            {all ? "Histórico completo" : "Treinos do mês"}
          </Text>
          <Text style={s.caption}>{total ?? "—"} registros</Text>
        </View>
        {rows.length ? (
          rows.map((item) => {
            const date = attendanceDay(item, a.timezone);
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={
                  "Ver aulas em " +
                  attendanceDayLabel(date) +
                  ": " +
                  item.class_name
                }
                onPress={() => setDay(date)}
                style={({ pressed }) => [
                  s.record,
                  pressed && { backgroundColor: colors.surfaceRaised },
                ]}
              >
                <View style={s.dateBadge}>
                  <Text style={s.dateDay}>{date.slice(8)}</Text>
                  <Text style={s.dateMonth}>
                    {date.slice(5, 7) + "/" + date.slice(2, 4)}
                  </Text>
                </View>
                <View style={s.recordCopy}>
                  <Text style={s.className}>{item.class_name}</Text>
                  <Text style={s.caption}>
                    {displayTime(
                      item.starts_at ?? item.checked_in_at,
                      a.timezone,
                    )}
                    {item.modality_name ? " · " + item.modality_name : ""}
                  </Text>
                </View>
                <Icon
                  name="check-circle"
                  size={16}
                  color={accents.mint.color}
                />
                <Icon name="chevron-right" size={13} color={colors.muted} />
              </Pressable>
            );
          })
        ) : (
          <View style={s.empty}>
            <Icon name="calendar" size={26} color={colors.muted} />
            <Text style={s.className}>Nenhum treino registrado</Text>
            <Text style={s.caption}>
              {all
                ? "As presenças aparecerão aqui após o primeiro treino."
                : "Troque o mês para consultar outros treinos."}
            </Text>
          </View>
        )}
        <Pagination
          page={page}
          total={total ?? 0}
          size={pageSize}
          onChange={(next) => {
            setPage(next);
            if (width < 1000) resetScroll();
          }}
        />
      </Card>
    );
  }
  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.recordCopy}>
          <Text style={s.caption}>
            {summary.error
              ? "Histórico indisponível"
              : summary.data
                ? summary.data.total + " presenças no histórico"
                : "Consultando histórico…"}
          </Text>
        </View>
        {mayRecord ? (
          <Button
            compact
            secondary
            icon="plus"
            onPress={() => {
              setMessage("");
              setRecordDay(today);
            }}
          >
            Registrar
          </Button>
        ) : null}
      </View>
      <View style={s.stats}>
        <View style={s.stat}>
          <Text style={s.statCaption}>
            {all ? "Presenças" : "Treinos no mês"}
          </Text>
          <Text style={s.statValue}>
            {query.isError ? "—" : (total ?? "—")}
          </Text>
        </View>
        {!all ? (
          <View style={s.stat}>
            <Text style={s.statCaption}>Dias de treino</Text>
            <Text style={s.statValue}>
              {monthly.isSuccess ? groups.size : "—"}
            </Text>
          </View>
        ) : null}
        <View style={s.stat}>
          <Text style={s.statCaption}>Último treino</Text>
          <Text style={s.lastValue}>{lastLabel}</Text>
        </View>
      </View>
      <View style={s.period}>
        <IconButton
          icon="chevron-left"
          label="Mês anterior"
          disabled={!all && month <= "2020-01"}
          onPress={() =>
            chooseMonth(shiftMonth(all ? currentMonth : month, -1))
          }
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <MonthPicker
            compact
            allowClear
            min="2020-01"
            label="Mês dos treinos"
            value={all ? "" : month}
            onChange={chooseMonth}
          />
        </View>
        <IconButton
          icon="chevron-right"
          label="Próximo mês"
          disabled={!all && month >= "2100-12"}
          onPress={() => chooseMonth(shiftMonth(all ? currentMonth : month, 1))}
        />
      </View>
      <View style={s.viewRow}>
        <View accessibilityRole="tablist" style={s.switch}>
          {(
            [
              { id: "calendar", label: "Calendário", icon: "calendar" },
              { id: "list", label: "Lista", icon: "more" },
            ] as const
          ).map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: view === item.id }}
              onPress={() => chooseView(item.id)}
              style={[s.switchItem, view === item.id && s.switchActive]}
            >
              <Icon
                name={item.icon}
                size={15}
                color={view === item.id ? colors.text : colors.muted}
              />
              <Text
                style={[
                  s.switchLabel,
                  view === item.id && { color: colors.text },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {all || month !== currentMonth ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar para este mês"
            onPress={() => chooseMonth(currentMonth)}
            style={s.current}
          >
            <Text style={s.currentText}>Este mês</Text>
          </Pressable>
        ) : null}
      </View>
      <Notice success message={message} />
      {summary.error ? <Notice message={summary.error.message} /> : null}
      {query.isPending ? (
        <Card>
          <Loading />
        </Card>
      ) : query.error ? (
        <Card>
          <Notice message={query.error.message} />
          <Button secondary compact onPress={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </Card>
      ) : view === "calendar" && !all ? (
        <View style={[s.body, width >= 1000 && s.desktop]}>
          <Card style={[s.calendarCard, width >= 1000 && s.calendarDesktop]}>
            <StudentAttendanceCalendar
              month={month}
              today={today}
              counts={counts}
              onDay={setDay}
            />
          </Card>
          {width >= 1000 ? (
            <View style={{ flex: 1, minWidth: 0 }}>{renderRows()}</View>
          ) : null}
        </View>
      ) : (
        renderRows()
      )}
      {day ? (
        <StudentAttendanceDay
          academyId={a.id}
          studentId={studentId}
          timezone={a.timezone}
          day={day}
          canRecord={mayRecord}
          onClose={() => setDay(null)}
          onRegister={() => {
            setRecordDay(day);
            setDay(null);
            setMessage("");
          }}
        />
      ) : null}
      {recordDay ? (
        <ManualAttendanceDialog
          studentId={studentId}
          initialDate={recordDay}
          onClose={() => setRecordDay(null)}
          onRecorded={() => {
            setRecordDay(null);
            setMessage("Presença registrada. O calendário foi atualizado.");
          }}
        />
      ) : null}
    </View>
  );
}
const s = StyleSheet.create({
  container: { gap: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  heading: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  caption: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 17,
    color: colors.muted,
  },
  stats: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 13,
  },
  stat: { flex: 1, minWidth: 0, gap: 7, paddingHorizontal: 10 },
  statCaption: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: colors.muted,
  },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 24, color: colors.text },
  lastValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    lineHeight: 29,
    color: colors.text,
  },
  period: { flexDirection: "row", alignItems: "center", gap: 6 },
  viewRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "space-between",
  },
  switch: {
    flexDirection: "row",
    gap: 3,
    padding: 3,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  switchItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 12,
    minHeight: 38,
    borderRadius: 8,
  },
  switchActive: { backgroundColor: colors.surfaceRaised },
  switchLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: colors.muted,
  },
  current: { minHeight: 44, justifyContent: "center", paddingHorizontal: 6 },
  currentText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: colors.primaryLight,
  },
  body: { gap: 16 },
  desktop: { flexDirection: "row", alignItems: "flex-start" },
  calendarCard: { padding: 14 },
  calendarDesktop: { width: 360, flexShrink: 0 },
  listCard: { padding: 14, gap: 4 },
  listHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingBottom: 7,
  },
  record: {
    minHeight: 67,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  dateBadge: {
    width: 44,
    minHeight: 44,
    gap: 2,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: accents.mint.soft,
  },
  dateDay: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: accents.mint.color,
  },
  dateMonth: {
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    color: colors.muted,
  },
  recordCopy: { flex: 1, minWidth: 0, gap: 3 },
  className: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
  },
  empty: { alignItems: "center", gap: 10, paddingVertical: 26 },
});
