import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { View, Text } from "react-native";
import QRCode from "react-native-qrcode-svg";
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
import { Attendance, Credential, Dashboard } from "../../types";
import { colors, displayDate, displayTime } from "../../theme";
export function StudentHome() {
  const { academy, session } = useSession();
  const a = academy!;
  const dash = useQuery({
    queryKey: ["dashboard", a.id],
    queryFn: () => api<Dashboard>(academyPath(a.id, "/dashboard?role=student")),
  });
  const history = useQuery({
    queryKey: ["history", a.id],
    queryFn: () => api<Attendance[]>(academyPath(a.id, "/me/attendances")),
  });
  return (
    <AcademyShell
      title={
        "Olá, " +
        (session?.kind === "user" ? session.user.name.split(" ")[0] : "Aluno") +
        "!"
      }
      subtitle={a.belt + " • " + a.name}
    >
      <Card style={{ backgroundColor: colors.surfaceRaised }}>
        <Heading>Pronto para o próximo treino?</Heading>
        <Label muted>Seu QR Code é sua identificação no tatame.</Label>
        <Button onPress={() => router.push("/qr")}>
          Meu QR Code • Fazer check-in
        </Button>
      </Card>
      {dash.error && <Notice message={dash.error.message} />}
      <Row>
        <Card style={{ flex: 1 }}>
          <Label muted>Presenças no mês</Label>
          <Text style={{ color: colors.text, fontSize: 32, fontWeight: "800" }}>
            {dash.data?.presences_month ?? "—"}
          </Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Label muted>Presenças hoje</Label>
          <Text style={{ color: colors.text, fontSize: 32, fontWeight: "800" }}>
            {dash.data?.presences_today ?? "—"}
          </Text>
        </Card>
      </Row>
      <Row>
        <Button secondary onPress={() => router.push("/history")}>
          Minhas presenças
        </Button>
        <Button secondary onPress={() => router.push("/classes")}>
          Horários das aulas
        </Button>
      </Row>
      <Heading>Últimos treinos</Heading>
      {history.isPending ? (
        <Loading />
      ) : history.error ? (
        <Notice message={history.error.message} />
      ) : history.data?.length ? (
        history.data.slice(0, 4).map((p) => (
          <Card key={p.id}>
            <Heading>{p.class_name}</Heading>
            <Row>
              <Label muted>
                {displayDate(p.checked_in_at, a.timezone)} •{" "}
                {displayTime(p.checked_in_at, a.timezone)}
              </Label>
              <Label>✓ Presente</Label>
            </Row>
          </Card>
        ))
      ) : (
        <Empty>Seu primeiro treino aparecerá aqui após o check-in.</Empty>
      )}
    </AcademyShell>
  );
}
export function QRScreen() {
  const { academy } = useSession();
  const a = academy!;
  const credential = useQuery({
    queryKey: ["credential", a.id],
    queryFn: () => api<Credential>(academyPath(a.id, "/me/student-credential")),
  });
  return (
    <AcademyShell title="Meu QR Code">
      {credential.isPending ? (
        <Loading />
      ) : credential.error ? (
        <Notice message={credential.error.message} />
      ) : (
        credential.data && (
          <Card style={{ alignItems: "center", paddingVertical: 32 }}>
            <View
              style={{
                backgroundColor: "white",
                padding: 18,
                borderRadius: 16,
              }}
            >
              <QRCode value={credential.data.qr_token} size={220} />
            </View>
            <Text
              selectable
              style={{
                color: colors.text,
                fontSize: 30,
                fontWeight: "800",
                letterSpacing: 3,
              }}
            >
              {credential.data.student_code}
            </Text>
            <Heading>{credential.data.student_name}</Heading>
            <Label muted>{credential.data.belt}</Label>
            <Label muted>{a.name}</Label>
          </Card>
        )
      )}
      <Label muted>
        Apresente este QR Code no tablet da academia. Você também pode digitar o
        código numérico.
      </Label>
      <Button secondary onPress={() => router.back()}>
        Voltar
      </Button>
    </AcademyShell>
  );
}
export function HistoryScreen() {
  const { academy } = useSession();
  const a = academy!;
  const history = useQuery({
    queryKey: ["history", a.id],
    queryFn: () => api<Attendance[]>(academyPath(a.id, "/me/attendances")),
    refetchInterval: 10000,
  });
  return (
    <AcademyShell
      title="Minhas presenças"
      subtitle="Seu caminho no tatame, treino após treino."
    >
      {history.isPending ? (
        <Loading />
      ) : history.error ? (
        <Notice message={history.error.message} />
      ) : history.data?.length ? (
        history.data.map((p) => (
          <Card key={p.id}>
            <Heading>{p.class_name}</Heading>
            <Row>
              <Label muted>
                {displayDate(p.checked_in_at, a.timezone)} •{" "}
                {displayTime(p.checked_in_at, a.timezone)}
              </Label>
              <Label>✓ Presente</Label>
            </Row>
          </Card>
        ))
      ) : (
        <Empty>Você ainda não registrou presença nesta academia.</Empty>
      )}
    </AcademyShell>
  );
}
export default function StudentScreen() {
  return (
    <RoleGate role="student">
      <StudentHome />
    </RoleGate>
  );
}
