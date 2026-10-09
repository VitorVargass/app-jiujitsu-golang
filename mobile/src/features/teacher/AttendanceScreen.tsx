import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, academyPath } from "../../services/api";
import { queryClient, useSession } from "../../services/session";
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
import { displayTime } from "../../theme";
function Content({ id }: { id: string }) {
  const { academy } = useSession();
  const a = academy!;
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
  const close = useMutation({
    mutationFn: (status: string) =>
      api(academyPath(a.id, "/sessions/" + id), {
        method: "PATCH",
        body: { status },
      }),
    onSuccess: () => void queryClient.invalidateQueries(),
  });
  return (
    <AcademyShell title={current?.class_name ?? "Lista de presença"}>
      <Heading>{records.data?.length ?? 0} presentes</Heading>
      <Label muted>Presenças registradas pelos tablets autorizados.</Label>
      <Notice message={records.error?.message || close.error?.message} />
      {records.isPending ? (
        <Loading />
      ) : records.data?.length ? (
        records.data.map((p) => (
          <Card key={p.id}>
            <Heading>{p.student_name}</Heading>
            <Label muted>
              {p.belt} • {displayTime(p.checked_in_at, a.timezone)}
            </Label>
          </Card>
        ))
      ) : (
        <Empty>O primeiro check-in aparecerá aqui.</Empty>
      )}
      {current?.status === "open" ? (
        <Button
          loading={close.isPending}
          onPress={() => close.mutate("closed")}
        >
          Encerrar aula
        </Button>
      ) : (
        <Label>Aula encerrada.</Label>
      )}
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
