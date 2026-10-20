import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EditorDialog } from "../../components/EditorDialog";
import { Icon } from "../../components/Icon";
import { Avatar, Button } from "../../components/ui";
import { AttendanceOptions, CheckinResult } from "../../types";
import { accents, colors, displayTime } from "../../theme";

type Lesson = AttendanceOptions["options"][number];
export function KioskLessonPicker({
  options,
  active,
  timezone,
  disabled,
  onSelect,
}: {
  options: Lesson[];
  active?: Lesson;
  timezone: string;
  disabled: boolean;
  onSelect: (lesson: Lesson) => void;
}) {
  const [open, setOpen] = useState(false);
  const copy = (
    <>
      <View style={s.lessonIcon}>
        <Icon name="calendar" size={19} color={colors.muted} />
      </View>
      <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
        <Text style={s.lessonName}>
          {active?.class_name ?? "Escolha sua aula"}
        </Text>
        <Text style={s.caption}>
          {active
            ? displayTime(active.starts_at, timezone) +
              "–" +
              displayTime(active.ends_at, timezone)
            : options.length + " aulas neste horário"}
        </Text>
      </View>
      {options.length > 1 ? (
        <Icon name="chevron-right" size={17} color={colors.muted} />
      ) : (
        <View style={s.dot} />
      )}
    </>
  );
  return (
    <>
      {options.length > 1 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            active ? "Trocar aula: " + active.class_name : "Escolher aula"
          }
          accessibilityState={{ disabled, expanded: open }}
          disabled={disabled}
          onPress={() => setOpen(true)}
          style={({ pressed }) => [
            s.lesson,
            s.selectable,
            pressed && { opacity: 0.7 },
          ]}
        >
          {copy}
        </Pressable>
      ) : (
        <View style={s.lesson}>{copy}</View>
      )}
      {open ? (
        <EditorDialog
          title="Qual aula você vai fazer?"
          onClose={() => setOpen(false)}
        >
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Aulas neste horário"
            style={{ gap: 8 }}
          >
            {options.map((lesson) => {
              const selected =
                active?.schedule_id === lesson.schedule_id &&
                active.date === lesson.date;
              return (
                <Pressable
                  key={lesson.schedule_id + lesson.date}
                  accessibilityRole="radio"
                  accessibilityLabel={lesson.class_name}
                  accessibilityState={{ checked: selected, disabled }}
                  disabled={disabled}
                  onPress={() => {
                    onSelect(lesson);
                    setOpen(false);
                  }}
                  style={[s.option, selected && s.selected]}
                >
                  <View style={{ flex: 1, gap: 5 }}>
                    <Text style={s.lessonName}>{lesson.class_name}</Text>
                    <Text style={s.caption}>
                      {displayTime(lesson.starts_at, timezone)}–
                      {displayTime(lesson.ends_at, timezone)}
                      {lesson.modality_name ? " · " + lesson.modality_name : ""}
                    </Text>
                  </View>
                  <Icon
                    name={selected ? "check-circle" : "chevron-right"}
                    color={selected ? colors.primaryLight : colors.muted}
                    size={20}
                  />
                </Pressable>
              );
            })}
          </View>
        </EditorDialog>
      ) : null}
    </>
  );
}
export function KioskSuccess({
  result,
  timezone,
  onNext,
}: {
  result: CheckinResult;
  timezone: string;
  onNext: () => void;
}) {
  return (
    <View style={s.success} accessibilityLiveRegion="polite">
      <View style={s.successIcon}>
        <Icon name="check-circle" size={40} color={accents.mint.color} />
      </View>
      <Text accessibilityRole="header" style={s.successTitle}>
        {result.duplicate ? "Você já está na lista" : "Presença confirmada"}
      </Text>
      <View style={s.person}>
        <Avatar name={result.student_name} />
        <View style={{ gap: 5, flex: 1, minWidth: 0 }}>
          <Text style={s.student}>{result.student_name}</Text>
          {result.belt ? <Text style={s.caption}>{result.belt}</Text> : null}
        </View>
      </View>
      <View style={s.confirmedLesson}>
        <Text style={s.lessonName}>{result.class_name}</Text>
        <Text style={s.caption}>
          {displayTime(result.checked_in_at, timezone)} ·{" "}
          {result.duplicate
            ? "Presença já registrada nesta aula"
            : "Bom treino!"}
        </Text>
      </View>
      <Button compact secondary onPress={onNext}>
        Próximo aluno
      </Button>
      <Text style={s.returnText}>
        A tela volta automaticamente em instantes.
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  lesson: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.background,
    minHeight: 68,
  },
  selectable: { borderWidth: 1, borderColor: colors.border },
  lessonIcon: { width: 32, alignItems: "center" },
  lessonName: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_600SemiBold",
  },
  caption: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
  },
  dot: {
    width: 6,
    height: 6,
    backgroundColor: accents.mint.color,
    borderRadius: 3,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
  },
  selected: {
    backgroundColor: accents.brand.soft,
    borderColor: accents.brand.border,
  },
  success: { alignItems: "center", gap: 24, paddingVertical: 14 },
  successIcon: {
    width: 86,
    height: 86,
    borderRadius: 43,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: accents.mint.soft,
  },
  successTitle: {
    fontFamily: "Inter_700Bold",
    color: colors.text,
    fontSize: 25,
    lineHeight: 32,
    textAlign: "center",
  },
  person: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    maxWidth: "100%",
  },
  student: {
    fontFamily: "Inter_600SemiBold",
    color: colors.text,
    fontSize: 18,
    lineHeight: 26,
  },
  confirmedLesson: { alignItems: "center", gap: 6 },
  returnText: {
    fontFamily: "Inter_400Regular",
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
  },
});
