import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "../../components/Icon";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import type { Class, Schedule } from "../../types";
import { colors, accents } from "../../theme";
import { dayNames, fullDays, scheduleRange } from "./weekly";
import { modalityColor } from "./weekly-colors";
import { timetableDays } from "./timetable-data";

export function MobileClassAgenda({
  items,
  today,
  selectedDay,
  onDayChange,
  emptyMessage,
  onSelect,
  onInteractionChange,
}: {
  items: Class[];
  today: number;
  selectedDay: number;
  onDayChange: (day: number) => void;
  emptyMessage: string;
  onSelect: (item: Class, schedule?: Schedule) => void;
  onInteractionChange: (active: boolean) => void;
}) {
  const { width } = useResponsiveLayout();
  const days = timetableDays(items);
  const entries = days[selectedDay] || [];
  const unscheduled = items.filter((item) => !item.schedules?.length);
  const narrow = width < 380;
  const groups = narrow
    ? [
        [0, 1, 2, 3],
        [4, 5, 6],
      ]
    : [[0, 1, 2, 3, 4, 5, 6]];
  return (
    <View
      testID="mobile-class-agenda"
      style={s.section}
      onTouchStart={() => onInteractionChange(true)}
      onTouchEnd={(event) => {
        if (!event.nativeEvent.touches.length) onInteractionChange(false);
      }}
      onTouchCancel={() => onInteractionChange(false)}
    >
      <View style={s.heading}>
        <View style={s.headingText}>
          <Text style={s.title}>Agenda da semana</Text>
          <Text style={s.muted}>Horários fixos · toda semana</Text>
        </View>
        {selectedDay !== today ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar aos horários de hoje"
            onPress={() => onDayChange(today)}
            style={s.todayButton}
          >
            <Text style={s.todayText}>Hoje</Text>
          </Pressable>
        ) : null}
      </View>
      <View
        accessibilityRole="tablist"
        accessibilityLabel="Dia da semana"
        style={s.week}
      >
        {groups.map((group, index) => (
          <View key={index} style={s.days}>
            {group.map((day) => (
              <Pressable
                key={day}
                testID={"agenda-day-" + day}
                accessibilityRole="tab"
                accessibilityLabel={
                  fullDays[day] +
                  (day === today ? ", hoje" : "") +
                  ", " +
                  days[day].length +
                  " horários"
                }
                accessibilityState={{ selected: selectedDay === day }}
                onPress={() => onDayChange(day)}
                style={({ pressed }) => [
                  s.day,
                  selectedDay === day && s.selectedDay,
                  pressed && s.pressed,
                ]}
              >
                <Text
                  style={[s.dayName, selectedDay === day && s.selectedText]}
                >
                  {dayNames[day]}
                </Text>
                <Text
                  style={[s.dayCount, selectedDay === day && s.selectedText]}
                >
                  {days[day].length}
                </Text>
                {day === today ? (
                  <View style={[s.dot, selectedDay === day && s.selectedDot]} />
                ) : (
                  <View style={s.dotSpace} />
                )}
              </Pressable>
            ))}
          </View>
        ))}
      </View>
      <View style={s.dayHeading} accessibilityLiveRegion="polite">
        <Text style={s.dayTitle}>
          {fullDays[selectedDay]}
          {selectedDay === today ? " · Hoje" : ""}
        </Text>
        <Text style={s.muted}>
          {entries.length} {entries.length === 1 ? "horário" : "horários"}
        </Text>
      </View>
      {entries.length ? (
        entries.map(({ item, schedule }) => {
          const tone = modalityColor(item);
          return (
            <Pressable
              key={item.id + ":" + schedule.id}
              testID={"agenda-slot-" + schedule.id}
              accessibilityRole="button"
              accessibilityLabel={
                item.name +
                ". " +
                fullDays[selectedDay] +
                ", " +
                scheduleRange(schedule) +
                ". " +
                (item.active ? "Ver turma" : "Turma pausada. Ver opções")
              }
              accessibilityHint="Abre os detalhes e as opções da turma."
              onPress={() => onSelect(item, schedule)}
              style={({ pressed }) => [
                s.lesson,
                { borderLeftColor: tone.color },
                pressed && s.pressed,
              ]}
            >
              <View style={s.timeColumn}>
                <Text style={s.start}>{schedule.start_time.slice(0, 5)}</Text>
                <Text style={s.duration}>{schedule.duration_minutes} min</Text>
              </View>
              <View style={s.lessonBody}>
                <Text style={[s.modality, { color: tone.color }]}>
                  {item.modality_name || "Modalidade"}
                </Text>
                <Text style={s.lessonTitle}>{item.name}</Text>
                <Text style={s.range}>{scheduleRange(schedule)}</Text>
                {!item.active ? (
                  <Text style={s.paused}>Turma pausada</Text>
                ) : null}
              </View>
              <Icon name="chevron-right" size={18} color={colors.muted} />
            </Pressable>
          );
        })
      ) : (
        <View style={s.empty}>
          <Icon name="calendar" size={26} color={colors.muted} />
          <Text style={s.emptyTitle}>Nenhum horário neste dia</Text>
          <Text style={s.emptyText}>
            {items.length
              ? "Escolha outro dia para consultar a agenda da academia."
              : emptyMessage}
          </Text>
        </View>
      )}
      {unscheduled.length ? (
        <View style={s.unscheduled}>
          <Text style={s.dayTitle}>Sem horário definido</Text>
          {unscheduled.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={"Configurar horários de " + item.name}
              onPress={() => onSelect(item)}
              style={s.unscheduledItem}
            >
              <Icon name="calendar" size={18} color={colors.warning} />
              <View style={s.lessonBody}>
                <Text style={s.lessonTitle}>{item.name}</Text>
                <Text style={s.muted}>Toque para definir dias e horários</Text>
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
  section: { gap: 12, minWidth: 0 },
  heading: { flexDirection: "row", alignItems: "center", gap: 10 },
  headingText: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontFamily: "Inter_700Bold", color: colors.text, fontSize: 18 },
  muted: {
    fontFamily: "Inter_400Regular",
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  todayButton: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  todayText: {
    color: accents.brand.color,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  week: { gap: 4 },
  days: { flexDirection: "row", gap: 4 },
  day: {
    flex: 1,
    minWidth: 0,
    minHeight: 72,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedDay: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayName: {
    color: colors.muted,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  dayCount: { color: colors.text, fontFamily: "Inter_700Bold", fontSize: 17 },
  selectedText: { color: colors.onPrimary },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primaryLight,
  },
  selectedDot: { backgroundColor: colors.onPrimary },
  dotSpace: { height: 4 },
  dayHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  dayTitle: {
    fontFamily: "Inter_600SemiBold",
    color: colors.text,
    fontSize: 15,
  },
  lesson: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    backgroundColor: colors.surface,
  },
  timeColumn: { width: 52, gap: 5 },
  start: { fontFamily: "Inter_700Bold", color: colors.text, fontSize: 17 },
  duration: {
    fontFamily: "Inter_400Regular",
    color: colors.muted,
    fontSize: 11,
  },
  lessonBody: { flex: 1, minWidth: 0, gap: 5 },
  modality: { fontFamily: "Inter_600SemiBold", fontSize: 11, lineHeight: 16 },
  lessonTitle: {
    fontFamily: "Inter_600SemiBold",
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  range: {
    fontFamily: "Inter_400Regular",
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  paused: {
    fontFamily: "Inter_600SemiBold",
    color: colors.warning,
    fontSize: 12,
  },
  pressed: { opacity: 0.72 },
  empty: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontFamily: "Inter_600SemiBold",
    color: colors.text,
    fontSize: 14,
    textAlign: "center",
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  unscheduled: { gap: 10, marginTop: 8 },
  unscheduledItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
