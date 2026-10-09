import { router } from "expo-router";
import { View, Text } from "react-native";
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
  Row,
} from "../../components/ui";
import { Dashboard, Session } from "../../types";
import { money } from "../../types/billing";
import { displayTime, colors } from "../../theme";
function Content() {
  const { academy } = useSession();
  const a = academy!;
  const dash = useQuery({
    queryKey: ["dashboard", a.id],
    queryFn: () => api<Dashboard>(academyPath(a.id, "/dashboard?role=admin")),
    refetchInterval: 10000,
  });
  const sessions = useQuery({
    queryKey: ["sessions", a.id],
    queryFn: () => api<Session[]>(academyPath(a.id, "/sessions")),
    refetchInterval: 8000,
  });
  const maximum = Math.max(1, ...(dash.data?.week.map((d) => d.count) ?? []));
  const open = sessions.data?.filter((s) => s.status === "open") ?? [];
  return (
    <AcademyShell title="Minha academia">
      {dash.isPending ? (
        <Loading />
      ) : dash.error ? (
        <Notice message={dash.error.message} />
      ) : (
        <Row>
          {[
            ["Alunos ativos", dash.data?.active_students],
            ["Recebido no mês", money(dash.data?.received_month_cents ?? 0)],
            ["Em aberto", money(dash.data?.open_cents ?? 0)],
            ["Presenças hoje", dash.data?.presences_today],
          ].map(([label, value]) => (
            <Card
              key={String(label)}
              style={{
                flex: 1,
                minWidth: 120,
                minHeight: 104,
                padding: 16,
                justifyContent: "space-between",
              }}
            >
              <Label muted>{label}</Label>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={{
                  fontSize: typeof value === "string" ? 20 : 28,
                  color: colors.text,
                  fontFamily: "Montserrat_700Bold",
                }}
              >
                {value}
              </Text>
            </Card>
          ))}
        </Row>
      )}
      <Card>
        <Heading>Presenças nos últimos 7 dias</Heading>
        <View
          style={{
            flexDirection: "row",
            height: 140,
            alignItems: "flex-end",
            gap: 10,
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
                  height: Math.max(3, (d.count / maximum) * 85),
                  width: "65%",
                  backgroundColor: colors.primary,
                  borderRadius: 2,
                }}
              />
              <Label muted>{d.date.slice(-2)}</Label>
            </View>
          ))}
        </View>
      </Card>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Heading>Aulas abertas</Heading>
        <Button
          compact
          secondary
          icon="calendar"
          onPress={() => router.push("/classes")}
        >
          Turmas
        </Button>
      </View>
      <Notice message={sessions.error?.message} />
      {sessions.isPending ? (
        <Loading />
      ) : open.length ? (
        open.map((s) => (
          <Card key={s.id}>
            <Heading>{s.class_name}</Heading>
            <Label muted>
              {displayTime(s.starts_at, a.timezone)} • {s.attendance_count}{" "}
              presentes
            </Label>
            <Button
              secondary
              onPress={() =>
                router.push({
                  pathname: "/attendance/[id]",
                  params: { id: s.id },
                })
              }
            >
              Ver presença / encerrar aula
            </Button>
          </Card>
        ))
      ) : (
        <Empty>Nenhuma aula aberta. Abra o horário de hoje em Turmas.</Empty>
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
