import { View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Icon, IconName } from "../../components/Icon";
import { accents, Accent } from "../../theme";
import { AcademyShell, RoleGate } from "../shared/AcademyShell";
import {
  Card,
  Heading,
  Label,
  Button,
  Notice,
  Loading,
  Badge,
} from "../../components/ui";
import { api, academyPath } from "../../services/api";
import { useSession } from "../../services/session";

function Shortcut({
  title,
  description,
  label,
  icon,
  tone,
  onPress,
}: {
  title: string;
  description: string;
  label: string;
  icon: IconName;
  tone: Accent;
  onPress: () => void;
}) {
  const accent = accents[tone];
  return (
    <Card onPress={onPress} accessibilityLabel={label}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View
          style={{
            backgroundColor: accent.soft,
            padding: 12,
            borderRadius: 14,
          }}
        >
          <Icon name={icon} color={accent.color} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Heading>{title}</Heading>
          <Label muted>{description}</Label>
        </View>
        <Icon name="chevron-right" size={18} color={accent.color} />
      </View>
    </Card>
  );
}
function Content() {
  const { academy, logout } = useSession(),
    a = academy!;
  const bank = useQuery({
    queryKey: ["bank", a.id],
    queryFn: () =>
      api<{ connected: boolean; environment: string }>(
        academyPath(a.id, "/payment-integration"),
      ),
  });
  return (
    <AcademyShell title="Mais">
      <Shortcut
        title="Modalidades e planos"
        description="Valores, pacotes e graduações"
        label="Modalidades e planos. Configurar valores e graduações"
        icon="sliders"
        tone="lavender"
        onPress={() => router.push("/catalog")}
      />
      <Shortcut
        title="Histórico da academia"
        description="Acompanhe os treinos dos alunos"
        label="Histórico da academia. Consultar presenças"
        icon="check-circle"
        tone="blue"
        onPress={() => router.push("/academy-history")}
      />
      <Shortcut
        title="Check-in da academia"
        description="Prepare o aparelho da recepção e gerencie seus acessos"
        label="Check-in da academia. Preparar aparelho e gerenciar acessos"
        icon="tablet"
        tone="amber"
        onPress={() => router.push("/devices")}
      />
      <Card>
        <Heading>Pagamentos Pix · Asaas</Heading>
        {bank.isPending ? (
          <Loading />
        ) : (
          <Badge
            label={
              bank.data?.connected
                ? bank.data.environment === "production"
                  ? "Integração ativa"
                  : "Ambiente de teste"
                : "Integração não configurada"
            }
            tone={bank.data?.connected ? "mint" : "amber"}
          />
        )}
        <Notice message={bank.error?.message} />
      </Card>
      <View style={{ alignItems: "flex-start" }}>
        <Button compact secondary onPress={() => void logout()}>
          Sair da conta
        </Button>
      </View>
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
