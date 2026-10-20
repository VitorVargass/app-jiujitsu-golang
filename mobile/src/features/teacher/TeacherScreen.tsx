import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AcademyShell, RoleGate } from "../shared/AcademyShell";
import {
  Card,
  Heading,
  Label,
  Button,
  Notice,
  Loading,
  Empty,
  Row,
} from "../../components/ui";
import { api, academyPath } from "../../services/api";
import { useSession } from "../../services/session";
import { Session } from "../../types";
import { displayTime, displayDate } from "../../theme";
function Content() {
  const { academy } = useSession();
  const a = academy!;
  const sessions = useQuery({
    queryKey: ["sessions", a.id],
    queryFn: () => api<Session[]>(academyPath(a.id, "/sessions")),
    refetchInterval: 10000,
  });
  const own =
    sessions.data?.filter((s) => s.teacher_membership_id === a.membership_id) ||
    [];
  return (
    <AcademyShell title="Olá, Professor!" subtitle="Sua equipe. Sua evolução.">
      <Card>
        <Heading>Próximo passo: abrir a aula</Heading>
        <Label muted>
          Escolha o horário de hoje para liberar o check-in no tablet.
        </Label>
        <Button onPress={() => router.push("/classes")}>
          Ver turmas e abrir aula
        </Button>
      </Card>
      <Heading>Minhas aulas</Heading>
      {sessions.isPending ? (
        <Loading />
      ) : sessions.error ? (
        <Notice message={sessions.error.message} />
      ) : own.length ? (
        own.map((s) => (
          <Card key={s.id}>
            <Heading>{s.class_name}</Heading>
            <Row>
              <Label muted>
                {displayDate(s.starts_at, a.timezone)} •{" "}
                {displayTime(s.starts_at, a.timezone)}
              </Label>
              <Label>
                {s.status === "open"
                  ? "● Em andamento"
                  : s.status === "closed"
                    ? "Encerrada"
                    : "Cancelada"}
              </Label>
            </Row>
            <Label>{s.attendance_count} presentes</Label>
            <Button
              secondary
              onPress={() =>
                router.push({
                  pathname: "/attendance/[id]",
                  params: { id: s.id },
                })
              }
            >
              Ver presenças
            </Button>
          </Card>
        ))
      ) : (
        <Empty>Abra sua primeira aula na página de turmas.</Empty>
      )}
    </AcademyShell>
  );
}
export default function TeacherScreen() {
  return (
    <RoleGate role="teacher">
      <Content />
    </RoleGate>
  );
}
