import { useState } from "react";
import { brand } from "../../theme/brand";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AcademyShell, RoleGate } from "../shared/AcademyShell";
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Heading,
  Label,
  Loading,
  Notice,
} from "../../components/ui";
import { Icon } from "../../components/Icon";
import { EditorDialog } from "../../components/EditorDialog";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { api, academyPath } from "../../services/api";
import { queryClient, useSession } from "../../services/session";
import { Device } from "../../types";
import { accents, colors } from "../../theme";

function Content() {
  const { academy, activateDevice } = useSession(),
    a = academy!;
  const [name, setName] = useState("Recepção principal"),
    [preparing, setPreparing] = useState(false),
    [history, setHistory] = useState(false);
  const [help, setHelp] = useState(false);
  const [revoking, setRevoking] = useState<Device | null>(null),
    [message, setMessage] = useState("");
  const devices = useQuery({
    queryKey: ["devices", a.id],
    queryFn: () => api<Device[]>(academyPath(a.id, "/devices")),
  });
  const activate = useMutation({
    mutationFn: async () => {
      const d = await api<{ id: string; token: string }>(
        academyPath(a.id, "/devices"),
        { method: "POST", body: { name } },
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
  const revoke = useMutation({
    mutationFn: (d: Device) =>
      api(academyPath(a.id, "/devices/" + d.id), { method: "DELETE" }),
    onSuccess: () => {
      setRevoking(null);
      setMessage(
        "Acesso encerrado. Esse aparelho precisa ser ativado novamente para registrar presenças.",
      );
      void queryClient.invalidateQueries({ queryKey: ["devices", a.id] });
    },
  });
  const active = devices.data?.filter((d) => d.active) ?? [],
    ended = devices.data?.filter((d) => !d.active) ?? [];
  const visible = history ? ended : active;
  return (
    <AcademyShell
      title="Check-in"
      subtitle="Prepare o aparelho que ficará na recepção."
      titleAction={
        <Button
          compact
          secondary
          icon="chevron-left"
          onPress={() => router.replace("/more")}
        >
          Mais
        </Button>
      }
      swipeEnabled={!preparing && !revoking}
    >
      <Card style={{ borderColor: accents.amber.border }}>
        <View style={s.heading}>
          <View style={s.icon}>
            <Icon name="tablet" size={24} color={accents.amber.color} />
          </View>
          <View style={{ flex: 1, gap: 5 }}>
            <Heading>Um aparelho para a presença</Heading>
            <Label muted>Alunos digitam seus 5 números ou mostram o QR.</Label>
          </View>
        </View>
        <Label>
          O modo check-in identifica as aulas pela agenda e confirma a presença
          dos alunos. O aparelho fica sem acesso à gestão e ao financeiro.
        </Label>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: help }}
          onPress={() => setHelp(!help)}
          style={{
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 13,
              color: accents.amber.color,
            }}
          >
            {help ? "Ocultar passo a passo" : "Como configurar o aparelho?"}
          </Text>
          <Icon name="chevron-right" size={14} color={accents.amber.color} />
        </Pressable>
        {help ? (
          <View style={s.steps}>
            {[
              "No aparelho da recepção, abra o " +
                brand.name +
                " e entre como gestor.",
              "Nesta tela, toque em Preparar este aparelho e dê um nome a ele.",
              "Ative o check-in. A aula será identificada pelo horário; se houver mais de uma, o aluno escolhe.",
            ].map((text, i) => (
              <View key={text} style={s.step}>
                <Text style={s.number}>{i + 1}</Text>
                <Text style={s.stepText}>{text}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={{ alignItems: "flex-start" }}>
          <Button
            compact
            icon="tablet"
            onPress={() => {
              activate.reset();
              setPreparing(true);
            }}
          >
            Preparar este aparelho
          </Button>
        </View>
        <Label muted>
          Está no computador da gestão? Faça esses passos no tablet, celular ou
          computador que ficará para os alunos.
        </Label>
      </Card>
      <View style={{ gap: 8 }}>
        <Heading>Acessos de check-in</Heading>
        <Label muted>
          Cada ativação cria um acesso. Autorizado significa que ele pode
          registrar presença; não indica que o aparelho esteja ligado ou
          conectado agora.
        </Label>
      </View>
      <View style={s.tabs}>
        {[
          [false, "Autorizados", active.length],
          [true, "Encerrados", ended.length],
        ].map(([value, label, count]) => (
          <Pressable
            key={String(value)}
            accessibilityRole="tab"
            accessibilityLabel={String(label)}
            accessibilityState={{ selected: history === value }}
            onPress={() => setHistory(Boolean(value))}
            style={[s.tab, history === value && s.selected]}
          >
            <Text
              style={[
                s.tabText,
                history === value && { color: accents.amber.color },
              ]}
            >
              {label} · {count}
            </Text>
          </Pressable>
        ))}
      </View>
      <Notice success message={message} />
      {devices.isPending ? (
        <Loading />
      ) : devices.error ? (
        <Notice message={devices.error.message} />
      ) : visible.length ? (
        <View style={s.list}>
          {visible.map((d, i) => (
            <View key={d.id} style={[s.device, i > 0 && s.divider]}>
              <Icon
                name="tablet"
                color={d.active ? accents.amber.color : colors.muted}
              />
              <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
                <Text style={s.deviceName}>{d.name}</Text>
                <Text style={s.date}>
                  {d.created_at
                    ? "Ativado em " +
                      new Intl.DateTimeFormat("pt-BR", {
                        timeZone: a.timezone,
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(d.created_at))
                    : "Acesso anterior"}
                </Text>
                <Badge
                  label={d.active ? "Autorizado" : "Encerrado"}
                  tone={d.active ? "mint" : "amber"}
                />
              </View>
              {d.active ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={"Encerrar acesso de " + d.name}
                  onPress={() => {
                    revoke.reset();
                    setRevoking(d);
                  }}
                  style={s.stop}
                >
                  <Icon name="close" size={18} color={colors.danger} />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <Empty>
          {history
            ? "Nenhum acesso encerrado."
            : "Nenhum aparelho autorizado. Prepare o aparelho da recepção para começar."}
        </Empty>
      )}
      <Label muted>
        Para trocar o aparelho, encerre o acesso antigo e ative o novo. As
        presenças registradas ficam no histórico da academia.
      </Label>
      {preparing ? (
        <EditorDialog
          title="Ativar check-in neste aparelho"
          pending={activate.isPending}
          onClose={() => setPreparing(false)}
          footer={
            <>
              <Button
                compact
                secondary
                disabled={activate.isPending}
                onPress={() => setPreparing(false)}
              >
                Cancelar
              </Button>
              <Button
                compact
                disabled={name.trim().length < 2}
                loading={activate.isPending}
                onPress={() => activate.mutate()}
              >
                Ativar check-in
              </Button>
            </>
          }
        >
          <Label>
            Este aparelho sairá da gestão e passará a mostrar somente o
            check-in. Para voltar à gestão, será necessário entrar novamente na
            sua conta.
          </Label>
          <Field
            label="Nome do aparelho"
            value={name}
            onChangeText={setName}
            placeholder="Ex.: Recepção principal"
            maxLength={80}
            editable={!activate.isPending}
          />
          {Platform.OS === "web" ? (
            <Label muted>
              No navegador, use uma aba dedicada. Fechar a aba pode exigir uma
              nova ativação. Use Encerrar check-in e sair para finalizar o
              acesso.
            </Label>
          ) : null}
          <Notice message={activate.error?.message} />
        </EditorDialog>
      ) : null}
      <ConfirmDialog
        visible={!!revoking}
        title={"Encerrar acesso de " + (revoking?.name ?? "aparelho") + "?"}
        message="Esse acesso deixará de registrar presenças. Para usar o aparelho novamente, faça login como gestor e ative o check-in. As presenças anteriores serão mantidas."
        confirmLabel="Encerrar acesso"
        danger
        pending={revoke.isPending}
        error={revoke.error?.message}
        onCancel={() => setRevoking(null)}
        onConfirm={() => {
          if (revoking) revoke.mutate(revoking);
        }}
      />
    </AcademyShell>
  );
}
export default function DevicesScreen() {
  return (
    <RoleGate role="admin">
      <Content />
    </RoleGate>
  );
}
const s = StyleSheet.create({
  heading: { flexDirection: "row", alignItems: "center", gap: 14 },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: accents.amber.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  steps: { gap: 14, paddingVertical: 5 },
  step: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  number: {
    width: 26,
    height: 26,
    lineHeight: 26,
    textAlign: "center",
    borderRadius: 13,
    backgroundColor: accents.amber.soft,
    color: accents.amber.color,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  stepText: {
    flex: 1,
    color: colors.text,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 21,
  },
  tabs: {
    flexDirection: "row",
    gap: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  tab: {
    minHeight: 44,
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  selected: { borderBottomColor: accents.amber.color },
  tabText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: colors.muted,
  },
  list: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  device: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  divider: { borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  deviceName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: colors.text,
  },
  date: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: colors.muted,
    lineHeight: 17,
  },
  stop: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
