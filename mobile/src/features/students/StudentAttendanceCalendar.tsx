import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, accents } from "../../theme";
import { calendarWeeks, attendanceDayLabel } from "./attendance-calendar";

export function StudentAttendanceCalendar({
  month,
  today,
  counts,
  onDay,
}: {
  month: string;
  today: string;
  counts: Map<string, number>;
  onDay: (day: string) => void;
}) {
  return (
    <View style={s.calendar}>
      <View style={s.week}>
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
          <Text key={day} style={s.weekday}>
            {day}
          </Text>
        ))}
      </View>
      {calendarWeeks(month).map((week, index) => (
        <View key={index} style={s.week}>
          {week.map((day, column) => {
            if (!day) return <View key={"blank-" + column} style={s.cell} />;
            const total = counts.get(day) ?? 0;
            const future = day > today;
            return (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityLabel={
                  attendanceDayLabel(day) +
                  ": " +
                  (total
                    ? total + (total === 1 ? " presença" : " presenças")
                    : "sem registro")
                }
                accessibilityHint={
                  future ? "Data futura" : "Ver aulas deste dia"
                }
                accessibilityState={{ disabled: future }}
                disabled={future}
                onPress={() => onDay(day)}
                style={({ pressed }) => [
                  s.cell,
                  s.day,
                  total > 0 && s.attended,
                  day === today && s.today,
                  future && s.future,
                  pressed && s.pressed,
                ]}
              >
                <Text style={[s.dayText, total > 0 && s.attendedText]}>
                  {Number(day.slice(-2))}
                </Text>
                <View style={s.marker}>
                  {total > 1 ? (
                    <Text style={s.count}>{total} aulas</Text>
                  ) : total === 1 ? (
                    <View style={s.dot} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
      <View style={s.legend}>
        <View style={s.dot} />
        <Text style={s.caption}>Treinou · toque no dia para ver as aulas</Text>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  calendar: { gap: 5 },
  week: { flexDirection: "row", gap: 3 },
  weekday: {
    flex: 1,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: colors.muted,
    paddingBottom: 6,
  },
  cell: { flex: 1, minWidth: 0, height: 47 },
  day: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
    gap: 2,
  },
  dayText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: colors.muted,
  },
  attended: {
    backgroundColor: accents.mint.soft,
    borderColor: accents.mint.border,
  },
  attendedText: { color: accents.mint.color },
  today: { borderColor: colors.primaryLight },
  future: { opacity: 0.35 },
  pressed: { opacity: 0.65 },
  marker: { height: 10, justifyContent: "center" },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: accents.mint.color,
  },
  count: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 8,
    color: accents.mint.color,
  },
  legend: { flexDirection: "row", alignItems: "center", gap: 7, paddingTop: 8 },
  caption: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 17,
    color: colors.muted,
  },
});
