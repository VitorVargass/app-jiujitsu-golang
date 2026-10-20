import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Redirect } from "expo-router";
import * as Crypto from "expo-crypto";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Brand } from "../../components/Brand";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { EditorDialog } from "../../components/EditorDialog";
import { Icon } from "../../components/Icon";
import {
  Button,
  Card,
  Field,
  IconButton,
  Label,
  Loading,
  Notice,
  Page,
} from "../../components/ui";
import { api, academyPath, APIError } from "../../services/api";
import { useSession } from "../../services/session";
import { AttendanceOptions, CheckinResult } from "../../types";
import { cpfDigits, formatCPF, validCPF } from "../../types/cpf";
import { colors, accents, displayTime } from "../../theme";
import { KioskCamera } from "./KioskCamera";
import { KioskLessonPicker, KioskSuccess } from "./KioskPanels";

function Content() {
  const { session, logout } = useSession();
  const device = session! as Extract<
    NonNullable<typeof session>,
    { kind: "device" }
  >;
  const { width } = useWindowDimensions();
  const [code, setCode] = useState(""),
    [selected, setSelected] = useState("");
  const [scanning, setScanning] = useState(false),
    [settings, setSettings] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const [exit, setExit] = useState(false),
    [exiting, setExiting] = useState(false),
    [exitError, setExitError] = useState("");
  const [legacyCode, setLegacyCode] = useState(false);
  const submitting = useRef(false);
  const event = useRef<{
    body: {
      qr_token?: string;
      student_code?: string;
      cpf?: string;
      schedule_id: string;
      date: string;
    };
    key: string;
  } | null>(null);
  const sessions = useQuery({
    queryKey: ["kiosk-lessons", device.academy_id],
    queryFn: () =>
      api<AttendanceOptions>(
        academyPath(device.academy_id, "/attendance-options"),
      ),
    refetchInterval: 5000,
  });
  const options = sessions.data?.options ?? [];
  const zone = sessions.data?.timezone ?? "America/Sao_Paulo";
  const active =
    options.length === 1
      ? options[0]
      : options.find((lesson) => lesson.schedule_id + lesson.date === selected);
  const checkin = useMutation({
    mutationFn: () => {
      const attempt = event.current!;
      return api<CheckinResult>(academyPath(device.academy_id, "/check-ins"), {
        method: "POST",
        body: attempt.body,
        key: attempt.key,
      });
    },
  });
  const { isSuccess, reset: resetCheckin } = checkin;
  const clearCheckin = useCallback(() => {
    resetCheckin();
    event.current = null;
    setCode("");
    setLegacyCode(false);
  }, [resetCheckin]);
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!isSuccess) return;
    const timer = setTimeout(clearCheckin, 3500);
    return () => clearTimeout(timer);
  }, [isSuccess, clearCheckin]);
  async function submit(
    body: { qr_token?: string; student_code?: string; cpf?: string },
    retry = false,
  ) {
    if ((!retry && !active) || submitting.current) return;
    submitting.current = true;
    setScanning(false);
    if (!retry && active) {
      const payload = {
        ...body,
        schedule_id: active.schedule_id,
        date: active.date,
      };
      if (
        !event.current ||
        JSON.stringify(event.current.body) !== JSON.stringify(payload)
      )
        event.current = { body: payload, key: Crypto.randomUUID() };
    }
    if (!event.current) {
      submitting.current = false;
      return;
    }
    try {
      await checkin.mutateAsync();
    } catch {
      /* Only a successful API response confirms attendance. */
    } finally {
      submitting.current = false;
    }
  }
  const retry = checkin.error instanceof APIError && checkin.error.status === 0;
  const valid = legacyCode ? code.length === 8 : validCPF(code);
  const canSubmit = retry || (!!active && valid);
  function confirm() {
    if (!canSubmit || checkin.isPending) return;
    if (retry && event.current) void submit(event.current.body, true);
    else
      void submit(
        legacyCode ? { student_code: code } : { cpf: cpfDigits(code) },
      );
  }
  return (
    <Page
      wide
      header={
        <View style={s.header}>
          <Brand compact />
          <View style={s.headerActions}>
            <View style={s.clock}>
              <Text style={s.time}>
                {displayTime(clock.toISOString(), zone)}
              </Text>
              <Text style={s.date}>
                {new Intl.DateTimeFormat("pt-BR", {
                  timeZone: zone,
                  day: "2-digit",
                  month: "short",
                }).format(clock)}
              </Text>
            </View>
            <IconButton
              icon="more"
              label="Opções do check-in"
              disabled={checkin.isPending}
              expanded={settings}
              onPress={() => setSettings(true)}
            />
          </View>
        </View>
      }
    >
      <View style={s.container}>
        <View style={s.intro}>
          <Text style={s.academy}>{device.academy_name}</Text>
          <Text accessibilityRole="header" style={s.title}>
            Check-in
          </Text>
          <Text style={s.description}>Sua presença, em poucos segundos.</Text>
        </View>
        <Card
          style={[
            s.card,
            width < 480 && s.smallCard,
            checkin.isSuccess && s.successCard,
          ]}
        >
          {checkin.isSuccess && checkin.data ? (
            <KioskSuccess
              result={checkin.data}
              timezone={zone}
              onNext={clearCheckin}
            />
          ) : (
            <>
              {sessions.isPending ? (
                <View style={s.state}>
                  <Loading />
                  <Text style={s.hint}>Buscando os horários da academia…</Text>
                </View>
              ) : sessions.error ? (
                <View style={s.state}>
                  <View style={s.stateIcon}>
                    <Icon name="calendar" color={colors.muted} size={24} />
                  </View>
                  <Text style={s.stateTitle}>
                    Não foi possível consultar as aulas
                  </Text>
                  <Notice message={sessions.error.message} />
                  <Button
                    compact
                    secondary
                    loading={sessions.isFetching}
                    onPress={() => void sessions.refetch()}
                  >
                    Tentar carregar horários
                  </Button>
                </View>
              ) : !options.length ? (
                <View style={s.state}>
                  <View style={s.stateIcon}>
                    <Icon name="calendar" color={colors.muted} size={24} />
                  </View>
                  <Text style={s.stateTitle}>Nenhuma aula neste horário</Text>
                  <Text style={s.description}>
                    Os horários são identificados pela grade da academia.
                    Confira sua aula com a recepção.
                  </Text>
                  <Button
                    compact
                    secondary
                    loading={sessions.isFetching}
                    onPress={() => void sessions.refetch()}
                  >
                    Atualizar horários
                  </Button>
                </View>
              ) : (
                <KioskLessonPicker
                  options={options}
                  active={active}
                  timezone={zone}
                  disabled={checkin.isPending}
                  onSelect={(lesson) => {
                    if (submitting.current) return;
                    setSelected(lesson.schedule_id + lesson.date);
                    checkin.reset();
                    event.current = null;
                  }}
                />
              )}
              {options.length > 0 || retry ? (
                <>
                  <View style={s.identification}>
                    <Field
                      label={legacyCode ? "Código anterior" : "Seu CPF"}
                      editable={!checkin.isPending}
                      value={code}
                      onChangeText={(value) => {
                        setCode(
                          legacyCode
                            ? value.replace(/[^0-9]/g, "")
                            : formatCPF(value),
                        );
                        checkin.reset();
                      }}
                      keyboardType="number-pad"
                      maxLength={legacyCode ? 8 : 14}
                      placeholder={legacyCode ? "8 números" : "000.000.000-00"}
                      style={[
                        s.input,
                        width < 380 && { fontSize: 22, letterSpacing: 0.5 },
                      ]}
                      returnKeyType="done"
                      onSubmitEditing={confirm}
                    />
                    {!legacyCode && cpfDigits(code).length === 11 && !valid ? (
                      <Text style={s.invalid}>Confira os números do CPF.</Text>
                    ) : null}
                    <Button
                      icon="check-circle"
                      disabled={!canSubmit}
                      loading={checkin.isPending}
                      onPress={confirm}
                    >
                      {retry ? "Tentar novamente" : "Confirmar presença"}
                    </Button>
                    <Notice message={checkin.error?.message} />
                  </View>
                  <View style={s.divider}>
                    <View style={s.line} />
                    <Text style={s.or}>ou</Text>
                    <View style={s.line} />
                  </View>
                  <Button
                    secondary
                    icon="qr"
                    disabled={!active || checkin.isPending}
                    onPress={() => {
                      checkin.reset();
                      setScanning(true);
                    }}
                  >
                    Escanear QR Code
                  </Button>
                </>
              ) : null}
            </>
          )}
        </Card>
        {!checkin.isSuccess ? (
          <Text style={s.footerNote}>
            Aguarde a confirmação na tela antes de iniciar o treino.
          </Text>
        ) : null}
      </View>
      {scanning ? (
        <KioskCamera
          disabled={!active || checkin.isPending}
          onRead={(data) => void submit({ qr_token: data })}
          onClose={() => setScanning(false)}
        />
      ) : null}
      {settings ? (
        <EditorDialog
          title="Opções do check-in"
          onClose={() => setSettings(false)}
        >
          <Label>{device.academy_name}</Label>
          <View style={s.menu}>
            <MenuItem
              icon="calendar"
              title="Atualizar horários"
              detail="Consultar a grade da academia"
              onPress={() => {
                setSettings(false);
                void sessions.refetch();
              }}
            />
            <MenuItem
              icon="qr"
              title={legacyCode ? "Usar CPF" : "Usar código anterior"}
              detail={
                legacyCode
                  ? "Voltar à identificação por CPF"
                  : "Para cadastros que ainda usam 8 números"
              }
              onPress={() => {
                setLegacyCode(!legacyCode);
                setCode("");
                checkin.reset();
                event.current = null;
                setSettings(false);
              }}
            />
            <MenuItem
              icon="lock"
              title="Encerrar check-in"
              detail="Sair deste acesso e voltar ao login"
              danger
              onPress={() => {
                setExitError("");
                setSettings(false);
                setExit(true);
              }}
            />
          </View>
        </EditorDialog>
      ) : null}
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
function MenuItem({
  icon,
  title,
  detail,
  onPress,
  danger = false,
}: {
  icon: "calendar" | "qr" | "lock";
  title: string;
  detail: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [s.menuItem, pressed && { opacity: 0.65 }]}
    >
      <Icon
        name={icon}
        size={20}
        color={danger ? colors.danger : colors.muted}
      />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={[s.menuTitle, danger && { color: colors.danger }]}>
          {title}
        </Text>
        <Text style={s.hint}>{detail}</Text>
      </View>
      <Icon name="chevron-right" size={15} color={colors.muted} />
    </Pressable>
  );
}
export default function KioskScreen() {
  const { session } = useSession();
  if (session?.kind !== "device") return <Redirect href="/entry" />;
  return <Content />;
}
const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  clock: { alignItems: "flex-end", gap: 3 },
  time: { color: colors.text, fontFamily: "Inter_600SemiBold", fontSize: 18 },
  date: { color: colors.muted, fontFamily: "Inter_400Regular", fontSize: 10 },
  container: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    gap: 22,
    paddingTop: 12,
  },
  intro: { alignItems: "center", gap: 10, paddingBottom: 2 },
  academy: {
    fontFamily: "Inter_600SemiBold",
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  title: {
    fontFamily: "Inter_700Bold",
    color: colors.text,
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: -1,
  },
  description: {
    fontFamily: "Inter_400Regular",
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  card: { padding: 28, gap: 24, borderRadius: 22 },
  smallCard: { padding: 20, gap: 22 },
  successCard: { borderColor: accents.mint.border },
  identification: { gap: 16 },
  input: {
    fontSize: 30,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    letterSpacing: 1,
    minHeight: 68,
    backgroundColor: colors.background,
  },
  invalid: {
    fontFamily: "Inter_400Regular",
    color: colors.danger,
    fontSize: 12,
    lineHeight: 18,
  },
  divider: { flexDirection: "row", alignItems: "center", gap: 12 },
  line: { height: 1, flex: 1, backgroundColor: colors.borderSubtle },
  or: { fontFamily: "Inter_400Regular", color: colors.muted, fontSize: 12 },
  footerNote: {
    fontFamily: "Inter_400Regular",
    color: colors.muted,
    fontSize: 12,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: 18,
  },
  state: { alignItems: "center", gap: 16, paddingVertical: 18 },
  stateIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  },
  stateTitle: {
    fontFamily: "Inter_600SemiBold",
    color: colors.text,
    fontSize: 18,
    lineHeight: 25,
    textAlign: "center",
  },
  hint: {
    fontFamily: "Inter_400Regular",
    color: colors.muted,
    fontSize: 12,
    lineHeight: 19,
  },
  menu: { gap: 8 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 72,
    paddingVertical: 10,
  },
  menuTitle: {
    fontFamily: "Inter_600SemiBold",
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
});
