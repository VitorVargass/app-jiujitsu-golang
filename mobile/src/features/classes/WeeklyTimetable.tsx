import { useState } from "react";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { MobileClassAgenda } from "./MobileClassAgenda";
import { modalityColor } from "./weekly-colors";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Icon } from "../../components/Icon";
import type { Class, Schedule } from "../../types";
import { colors } from "../../theme";
import { dayNames, fullDays, scheduleRange } from "./weekly";

type Entry = { item: Class; schedule: Schedule };
type TimeRow = { time: string; days: Entry[][]; height: number };
const DAYS = [0, 1, 2, 3, 4, 5, 6];
const HEADER_HEIGHT = 56;
const EVENT_HEIGHT = 100;
const GUTTER = 8;
const RULER_WIDTH = 48;
const MIN_DAY_WIDTH = 136;
function timeRows(items: Class[]): TimeRow[] {
  const byTime = new Map<string, Entry[][]>();
  for (const item of items) {
    for (const schedule of item.schedules ?? []) {
      const time = schedule.start_time.slice(0, 5);
      const days = byTime.get(time) ?? DAYS.map(() => []);
      days[schedule.weekday].push({ item, schedule });
      byTime.set(time, days);
    }
  }
  return [...byTime.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, days]) => ({
      time,
      days: days.map((entries) =>
        entries.sort((a, b) => a.item.name.localeCompare(b.item.name)),
      ),
      height:
        Math.max(1, ...days.map((d) => d.length)) * (EVENT_HEIGHT + GUTTER) +
        GUTTER,
    }));
}

export function WeeklyTimetable(
  props: Parameters<typeof DesktopWeeklyTimetable>[0],
) {
  const { isCompact } = useResponsiveLayout();
  const [selectedDay, setSelectedDay] = useState(() =>
    props.today >= 0 && props.today < 7 ? props.today : 0,
  );
  return isCompact ? (
    <MobileClassAgenda
      items={props.items}
      today={props.today}
      selectedDay={selectedDay}
      onDayChange={setSelectedDay}
      emptyMessage={props.emptyMessage}
      onInteractionChange={props.onInteractionChange}
      onSelect={props.onSelect}
    />
  ) : (
    <DesktopWeeklyTimetable {...props} />
  );
}

function DesktopWeeklyTimetable({
  items,
  today,
  emptyMessage,
  onSelect,
  onInteractionChange,
}: {
  items: Class[];
  today: number;
  emptyMessage: string;
  onSelect: (item: Class, schedule?: Schedule) => void;
  onInteractionChange: (active: boolean) => void;
}) {
  const [width, setWidth] = useState(0);
  const rows = timeRows(items);
  const dayWidth = Math.max(MIN_DAY_WIDTH, (width - RULER_WIDTH - 2) / 7);
  const scrollable = width > 0 && dayWidth * 7 > width - RULER_WIDTH - 2 + 1;
  const unscheduled = items.filter((item) => !item.schedules?.length);
  const modalities = [
    ...new Map(items.map((item) => [item.modality_name, item])).values(),
  ];
  const count = rows.reduce(
    (sum, row) => sum + row.days.reduce((n, day) => n + day.length, 0),
    0,
  );
  return (
    <View style={s.section}>
      <View style={s.heading}>
        <View style={s.headingText}>
          <Text style={s.title}>Grade semanal</Text>
          <Text style={s.subtitle}>Horários fixos · repete toda semana</Text>
        </View>
        <View style={s.count}>
          <Text style={s.countText}>{count} horários</Text>
        </View>
      </View>
      {modalities.length ? (
        <View style={s.legend}>
          {modalities.map((item) => (
            <View key={item.modality_name} style={s.legendItem}>
              <View
                style={[
                  s.legendDot,
                  { backgroundColor: modalityColor(item).color },
                ]}
              />
              <Text style={s.legendText}>
                {item.modality_name || "Modalidade"}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      <View
        testID="weekly-timetable"
        style={s.calendar}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onTouchStart={() => onInteractionChange(true)}
        onTouchEnd={(event) => {
          if (!event.nativeEvent.touches.length) onInteractionChange(false);
        }}
        onTouchCancel={() => onInteractionChange(false)}
      >
        {scrollable ? (
          <View style={s.scrollHint}>
            <Icon name="swap" size={14} color={colors.muted} />
            <Text style={s.scrollHintText}>
              Dom a sáb · deslize para ver todos os dias
            </Text>
          </View>
        ) : null}
        <View style={s.table}>
          <View style={s.ruler} aria-hidden>
            <View style={s.corner}>
              <Text style={s.cornerText}>INÍCIO</Text>
            </View>
            {rows.map((row) => (
              <View key={row.time} style={[s.hour, { height: row.height }]}>
                <Text style={s.hourText}>{row.time}</Text>
              </View>
            ))}
          </View>
          <ScrollView
            testID="weekly-scroll"
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={scrollable}
            style={s.scroller}
            contentContainerStyle={{ width: dayWidth * 7 }}
          >
            <View style={{ width: dayWidth * 7 }}>
              <View style={s.dayRow}>
                {DAYS.map((day) => (
                  <View
                    key={day}
                    style={[
                      s.dayHeader,
                      { width: dayWidth },
                      today === day && s.currentDay,
                    ]}
                  >
                    <Text
                      style={[s.dayName, today === day && s.currentDayName]}
                    >
                      {dayNames[day]}
                    </Text>
                    <View style={s.dayCaption}>
                      {day === today ? <View style={s.todayDot} /> : null}
                      <Text
                        style={[
                          s.dayCaptionText,
                          day === today && { color: colors.primaryLight },
                        ]}
                      >
                        {day === today ? "Hoje" : fullDays[day]}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
              {rows.map((row) => (
                <View
                  key={row.time}
                  style={[s.timeRow, { height: row.height }]}
                >
                  {DAYS.map((day) => (
                    <View
                      key={day}
                      testID={"weekly-cell-" + day + "-" + row.time}
                      style={[
                        s.cell,
                        { width: dayWidth },
                        day === today && s.todayCell,
                      ]}
                    >
                      {row.days[day].length ? (
                        row.days[day].map(({ item, schedule }) => {
                          const tone = modalityColor(item);
                          return (
                            <Pressable
                              key={schedule.id}
                              testID={"weekly-slot-" + schedule.id}
                              accessibilityRole="button"
                              accessibilityLabel={
                                item.name +
                                ". " +
                                fullDays[day] +
                                ", " +
                                scheduleRange(schedule) +
                                (item.active
                                  ? ". Ver turma"
                                  : ". Turma pausada. Ver opções")
                              }
                              accessibilityHint="Abre os detalhes e as opções da turma."
                              onPress={() => onSelect(item, schedule)}
                              style={({ pressed }) => [
                                s.event,
                                {
                                  backgroundColor: tone.soft,
                                  borderColor: tone.border,
                                  borderLeftColor: tone.color,
                                },
                                !item.active && s.pausedEvent,
                                pressed && { opacity: 0.7 },
                              ]}
                            >
                              <Text
                                style={[s.eventTime, { color: tone.color }]}
                              >
                                {scheduleRange(schedule)}
                              </Text>
                              <Text numberOfLines={2} style={s.eventTitle}>
                                {item.name}
                              </Text>
                              <Text numberOfLines={1} style={s.eventModality}>
                                {item.active
                                  ? item.modality_name
                                  : "Pausada pelo gestor"}
                              </Text>
                            </Pressable>
                          );
                        })
                      ) : (
                        <Text style={s.emptyCell} aria-hidden>
                          ·
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
        {!rows.length ? (
          <Text style={s.emptyMessage}>{emptyMessage}</Text>
        ) : null}
      </View>
      {unscheduled.length ? (
        <View style={s.unscheduled}>
          <Text style={s.unscheduledTitle}>Turmas sem horários</Text>
          {unscheduled.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={"Configurar horários de " + item.name}
              onPress={() => onSelect(item)}
              style={s.unscheduledItem}
            >
              <Icon name="calendar" size={18} color={colors.warning} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={s.unscheduledName}>{item.name}</Text>
                <Text style={s.subtitle}>Toque para configurar a grade</Text>
              </View>
              <Icon name="chevron-right" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  section: { gap: 16, minWidth: 0 },
  heading: { flexDirection: "row", alignItems: "center", gap: 12 },
  headingText: { flex: 1, minWidth: 0, gap: 5 },
  title: { fontFamily: "Inter_700Bold", color: colors.text, fontSize: 18 },
  subtitle: {
    fontFamily: "Inter_400Regular",
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  count: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  countText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: colors.muted,
  },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 7, height: 7, borderRadius: 3 },
  legendText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: colors.muted,
  },
  calendar: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  table: { flexDirection: "row", minWidth: 0 },
  ruler: {
    width: RULER_WIDTH,
    backgroundColor: "#131315",
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  corner: {
    height: HEADER_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cornerText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 8,
    color: colors.muted,
    letterSpacing: 0.4,
  },
  hour: {
    paddingTop: 14,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  hourText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: colors.muted,
  },
  scroller: { flex: 1, minWidth: 0 },
  dayRow: { flexDirection: "row", height: HEADER_HEIGHT },
  dayHeader: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderRightWidth: 1,
    borderRightColor: colors.borderSubtle,
  },
  dayName: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: colors.text,
    textTransform: "uppercase",
  },
  dayCaption: { flexDirection: "row", gap: 4, alignItems: "center" },
  dayCaptionText: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: colors.muted,
  },
  currentDay: { backgroundColor: "#30181E" },
  currentDayName: { color: colors.primaryLight },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  timeRow: { flexDirection: "row" },
  cell: {
    padding: GUTTER,
    gap: GUTTER,
    borderRightWidth: 1,
    borderRightColor: colors.borderSubtle,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  todayCell: { backgroundColor: "#201418" },
  event: {
    height: EVENT_HEIGHT,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: 10,
    padding: 10,
    gap: 6,
    justifyContent: "center",
  },
  eventTime: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  eventTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: colors.text,
    lineHeight: 17,
  },
  eventModality: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: colors.muted,
  },
  pausedEvent: { opacity: 0.6, borderStyle: "dashed" },
  emptyCell: {
    color: colors.border,
    textAlign: "center",
    fontSize: 18,
    paddingTop: 26,
  },
  emptyMessage: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: colors.muted,
    lineHeight: 20,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  scrollHint: {
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#131315",
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  scrollHintText: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: colors.muted,
  },
  unscheduled: { gap: 10 },
  unscheduledTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: colors.muted,
  },
  unscheduledItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  unscheduledName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: colors.text,
  },
});
