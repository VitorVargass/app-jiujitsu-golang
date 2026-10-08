import { useState } from "react";
import { router } from "expo-router";
import { View, Text } from "react-native";
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
  Row,
  Field,
} from "../../components/ui";
import {
  Dashboard,
  Device,
  Member,
  MembershipRequest,
  Session,
} from "../../types";
import { colors, displayTime, roleLabel } from "../../theme";
function Content() {
  const { academy, activateDevice } = useSession();
  const a = academy!;
  const [deviceName, setDeviceName] = useState("Tablet do tatame");
  const dash = useQuery({
    queryKey: ["dashboard", a.id],
    queryFn: () => api<Dashboard>(academyPath(a.id, "/dashboard")),
    refetchInterval: 10000,
  });
  const requests = useQuery({
    queryKey: ["requests", a.id],
    queryFn: () =>
      api<MembershipRequest[]>(academyPath(a.id, "/membership-requests")),
    refetchInterval: 10000,
  });
  const members = useQuery({
    queryKey: ["members", a.id],
    queryFn: () => api<Member[]>(academyPath(a.id, "/members")),
  });
  const devices = useQuery({
    queryKey: ["devices", a.id],
    queryFn: () => api<Device[]>(academyPath(a.id, "/devices")),
  });
  const sessions = useQuery({
    queryKey: ["sessions", a.id],
    queryFn: () => api<Session[]>(academyPath(a.id, "/sessions")),
    refetchInterval: 10000,
  });
  const decide = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(academyPath(a.id, "/membership-requests/" + id), {
        method: "PATCH",
        body: { status },
      }),
    onSuccess: () => void queryClient.invalidateQueries(),
  });
  const block = useMutation({
    mutationFn: (m: Member) =>
      api(academyPath(a.id, "/members/" + m.id), {
        method: "PATCH",
        body: { status: m.status === "active" ? "blocked" : "active" },
      }),
    onSuccess: () => void queryClient.invalidateQueries(),
  });
  const revoke = useMutation({
    mutationFn: (id: string) =>
      api(academyPath(a.id, "/devices/" + id), { method: "DELETE" }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["devices"] }),
  });
  const activate = useMutation({
    mutationFn: async () => {
      const d = await api<{ id: string; token: string; academy_id: string }>(
        academyPath(a.id, "/devices"),
        { method: "POST", body: { name: deviceName } },
      );
      await activateDevice({
        kind: "device",
        token: d.token,
        device_id: d.id,
        academy_id: a.id,
        academy_name: a.name,
      });
      router.replace("/kiosk");
    },
  });
  const maximum = Math.max(1, ...(dash.data?.week.map((d) => d.count) || []));
  return (
    <AcademyShell title="Minha academia" subtitle={a.name}>
      <Card style={{ backgroundColor: colors.surfaceRaised }}>
        <Label muted>Código para alunos e professores</Label>
        <Text
          selectable
          style={{
            color: colors.text,
            fontSize: 25,
            fontWeight: "800",
            letterSpacing: 2,
          }}
        >
          {a.code}
        </Text>
      </Card>
      {dash.isPending ? (
        <Loading />
      ) : dash.error ? (
        <Notice message={dash.error.message} />
      ) : (
        <Row>
          {[
            ["Alunos ativos", dash.data?.active_students],
            ["Presentes hoje", dash.data?.presences_today],
            ["Presenças no mês", dash.data?.presences_month],
          ].map(([label, value]) => (
            <Card key={String(label)} style={{ flex: 1, minWidth: 120 }}>
              <Text
                style={{ fontSize: 30, fontWeight: "800", color: colors.text }}
              >
                {value}
              </Text>
              <Label muted>{label}</Label>
            </Card>
          ))}
        </Row>
      )}
      <Card>
        <Heading>Presenças nos últimos 7 dias</Heading>
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            height: 130,
            gap: 12,
          }}
        >
          {dash.data?.week.map((d) => (
            <View
              key={d.date}
              style={{ flex: 1, alignItems: "center", gap: 6 }}
            >
              <Label muted>{d.count}</Label>
              <View
                style={{
                  height: Math.max(4, (d.count / maximum) * 80),
                  width: "70%",
                  backgroundColor: colors.primary,
                  borderRadius: 4,
                }}
              />
              <Label muted>{d.date.slice(-2)}</Label>
            </View>
          ))}
        </View>
      </Card>
      <Button onPress={() => router.push("/classes")}>
        Gerenciar turmas e horários
      </Button>
      <Notice
        message={
          decide.error?.message ||
          block.error?.message ||
          revoke.error?.message ||
          activate.error?.message
        }
      />
      <Heading>Solicitações de vínculo</Heading>
      {requests.isPending ? (
        <Loading />
      ) : requests.error ? (
        <Notice message={requests.error.message} />
      ) : requests.data?.some((q) => q.status === "pending") ? (
        requests.data
          .filter((q) => q.status === "pending")
          .map((q) => (
            <Card key={q.id}>
              <Heading>{q.name}</Heading>
              <Label muted>{roleLabel[q.role]}</Label>
              <Row>
                <Button
                  loading={decide.isPending}
                  onPress={() =>
                    decide.mutate({ id: q.id, status: "approved" })
                  }
                >
                  Aprovar
                </Button>
                <Button
                  secondary
                  disabled={decide.isPending}
                  onPress={() =>
                    decide.mutate({ id: q.id, status: "rejected" })
                  }
                >
                  Recusar
                </Button>
              </Row>
            </Card>
          ))
      ) : (
        <Empty>Nenhuma solicitação aguardando aprovação.</Empty>
      )}
      <Heading>Aulas abertas</Heading>
      {sessions.error && <Notice message={sessions.error.message} />}
      {sessions.data
        ?.filter((s) => s.status === "open")
        .map((s) => (
          <Card key={s.id}>
            <Heading>{s.class_name}</Heading>
            <Label muted>
              {s.teacher_name} • {displayTime(s.starts_at, a.timezone)}
            </Label>
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
        ))}
      <Heading>Alunos e equipe</Heading>
      {members.error && <Notice message={members.error.message} />}
      {members.data?.map((m) => (
        <Card key={m.id}>
          <Heading>{m.name}</Heading>
          <Label muted>
            {m.roles.map((r) => roleLabel[r]).join(" • ")} •{" "}
            {m.status === "active" ? "Ativo" : "Bloqueado"}
          </Label>
          {m.id !== a.membership_id && (
            <Button
              secondary
              loading={block.isPending && block.variables?.id === m.id}
              disabled={block.isPending}
              onPress={() => block.mutate(m)}
            >
              {m.status === "active" ? "Bloquear vínculo" : "Reativar vínculo"}
            </Button>
          )}
        </Card>
      ))}
      <Card>
        <Heading>Modo tablet</Heading>
        <Label muted>
          Ative neste aparelho para receber os alunos no tatame. Para voltar à
          administração, você precisará entrar novamente.
        </Label>
        <Field
          label="Nome deste aparelho"
          value={deviceName}
          onChangeText={setDeviceName}
        />
        <Button loading={activate.isPending} onPress={() => activate.mutate()}>
          Ativar check-in neste aparelho
        </Button>
      </Card>
      <Heading>Tablets autorizados</Heading>
      {devices.error && <Notice message={devices.error.message} />}
      {devices.data?.length ? (
        devices.data.map((d) => (
          <Card key={d.id}>
            <Heading>{d.name}</Heading>
            <Label muted>{d.active ? "Autorizado" : "Desautorizado"}</Label>
            {d.active && (
              <Button
                secondary
                disabled={revoke.isPending}
                onPress={() => revoke.mutate(d.id)}
              >
                Desautorizar
              </Button>
            )}
          </Card>
        ))
      ) : (
        <Empty>Nenhum tablet autorizado.</Empty>
      )}
    </AcademyShell>
  );
}
export default function AcademyScreen() {
  return (
    <RoleGate role="admin">
      <Content />
    </RoleGate>
  );
}
