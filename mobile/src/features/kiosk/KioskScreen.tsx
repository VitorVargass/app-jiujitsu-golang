import { useEffect, useRef, useState } from "react";
import { Redirect } from "expo-router";
import { Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Crypto from "expo-crypto";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, academyPath, APIError } from "../../services/api";
import { useSession } from "../../services/session";
import { Session, CheckinResult } from "../../types";
import {
  Page,
  Card,
  Heading,
  Label,
  Button,
  Notice,
  Loading,
  Field,
  Row,
  Chip,
  Avatar,
  Empty,
} from "../../components/ui";
import { colors, displayTime } from "../../theme";
function Content() {
  const { session, logout } = useSession();
  const device = session! as Extract<
    NonNullable<typeof session>,
    { kind: "device" }
  >;
  const [code, setCode] = useState(""),
    [selected, setSelected] = useState(""),
    [scanning, setScanning] = useState(false),
    [scanError, setScanError] = useState(""),
    [clock, setClock] = useState(new Date());
  const [permission, requestPermission] = useCameraPermissions();
  const submitting = useRef(false);
  const event = useRef<{
    sessionId: string;
    body: { qr_token?: string; student_code?: string };
    key: string;
  } | null>(null);
  const sessions = useQuery({
    queryKey: ["kiosk-sessions", device.academy_id],
    queryFn: () => api<Session[]>(academyPath(device.academy_id, "/sessions")),
    refetchInterval: 5000,
  });
  const active =
    sessions.data?.find((s) => s.id === selected) || sessions.data?.[0];
  const checkin = useMutation({
    mutationFn: () => {
      const e = event.current!;
      return api<CheckinResult>(
        academyPath(
          device.academy_id,
          "/sessions/" + e.sessionId + "/check-ins",
        ),
        { method: "POST", body: e.body, key: e.key },
      );
    },
  });
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const { isSuccess, reset: resetCheckin } = checkin;
  useEffect(() => {
    if (!isSuccess) return;
    const timer = setTimeout(() => {
      resetCheckin();
      event.current = null;
      setCode("");
    }, 3500);
    return () => clearTimeout(timer);
  }, [isSuccess, resetCheckin]);
  async function submit(
    body: { qr_token?: string; student_code?: string },
    retry = false,
  ) {
    if (!active || submitting.current) return;
    submitting.current = true;
    setScanError("");
    setScanning(false);
    if (
      !retry &&
      (!event.current ||
        event.current.sessionId !== active.id ||
        JSON.stringify(event.current.body) !== JSON.stringify(body))
    )
      event.current = { sessionId: active.id, body, key: Crypto.randomUUID() };
    try {
      await checkin.mutateAsync();
    } catch {
      /* The error is rendered below, without confirming attendance. */
    } finally {
      submitting.current = false;
    }
  }
  return (
    <Page
      title="CHECK-IN"
      subtitle={device.academy_name}
      action={<Chip>{displayTime(clock.toISOString())}</Chip>}
    >
      <Label muted>Registre sua presença e prepare-se para treinar.</Label>
      {sessions.isPending ? (
        <Loading />
      ) : sessions.error ? (
        <Notice message={sessions.error.message} />
      ) : !active ? (
        <Empty>Nenhuma aula aberta. Peça ao professor para abrir a aula.</Empty>
      ) : (
        <Row>
          {sessions.data?.map((s) => (
            <Chip
              key={s.id}
              selected={s.id === active.id}
              onPress={() => {
                if (submitting.current) return;
                setSelected(s.id);
                checkin.reset();
                event.current = null;
              }}
            >
              {s.class_name} • {displayTime(s.starts_at)}
            </Chip>
          ))}
        </Row>
      )}
      {checkin.isSuccess && checkin.data ? (
        <Card
          style={{
            alignItems: "center",
            paddingVertical: 40,
            borderColor: colors.success,
          }}
        >
          <View
            style={{
              backgroundColor: colors.success,
              width: 68,
              height: 68,
              borderRadius: 34,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 40, color: colors.background }}>✓</Text>
          </View>
          <Heading>
            {checkin.data.duplicate
              ? "Você já está na lista!"
              : "Presença registrada!"}
          </Heading>
          <Avatar name={checkin.data.student_name} />
          <Heading>{checkin.data.student_name}</Heading>
          <Label muted>{checkin.data.belt}</Label>
          <Label>{displayTime(checkin.data.checked_in_at)}</Label>
        </Card>
      ) : (
        <Card>
          <Field
            label="Código do aluno"
            editable={!checkin.isPending}
            value={code}
            onChangeText={(v) => {
              setCode(v.replace(/[^0-9]/g, ""));
              checkin.reset();
            }}
            keyboardType="number-pad"
            maxLength={8}
            placeholder="Digite os 8 números"
          />
          <Button
            disabled={!active || code.length !== 8}
            loading={checkin.isPending}
            onPress={() => void submit({ student_code: code })}
          >
            Confirmar presença
          </Button>
          <Label muted>ou apresente seu QR Code</Label>
          <Button
            secondary
            disabled={!active || checkin.isPending}
            onPress={() => {
              setScanning(!scanning);
              checkin.reset();
            }}
          >
            Escanear QR Code
          </Button>
        </Card>
      )}
      <Notice message={checkin.error?.message || scanError} />
      {checkin.error instanceof APIError && checkin.error.status === 0 && (
        <Button
          secondary
          loading={checkin.isPending}
          onPress={() => void submit(event.current!.body, true)}
        >
          Tentar novamente
        </Button>
      )}
      {scanning && (
        <Card>
          {permission?.granted ? (
            <CameraView
              style={{ height: 260, borderRadius: 12, overflow: "hidden" }}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={({ data }) => {
                if (!data.startsWith("tatame:")) {
                  setScanError("Este QR Code não pertence ao Tatame.");
                  return;
                }
                void submit({ qr_token: data });
              }}
            />
          ) : (
            <>
              <Label muted>
                A câmera será usada somente para ler o QR Code.
              </Label>
              <Button onPress={() => void requestPermission()}>
                Permitir câmera
              </Button>
            </>
          )}
          <Button secondary onPress={() => setScanning(false)}>
            Fechar câmera
          </Button>
        </Card>
      )}
      <Label muted>
        Aguarde a confirmação na tela antes de entrar no tatame.
      </Label>
      <Button secondary onPress={() => void logout()}>
        Sair do modo tablet
      </Button>
    </Page>
  );
}
export default function KioskScreen() {
  const { session } = useSession();
  if (session?.kind !== "device") return <Redirect href="/onboarding" />;
  return <Content />;
}
