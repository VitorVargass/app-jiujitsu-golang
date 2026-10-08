import { useRef, useState } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, academyPath } from "../../services/api";
import { queryClient, useSession } from "../../services/session";
import { AcademyShell } from "../shared/AcademyShell";
import { Attendance, CheckinResult, Member, Session } from "../../types";
import {
  Card,
  Heading,
  Label,
  Button,
  Notice,
  Loading,
  Field,
  Row,
  Avatar,
  Empty,
} from "../../components/ui";
import { displayTime } from "../../theme";
function Content({ id }: { id: string }) {
  const { academy } = useSession();
  const a = academy!;
  const [search, setSearch] = useState("");
  const keys = useRef<Record<string, string>>({});
  const records = useQuery({
    queryKey: ["attendances", a.id, id],
    queryFn: () =>
      api<Attendance[]>(academyPath(a.id, "/sessions/" + id + "/attendances")),
    refetchInterval: 8000,
  });
  const sessions = useQuery({
    queryKey: ["sessions", a.id],
    queryFn: () => api<Session[]>(academyPath(a.id, "/sessions")),
  });
  const members = useQuery({
    queryKey: ["members", a.id],
    queryFn: () => api<Member[]>(academyPath(a.id, "/members")),
  });
  const current = sessions.data?.find((s) => s.id === id);
  const mark = useMutation({
    mutationFn: (m: Member) => {
      keys.current[m.id] ??= Crypto.randomUUID();
      return api<CheckinResult>(
        academyPath(a.id, "/sessions/" + id + "/check-ins"),
        {
          method: "POST",
          key: keys.current[m.id],
          body: { membership_id: m.id },
        },
      );
    },
    onSuccess: () => void queryClient.invalidateQueries(),
  });
  const close = useMutation({
    mutationFn: () =>
      api(academyPath(a.id, "/sessions/" + id), {
        method: "PATCH",
        body: { status: "closed" },
      }),
    onSuccess: () => void queryClient.invalidateQueries(),
  });
  return (
    <AcademyShell
      title={current?.class_name || "Lista de presença"}
      subtitle={
        current
          ? "Aula " + (current.status === "open" ? "em andamento" : "encerrada")
          : "Carregando aula..."
      }
    >
      <Notice
        message={
          records.error?.message ||
          members.error?.message ||
          mark.error?.message ||
          close.error?.message
        }
      />
      <Heading>{records.data?.length ?? 0} presentes</Heading>
      {records.isPending ? (
        <Loading />
      ) : records.data?.length ? (
        records.data.map((p) => (
          <Card key={p.id}>
            <Row>
              <Avatar name={p.student_name} />
              <Heading>{p.student_name}</Heading>
              <Label>✓ {displayTime(p.checked_in_at, a.timezone)}</Label>
            </Row>
            <Label muted>{p.belt}</Label>
          </Card>
        ))
      ) : (
        <Empty>
          As presenças aparecerão aqui assim que os alunos fizerem check-in.
        </Empty>
      )}
      {current?.status === "open" && (
        <>
          <Heading>Lançar presença</Heading>
          <Field
            label="Buscar aluno"
            value={search}
            onChangeText={setSearch}
            placeholder="Nome do aluno"
          />
          {members.data
            ?.filter(
              (m) =>
                m.status === "active" &&
                m.roles.includes("student") &&
                m.name.toLowerCase().includes(search.toLowerCase()),
            )
            .map((m) => (
              <Card key={m.id}>
                <Row>
                  <Avatar name={m.name} />
                  <Heading>{m.name}</Heading>
                </Row>
                <Button
                  secondary
                  loading={mark.isPending && mark.variables?.id === m.id}
                  disabled={mark.isPending}
                  onPress={() => mark.mutate(m)}
                >
                  Registrar presença
                </Button>
              </Card>
            ))}
          <Button
            secondary
            loading={close.isPending}
            onPress={() => close.mutate()}
          >
            Encerrar aula
          </Button>
        </>
      )}
      <Button secondary onPress={() => router.back()}>
        Voltar
      </Button>
    </AcademyShell>
  );
}
export default function AttendanceScreen() {
  const { academy } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  if (
    !academy ||
    (!academy.roles.includes("teacher") && !academy.roles.includes("admin"))
  )
    return <Redirect href="/onboarding" />;
  return <Content id={id} />;
}
