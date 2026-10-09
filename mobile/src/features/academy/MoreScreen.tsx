import { useState } from "react";
import { router } from "expo-router";
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
  Field,
  Empty,
  Loading,
} from "../../components/ui";
import { Device } from "../../types";
function Content() {
  const { academy, activateDevice, logout } = useSession();
  const a = academy!;
  const [name, setName] = useState("Tablet do tatame");
  const devices = useQuery({
    queryKey: ["devices", a.id],
    queryFn: () => api<Device[]>(academyPath(a.id, "/devices")),
  });
  const bank = useQuery({
    queryKey: ["bank", a.id],
    queryFn: () =>
      api<{ connected: boolean; environment: string }>(
        academyPath(a.id, "/payment-integration"),
      ),
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
    mutationFn: (id: string) =>
      api(academyPath(a.id, "/devices/" + id), { method: "DELETE" }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["devices", a.id] }),
  });
  return (
    <AcademyShell title="Mais">
      <Button secondary onPress={() => router.push("/catalog")}>
        Modalidades e planos
      </Button>
      <Button secondary onPress={() => router.push("/academy-history")}>
        Histórico da academia
      </Button>
      <Card>
        <Heading>Pagamentos Pix • Asaas</Heading>
        {bank.isPending ? (
          <Loading />
        ) : (
          <Label>
            {bank.data?.connected
              ? bank.data.environment === "production"
                ? "Integração ativa"
                : "Integração em ambiente de teste"
              : "Pagamentos ainda não habilitados"}
          </Label>
        )}
        <Notice message={bank.error?.message} />
      </Card>
      <Card>
        <Heading>Modo tablet</Heading>
        <Label muted>
          Este aparelho usará uma credencial própria. Para voltar à gestão,
          entre novamente na sua conta.
        </Label>
        <Field label="Nome do aparelho" value={name} onChangeText={setName} />
        <Notice message={activate.error?.message} />
        <Button loading={activate.isPending} onPress={() => activate.mutate()}>
          Ativar check-in neste aparelho
        </Button>
      </Card>
      <Heading>Tablets autorizados</Heading>
      <Notice message={devices.error?.message || revoke.error?.message} />
      {devices.isPending ? (
        <Loading />
      ) : devices.data?.length ? (
        devices.data.map((d) => (
          <Card key={d.id}>
            <Heading>{d.name}</Heading>
            <Label muted>{d.active ? "Autorizado" : "Revogado"}</Label>
            {d.active ? (
              <Button
                secondary
                disabled={revoke.isPending}
                onPress={() => revoke.mutate(d.id)}
              >
                Desautorizar tablet
              </Button>
            ) : null}
          </Card>
        ))
      ) : (
        <Empty>Nenhum dispositivo cadastrado.</Empty>
      )}
      <Button secondary onPress={() => void logout()}>
        Sair da conta
      </Button>
    </AcademyShell>
  );
}
export default function MoreScreen() {
  return (
    <RoleGate role="admin">
      <Content />
    </RoleGate>
  );
}
