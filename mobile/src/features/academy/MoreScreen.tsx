import { ResponsiveGrid } from "../../components/ResponsiveGrid";
import { View } from "react-native";
import { router, Href } from "expo-router";
import { Icon, IconName } from "../../components/Icon";
import { accents, Accent } from "../../theme";
import { AcademyShell, RoleGate } from "../shared/AcademyShell";
import { Card, Heading, Label, Button } from "../../components/ui";
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
  const { logout } = useSession();
  return (
    <AcademyShell title="Mais">
      <Heading>Gestão e configurações</Heading>
      <ResponsiveGrid>
        <Shortcut
          title="Assinatura TatameMix"
          description="Seu plano de R$ 450/mês e histórico de pagamentos"
          label="Assinatura TatameMix. Pagar ou renovar o sistema"
          icon="wallet"
          tone="brand"
          onPress={() => router.push("/subscription" as Href)}
        />
        <Shortcut
          title="Matrículas pelo link"
          description="Publique ofertas e confirme acesso a cadastros existentes"
          label="Matrículas pelo link da academia"
          icon="users"
          tone="mint"
          onPress={() => router.push("/enrollment-settings")}
        />

        <Shortcut
          title="Gestores"
          description="Pessoas que administram esta academia"
          label="Gestores. Adicionar pessoas à gestão da academia"
          icon="users"
          tone="brand"
          onPress={() => router.push("/managers")}
        />
        <Shortcut
          title="Minha participação"
          description="Meu número, QR e histórico de presenças"
          label="Minha participação. Meu número e minhas presenças"
          icon="users"
          tone="mint"
          onPress={() => router.push("/participation")}
        />
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
        <Shortcut
          title="Nova academia"
          description="Cadastre outra unidade com alunos e financeiro próprios"
          label="Nova academia. Cadastrar outra unidade"
          icon="plus"
          tone="blue"
          onPress={() => router.push("/create-academy")}
        />
        <Shortcut
          title="Recebimentos"
          description="Conectar InfinitePay e receber mensalidades"
          label="Recebimentos. Configurar conta de pagamento"
          icon="wallet"
          tone="mint"
          onPress={() => router.push("/receipts")}
        />
      </ResponsiveGrid>
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
