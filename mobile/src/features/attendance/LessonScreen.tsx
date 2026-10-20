import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AcademyShell, RoleGate } from "../shared/AcademyShell";
import {
  Button,
  Card,
  Heading,
  Label,
  Loading,
  Notice,
  Empty,
} from "../../components/ui";
import { api, academyPath } from "../../services/api";
import { useSession } from "../../services/session";
import { Attendance, AttendanceOptions } from "../../types";
import { displayDate, displayTime } from "../../theme";
import { ManualAttendance } from "./ManualAttendance";

function Content() {
  const { scheduleId, date } = useLocalSearchParams<{
    scheduleId: string;
    date: string;
  }>();
  const { academy } = useSession(),
    a = academy!;
  const lessons = useQuery({
    queryKey: ["lesson-day", a.id, date],
    queryFn: () =>
      api<AttendanceOptions>(
        academyPath(
          a.id,
          "/attendance-options?date=" + encodeURIComponent(date),
        ),
      ),
    refetchInterval: 10000,
  });
  const lesson = lessons.data?.options.find(
    (item) => item.schedule_id === scheduleId,
  );
  const list = useQuery({
    queryKey: ["lesson-presences", a.id, lesson?.session_id],
    queryFn: () =>
      api<Attendance[]>(
        academyPath(a.id, "/sessions/" + lesson!.session_id + "/attendances"),
      ),
    enabled: !!lesson?.session_id,
    refetchInterval: 8000,
  });
  return (
    <AcademyShell
      title={lesson?.class_name ?? "Presenças da aula"}
      swipeEnabled={false}
      titleAction={
        <Button
          compact
          secondary
          icon="chevron-left"
          onPress={() => router.replace("/classes")}
        >
          Turmas
        </Button>
      }
    >
      {lessons.isPending ? (
        <Loading />
      ) : lessons.error ? (
        <Notice message={lessons.error.message} />
      ) : !lesson ? (
        <Notice message="Este horário não está disponível para este dia. Confira a agenda em Turmas." />
      ) : (
        <>
          <Card>
            <Heading>
              {displayDate(lesson.starts_at, a.timezone)} •{" "}
              {displayTime(lesson.starts_at, a.timezone)}–
              {displayTime(lesson.ends_at, a.timezone)}
            </Heading>
            <Label muted>
              {lesson.modality_name} • {lesson.attendance_count} presentes
            </Label>
            <Label muted>
              As presenças do tablet aparecem automaticamente. O gestor também
              pode lançar um aluno que treinou nesta aula.
            </Label>
            <ManualAttendance
              scheduleId={scheduleId}
              date={date}
              disabled={!lesson.can_record}
            />
          </Card>
          {list.error ? (
            <Notice message={list.error.message} />
          ) : lesson.session_id && list.isPending ? (
            <Loading />
          ) : list.data?.length ? (
            list.data.map((p) => (
              <Card key={p.id}>
                <Heading>{p.student_name}</Heading>
                <Label muted>{p.belt}</Label>
                <Label>
                  {p.source === "manager"
                    ? "Lançado pelo gestor"
                    : "Check-in no tablet"}{" "}
                  • {displayTime(p.checked_in_at, a.timezone)}
                </Label>
              </Card>
            ))
          ) : (
            <Empty>Nenhuma presença registrada nesta aula.</Empty>
          )}
        </>
      )}
    </AcademyShell>
  );
}
export default function LessonScreen() {
  return (
    <RoleGate role="admin">
      <Content />
    </RoleGate>
  );
}
