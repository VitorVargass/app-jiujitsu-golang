import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
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
import { cpfDigits, formatCPF, validCPF } from "../../types/cpf";
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
  const [exit, setExit] = useState(false),
    [exiting, setExiting] = useState(false),
    [exitError, setExitError] = useState("");
  const [legacyCode, setLegacyCode] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const submitting = useRef(false);
  const event = useRef<{
    sessionId: string;
    body: { qr_token?: string; student_code?: string; cpf?: string };
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
    body: { qr_token?: string; student_code?: string; cpf?: string },
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
        <Empty>Nenhuma aula aberta. Peça ao gestor para abrir a aula.</Empty>
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
            label={legacyCode ? "Código anterior do aluno" : "CPF do aluno"}
            editable={!checkin.isPending}
            value={code}
            onChangeText={(v) => {
              setCode(legacyCode ? v.replace(/[^0-9]/g, "") : formatCPF(v));
              checkin.reset();
            }}
            keyboardType="number-pad"
            maxLength={legacyCode ? 8 : 14}
            placeholder={legacyCode ? "Digite os 8 números" : "000.000.000-00"}
          />
          <Button
            disabled={
              !active || (legacyCode ? code.length !== 8 : !validCPF(code))
            }
            loading={checkin.isPending}
            onPress={() =>
              void submit(
                legacyCode ? { student_code: code } : { cpf: cpfDigits(code) },
              )
            }
          >
            Confirmar presença
          </Button>
          <Button
            compact
            secondary
            disabled={checkin.isPending}
            onPress={() => {
              setLegacyCode(!legacyCode);
              setCode("");
              checkin.reset();
              event.current = null;
            }}
          >
            {legacyCode ? "Usar CPF" : "Cadastro antigo? Usar código anterior"}
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
      <Label muted>
        Para voltar à gestão, encerre este acesso e entre novamente na sua
        conta.
      </Label>
      <Button
        secondary
        onPress={() => {
          setExitError("");
          setExit(true);
        }}
      >
        Encerrar check-in e sair
      </Button>
      <ConfirmDialog
        visible={exit}
        title="Encerrar este check-in?"
        message="Este aparelho deixará de registrar presenças com este acesso. Para voltar à gestão ou ativá-lo novamente, entre na sua conta."
        confirmLabel="Encerrar e sair"
        pending={exiting}
        error={exitError}
        onCancel={() => setExit(false)}
        onConfirm={() => {
          setExiting(true);
          void logout()
            .catch((error: Error) => setExitError(error.message))
            .finally(() => setExiting(false));
        }}
      />
    </Page>
  );
}
export default function KioskScreen() {
  const { session } = useSession();
  if (session?.kind !== "device") return <Redirect href="/onboarding" />;
  return <Content />;
}
