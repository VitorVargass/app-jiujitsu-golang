import { Pressable, StyleSheet, Text, View } from "react-native";
import { Field, Label } from "../../components/ui";
import { Icon } from "../../components/Icon";
import { colors } from "../../theme";
import {
  WeeklyGroup,
  emptyGroup,
  orderedDays,
  dayNames,
  fullDays,
} from "./weekly";

export function WeeklyEditor({
  groups,
  onChange,
  disabled,
}: {
  groups: WeeklyGroup[];
  onChange: (groups: WeeklyGroup[]) => void;
  disabled?: boolean;
}) {
  function update(key: string, change: Partial<WeeklyGroup>) {
    onChange(groups.map((g) => (g.key === key ? { ...g, ...change } : g)));
  }
  return (
    <View style={{ gap: 14 }}>
      <Label muted>
        Marque os dias e informe todos os horários separados por vírgula.
      </Label>
      {groups.map((group, index) => (
        <View key={group.key} style={s.group}>
          <View style={s.headingRow}>
            <Text style={s.heading}>
              {groups.length > 1 ? "Linha " + (index + 1) : "Dias da semana"}
            </Text>
            {groups.length > 1 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={"Remover linha " + (index + 1)}
                disabled={disabled}
                onPress={() =>
                  onChange(groups.filter((g) => g.key !== group.key))
                }
                style={s.remove}
              >
                <Icon name="close" size={16} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
          <View style={s.days}>
            {orderedDays.map((day) => (
              <Pressable
                key={day}
                accessibilityRole="checkbox"
                accessibilityLabel={fullDays[day] + " na linha " + (index + 1)}
                accessibilityState={{
                  checked: group.days.includes(day),
                  disabled,
                }}
                disabled={disabled}
                onPress={() =>
                  update(group.key, {
                    days: group.days.includes(day)
                      ? group.days.filter((d) => d !== day)
                      : [...group.days, day],
                  })
                }
                style={({ pressed }) => [
                  s.day,
                  group.days.includes(day) && s.daySelected,
                  pressed && { opacity: 0.65 },
                ]}
              >
                <Text
                  style={[
                    s.dayText,
                    group.days.includes(day) && { color: colors.onPrimary },
                  ]}
                >
                  {dayNames[day]}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={s.fields}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Field
                label="Horários"
                accessibilityLabel={
                  groups.length > 1
                    ? "Horários da linha " + (index + 1)
                    : "Horários"
                }
                value={group.times}
                onChangeText={(times) => update(group.key, { times })}
                placeholder="19:00, 20:00"
                editable={!disabled}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={{ width: 92 }}>
              <Field
                label="Duração (min)"
                accessibilityLabel={
                  groups.length > 1
                    ? "Duração da linha " + (index + 1)
                    : "Duração (min)"
                }
                value={group.duration}
                onChangeText={(duration) => update(group.key, { duration })}
                keyboardType="number-pad"
                editable={!disabled}
                maxLength={3}
              />
            </View>
          </View>
        </View>
      ))}
      <Pressable
        accessibilityRole="button"
        disabled={disabled || groups.length >= 10}
        onPress={() => onChange([...groups, emptyGroup("row-" + Date.now())])}
        style={({ pressed }) => [s.add, pressed && { opacity: 0.6 }]}
      >
        <Icon name="plus" size={16} color={colors.primary} />
        <Text style={s.addText}>Adicionar outros dias e horários</Text>
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  group: {
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.background,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heading: { fontFamily: "Lato_700Bold", fontSize: 13, color: colors.text },
  remove: {
    minHeight: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: -12,
    marginRight: -10,
  },
  days: { flexDirection: "row", gap: 4 },
  day: {
    flex: 1,
    minHeight: 44,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  daySelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayText: { fontSize: 11, fontFamily: "Lato_700Bold", color: colors.muted },
  fields: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  add: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
  },
  addText: {
    fontFamily: "Lato_700Bold",
    fontSize: 13,
    color: colors.primary,
    flexShrink: 1,
  },
});
