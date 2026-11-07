import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useQueries } from "@tanstack/react-query";
import { EditorDialog } from "../../components/EditorDialog";
import { Icon } from "../../components/Icon";
import { Button, IconButton, Notice } from "../../components/ui";
import { academyPath, api } from "../../services/api";
import { createThemedStyles } from "../../theme";
import { useTheme, useThemedStyles } from "../../theme/ThemeProvider";
import type { Attendance } from "../../types";
import { academyDate } from "../../types/attendance";
import type { Page } from "../../types/billing";
import { useSectionPreview } from "../shared/SectionPagesContext";
import {
  attendanceDayLabel,
  calendarWeeks,
  groupAttendanceDays,
  loadAttendanceMonth,
} from "../students/attendance-calendar";
import { StudentAttendanceCalendar } from "../students/StudentAttendanceCalendar";
import { AttendanceDayDetails } from "../students/StudentAttendanceDay";

const monthNumbers = Array.from({ length: 12 }, (_, i) =>
  String(i + 1).padStart(2, "0"),
);
const shortMonths = [
  "Jan.",
  "Fev.",
  "Mar.",
  "Abr.",
  "Mai.",
  "Jun.",
  "Jul.",
  "Ago.",
  "Set.",
  "Out.",
  "Nov.",
  "Dez.",
];
const longMonth = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function StudentAttendanceYear({
  academyId,
  academyName,
  studentId,
  timezone,
}: {
  academyId: string;
  academyName: string;
  studentId: string;
  timezone: string;
}) {
  const s = useThemedStyles(themedS);
  const { colors } = useTheme();
  const preview = useSectionPreview();
  const today = academyDate(timezone);
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = today.slice(0, 7);
  const [year, setYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const months = monthNumbers.map((number) => year + "-" + number);
  const queries = useQueries({
    queries: months.map((month) => ({
      queryKey: ["personal-attendance-month", academyId, studentId, month],
      queryFn: () =>
        loadAttendanceMonth((page) =>
          api<Page<Attendance>>(
            academyPath(
              academyId,
              "/me/attendances?" +
                new URLSearchParams({
                  student_id: studentId,
                  month,
                  page: String(page),
                  page_size: "100",
                }),
            ),
          ),
        ),
      enabled: !preview && month <= currentMonth,
      staleTime: 60_000,
      refetchInterval: month === currentMonth ? 15_000 : false,
    })),
  });

  const selectedQuery =
    selectedMonth === null ? undefined : queries[selectedMonth];
  const selectedGroups = useMemo(
    () => groupAttendanceDays(selectedQuery?.data ?? [], timezone),
    [selectedQuery?.data, timezone],
  );
  const hasError = queries.some((query) => query.isError);

  return (
    <View style={s.container}>
      <View style={s.yearBar}>
        <IconButton
          icon="chevron-left"
          label="Ano anterior"
          disabled={year <= 2020}
          onPress={() => setYear(year - 1)}
        />
        <Text accessibilityRole="header" style={s.year}>
          {year}
        </Text>
        <IconButton
          icon="chevron-right"
          label="Próximo ano"
          disabled={year >= currentYear}
          onPress={() => setYear(year + 1)}
        />
      </View>
      {hasError ? (
        <View style={s.error}>
          <Notice message="Alguns meses não puderam ser atualizados." />
          <Button
            compact
            secondary
            onPress={() => {
              for (const query of queries) {
                if (query.isError) void query.refetch();
              }
            }}
          >
            Tentar novamente
          </Button>
        </View>
      ) : null}
      <View style={s.grid}>
        {months.map((month, index) => (
          <MonthDots
            key={month}
            month={month}
            label={shortMonths[index]}
            timezone={timezone}
            records={queries[index].data}
            future={month > currentMonth}
            failed={queries[index].isError}
            onPress={() => setSelectedMonth(index)}
          />
        ))}
      </View>
      <View style={s.legend}>
        <Icon name="check-circle" size={16} color={colors.success} />
        <Text style={s.caption}>{academyName} · dia com presença</Text>
      </View>
      <Text style={s.caption}>
        Toque em um mês para ver as datas e os treinos.
      </Text>
      {selectedMonth !== null ? (
        <EditorDialog
          title={
            day ? attendanceDayLabel(day) : monthLabel(months[selectedMonth])
          }
          onClose={() => {
            setSelectedMonth(null);
            setDay(null);
          }}
          footer={
            day ? (
              <Button compact secondary onPress={() => setDay(null)}>
                Voltar ao mês
              </Button>
            ) : undefined
          }
        >
          {day ? (
            <AttendanceDayDetails
              records={selectedGroups.get(day) ?? []}
              timezone={timezone}
            />
          ) : (
            <StudentAttendanceCalendar
              month={months[selectedMonth]}
              today={today}
              counts={
                new Map(
                  Array.from(selectedGroups, ([date, records]) => [
                    date,
                    records.length,
                  ]),
                )
              }
              onDay={setDay}
            />
          )}
        </EditorDialog>
      ) : null}
    </View>
  );
}

function monthLabel(month: string) {
  return longMonth.format(new Date(month + "-01T12:00:00Z"));
}

function MonthDots({
  month,
  label,
  timezone,
  records,
  future,
  failed,
  onPress,
}: {
  month: string;
  label: string;
  timezone: string;
  records?: Attendance[];
  future: boolean;
  failed: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const s = useThemedStyles(themedS);
  const days = useMemo(
    () => groupAttendanceDays(records ?? [], timezone),
    [records, timezone],
  );
  const weeks = calendarWeeks(month);
  const available = future || !!records;
  const countLabel = available
    ? days.size + " dias com presença"
    : failed
      ? "indisponível"
      : "carregando";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={monthLabel(month) + ", " + countLabel}
      accessibilityHint={
        records ? "Consultar datas e treinos do mês" : undefined
      }
      disabled={!records}
      onPress={onPress}
      style={({ pressed }) => [s.month, pressed && s.pressed]}
    >
      <View style={s.monthHeader}>
        <Text style={s.monthLabel}>{label}</Text>
        <Text style={[s.monthCount, days.size > 0 && s.monthCountActive]}>
          {available ? days.size : "–"}
        </Text>
      </View>
      <View aria-hidden style={[s.weeks, (future || !records) && s.faded]}>
        {weeks.map((week, row) => (
          <View key={row} style={s.week}>
            {week.map((date, column) => {
              const attended = !!date && days.has(date);
              return (
                <View
                  key={column}
                  style={[s.dot, !!date && s.dateDot, attended && s.attended]}
                >
                  {attended ? (
                    <Icon name="check" size={9} color={colors.surface} />
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const themedS = createThemedStyles(({ colors }) => ({
  container: { width: "100%", maxWidth: 530, gap: 12 },
  yearBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  year: { color: colors.text, fontFamily: "Inter_700Bold", fontSize: 21 },
  error: { gap: 8, alignItems: "flex-start" },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 16 },
  month: {
    width: "33.333%",
    minHeight: 114,
    paddingHorizontal: 4,
    paddingVertical: 5,
    gap: 7,
    borderRadius: 10,
  },
  pressed: { backgroundColor: colors.surfaceRaised },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  monthLabel: {
    color: colors.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textTransform: "uppercase",
  },
  monthCount: {
    color: colors.muted,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 12,
    minWidth: 21,
    paddingHorizontal: 4,
    paddingVertical: 3,
    textAlign: "center",
    fontFamily: "Inter_700Bold",
    fontSize: 10,
  },
  monthCountActive: { color: colors.surface, backgroundColor: colors.success },
  weeks: { gap: 2 },
  week: { flexDirection: "row", gap: 2 },
  dot: {
    flex: 1,
    maxWidth: 15,
    aspectRatio: 1,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  dateDot: { backgroundColor: colors.border },
  attended: { backgroundColor: colors.success },
  faded: { opacity: 0.45 },
  legend: { flexDirection: "row", alignItems: "center", gap: 7 },
  caption: {
    color: colors.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
}));
