import { StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { EditorDialog } from "../../components/EditorDialog";
import { Badge, Button, Loading, Notice } from "../../components/ui";
import { Icon } from "../../components/Icon";
import { api, academyPath } from "../../services/api";
import type { Attendance } from "../../types";
import type { Page } from "../../types/billing";
import { colors, accents, displayTime } from "../../theme";
import {
  attendanceDayLabel,
  groupAttendanceDays,
  loadAttendanceMonth,
} from "./attendance-calendar";

export function StudentAttendanceDay({
  academyId,
  studentId,
  timezone,
  day,
  canRecord,
  onRegister,
  onClose,
}: {
  academyId: string;
  studentId: string;
  timezone: string;
  day: string;
  canRecord: boolean;
  onRegister: () => void;
  onClose: () => void;
}) {
  const month = day.slice(0, 7);
  const q = useQuery({
    queryKey: ["student-attendance-month", academyId, studentId, month],
    queryFn: () =>
      loadAttendanceMonth((page) =>
        api<Page<Attendance>>(
          academyPath(
            academyId,
            "/attendances?student_id=" +
              studentId +
              "&month=" +
              month +
              "&page=" +
              page +
              "&page_size=100",
          ),
        ),
      ),
  });
  const records = groupAttendanceDays(q.data ?? [], timezone).get(day) ?? [];
  return (
    <EditorDialog
      title={attendanceDayLabel(day)}
      onClose={onClose}
      footer={
        canRecord ? (
          <Button compact icon="plus" onPress={onRegister}>
            Registrar neste dia
          </Button>
        ) : undefined
      }
    >
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <>
          <Notice message={q.error.message} />
          <Button secondary compact onPress={() => void q.refetch()}>
            Tentar novamente
          </Button>
        </>
      ) : records.length ? (
        <>
          <Badge
            tone="mint"
            label={
              records.length === 1
                ? "1 presença confirmada"
                : records.length + " presenças confirmadas"
            }
          />
          {records.map((item) => (
            <View key={item.id} style={s.lesson}>
              <View style={s.heading}>
                <Icon
                  name="check-circle"
                  color={accents.mint.color}
                  size={18}
                />
                <Text style={s.name}>{item.class_name}</Text>
              </View>
              <Text style={s.caption}>
                {item.modality_name ? item.modality_name + " · " : ""}Aula às{" "}
                {displayTime(item.starts_at ?? item.checked_in_at, timezone)}
              </Text>
              <Text style={s.caption}>
                {item.source === "manager"
                  ? "Lançado pelo gestor"
                  : "Check-in no tablet"}
              </Text>
              <Text style={s.caption}>
                Registrado em{" "}
                {new Intl.DateTimeFormat("pt-BR", {
                  timeZone: timezone,
                  dateStyle: "short",
                }).format(new Date(item.checked_in_at))}{" "}
                às {displayTime(item.checked_in_at, timezone)}
              </Text>
            </View>
          ))}
        </>
      ) : (
        <View style={s.empty}>
          <Icon name="calendar" color={colors.muted} size={28} />
          <Text style={s.name}>Nenhuma presença registrada</Text>
          <Text style={s.caption}>
            Este dia não tem registros de treino. Isso não representa uma falta
            automática.
          </Text>
        </View>
      )}
    </EditorDialog>
  );
}
const s = StyleSheet.create({
  lesson: {
    gap: 7,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  heading: { flexDirection: "row", alignItems: "center", gap: 9 },
  name: {
    flexShrink: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  caption: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: colors.muted,
    lineHeight: 19,
  },
  empty: { gap: 12, alignItems: "center", paddingVertical: 20 },
});
