import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api, academyPath } from "../../services/api";
import { useSession } from "../../services/session";
import { AcademyShell, RoleGate } from "../shared/AcademyShell";
import {
  Card,
  Heading,
  Label,
  Button,
  Notice,
  Loading,
  Empty,
} from "../../components/ui";
import { Attendance, Session } from "../../types";
import { displayDate, displayTime } from "../../theme";
function Content({ id }: { id: string }) {
  const { academy } = useSession(),
    a = academy!;
  const records = useQuery({
    queryKey: ["attendances", a.id, id],
    queryFn: () =>
      api<Attendance[]>(academyPath(a.id, "/sessions/" + id + "/attendances")),
    refetchInterval: 5000,
  });
  const sessions = useQuery({
    queryKey: ["sessions", a.id],
    queryFn: () => api<Session[]>(academyPath(a.id, "/sessions")),
  });
  const current = sessions.data?.find((s) => s.id === id);
  return (
    <AcademyShell title={current?.class_name ?? "Lista de presença"}>
      <Heading>{records.data?.length ?? 0} presentes</Heading>
      {current ? (
        <Label muted>
          {displayDate(current.starts_at, a.timezone)} •{" "}
          {displayTime(current.starts_at, a.timezone)}
        </Label>
      ) : null}
      <Label muted>Presenças registradas no tablet ou pelo gestor.</Label>
      <Notice message={records.error?.message} />
      {records.isPending ? (
        <Loading />
      ) : records.data?.length ? (
        records.data.map((p) => (
          <Card key={p.id}>
            <Heading>{p.student_name}</Heading>
            <Label muted>
              {p.belt} •{" "}
              {p.source === "manager"
                ? "Lançado pelo gestor"
                : "Registrado no tablet"}
            </Label>
          </Card>
        ))
      ) : (
        <Empty>O primeiro check-in aparecerá aqui.</Empty>
      )}
      <Button secondary onPress={() => router.replace("/classes")}>
        Ver agenda das turmas
      </Button>
    </AcademyShell>
  );
}
export default function AttendanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <RoleGate role="admin">
      <Content id={id} />
    </RoleGate>
  );
}
