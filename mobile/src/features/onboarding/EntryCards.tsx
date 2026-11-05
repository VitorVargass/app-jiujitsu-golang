import { useState } from "react";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Badge, Button, Card, Heading, Label } from "../../components/ui";
import { ResponsiveGrid } from "../../components/ResponsiveGrid";
import { Icon } from "../../components/Icon";
import { colors } from "../../theme";

export function EntryWelcome({ name }: { name: string }) {
  return (
    <Card style={s.welcome}>
      <View style={s.between}>
        <Text style={s.eyebrow}>SEU PONTO DE PARTIDA</Text>
        <Badge label="Conta criada" tone="mint" />
      </View>
      <View style={s.welcomeRow}>
        <View style={{ flex: 1, gap: 10 }}>
          <Text style={s.welcomeTitle}>Bem-vindo, {name}.</Text>
          <Text style={s.welcomeCopy}>
            Sua conta está pronta. Agora escolha como quer fazer parte do
            TatameMix.
          </Text>
        </View>
        <View style={s.welcomeIcon}>
          <Icon name="home" size={29} color={colors.primaryLight} />
        </View>
      </View>
      <View style={s.milestones}>
        <View style={s.milestone}>
          <Icon name="check-circle" size={16} color="#89D2A6" />
          <Text style={s.milestoneText}>Sua conta</Text>
        </View>
        <View style={s.connector} />
        <View style={s.milestone}>
          <View style={s.currentDot} />
          <Text style={s.milestoneText}>Seu acesso à academia</Text>
        </View>
      </View>
    </Card>
  );
}

export function EntryActionCards({ canCreate }: { canCreate: boolean }) {
  const [choice, setChoice] = useState<"student" | "admin" | null>(null);
  if (!choice)
    return (
      <View style={{ gap: 18 }}>
        <View style={{ gap: 6 }}>
          <Heading>Como você quer começar?</Heading>
          <Label muted>
            Escolha seu caminho. Você pode voltar e trocar a opção.
          </Label>
        </View>
        <ResponsiveGrid>
          <Card
            onPress={() => setChoice("student")}
            accessibilityLabel="Sou aluno ou responsável. Ver como acessar minha academia"
            style={s.studentCard}
          >
            <View style={s.between}>
              <View
                style={[
                  s.icon,
                  { backgroundColor: "#20252E", borderColor: "#3B4654" },
                ]}
              >
                <Icon name="users" size={26} color="#B4C4DA" />
              </View>
              <Text style={s.eyebrow}>PARA QUEM TREINA</Text>
            </View>
            <Text style={s.actionTitle}>Sou aluno</Text>
            <Label muted>
              Ou responsável por um aluno. Quero acessar minha academia,
              mensalidades e presenças.
            </Label>
            <View
              style={[
                s.between,
                {
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  paddingTop: 17,
                },
              ]}
            >
              <Text
                style={{
                  color: "#B4C4DA",
                  fontSize: 12,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                Acessar minha academia
              </Text>
              <Icon name="arrow-right" size={20} color="#B4C4DA" />
            </View>
          </Card>
          {canCreate ? (
            <Card
              onPress={() => setChoice("admin")}
              accessibilityLabel="Sou gestor. Ver como criar e gerenciar uma academia"
              style={s.managerCard}
            >
              <View style={s.between}>
                <View style={s.icon}>
                  <Icon name="sliders" size={26} color={colors.primaryLight} />
                </View>
                <Text style={s.eyebrow}>PARA QUEM GERENCIA</Text>
              </View>
              <Text style={s.actionTitle}>Sou gestor</Text>
              <Label muted>
                Quero criar minha academia e organizar alunos, turmas, equipe e
                financeiro.
              </Label>
              <View
                style={[
                  s.between,
                  {
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    paddingTop: 17,
                  },
                ]}
              >
                <Text
                  style={{
                    color: colors.primaryLight,
                    fontSize: 12,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  Preparar minha academia
                </Text>
                <Icon
                  name="arrow-right"
                  size={20}
                  color={colors.primaryLight}
                />
              </View>
            </Card>
          ) : null}
        </ResponsiveGrid>
      </View>
    );
  return (
    <View style={{ gap: 18 }}>
      <View style={s.between}>
        <Heading>
          {choice === "student"
            ? "Seu acesso como aluno"
            : "Sua academia no TatameMix"}
        </Heading>
        <Button
          secondary
          compact
          icon="chevron-left"
          onPress={() => setChoice(null)}
        >
          Trocar opção
        </Button>
      </View>
      {choice === "student" ? (
        <Card style={s.studentCard}>
          <View style={s.between}>
            <View
              style={[
                s.icon,
                { backgroundColor: "#20252E", borderColor: "#3B4654" },
              ]}
            >
              <Icon name="users" size={24} color="#B4C4DA" />
            </View>
            <Badge label="Aluno ou responsável" tone="blue" />
          </View>
          <Text style={s.actionTitle}>Conecte sua conta à academia</Text>
          <Label muted>
            Peça o link de matrícula ou convite ao responsável pela academia.
            Não precisa criar outra conta nem contratar um plano TatameMix.
          </Label>
          <View style={s.steps}>
            <Text style={s.stepText}>01 Receba o link da sua academia</Text>
            <Text style={s.stepText}>
              02 Abra o link e entre com esta mesma conta
            </Text>
            <Text style={s.stepText}>
              03 Conclua ou acompanhe sua matrícula
            </Text>
          </View>
          <Button
            icon="chevron-right"
            onPress={() => router.push("/enrollment-status")}
          >
            Minhas matrículas e pedidos
          </Button>
          <Text style={s.note}>
            Já recebeu o link? Abra-o no navegador. Após a liberação pela
            academia, seu acesso aparece aqui.
          </Text>
        </Card>
      ) : (
        <Card style={s.managerCard}>
          <View style={s.between}>
            <View style={s.icon}>
              <Icon name="sliders" size={24} color={colors.primaryLight} />
            </View>
            <Badge label="5 dias grátis" tone="brand" />
          </View>
          <Text style={s.actionTitle}>Prepare o espaço da sua academia</Text>
          <Label muted>
            Na próxima etapa, informe o nome e escolha o plano. Depois você
            cadastra alunos, turmas e equipe.
          </Label>
          <View style={s.fact}>
            <Icon name="check-circle" size={16} color={colors.primaryLight} />
            <Text style={s.factText}>
              Planos a partir de R$ 150/mês, após os 5 dias grátis.
            </Text>
          </View>
          <Button
            icon="arrow-right"
            onPress={() => router.push("/create-academy")}
          >
            Criar minha academia
          </Button>
          <Text style={s.note}>
            Sem débito automático. Cada academia tem sua própria assinatura.
          </Text>
        </Card>
      )}
    </View>
  );
}

export function EntryHelp({
  reload,
  refreshing = false,
}: {
  reload: () => void;
  refreshing?: boolean;
}) {
  return (
    <Card style={s.help}>
      <View style={s.helpCopy}>
        <View style={s.helpIcon}>
          <Icon name="swap" size={20} color={colors.muted} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Heading>Seu acesso não apareceu?</Heading>
          <Text style={s.factText}>
            Se a academia acabou de liberar seu perfil, atualize para conferir.
          </Text>
        </View>
      </View>
      <Button
        secondary
        compact
        icon="swap"
        disabled={refreshing}
        onPress={reload}
      >
        Atualizar acessos
      </Button>
    </Card>
  );
}

const s = StyleSheet.create({
  welcome: {
    padding: 28,
    gap: 24,
    borderColor: "#59303A",
    backgroundColor: "#1D181D",
  },
  between: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 14,
  },
  eyebrow: {
    color: colors.muted,
    fontFamily: "Inter_600SemiBold",
    fontSize: 8,
    letterSpacing: 1.4,
  },
  welcomeRow: { flexDirection: "row", alignItems: "center", gap: 18 },
  welcomeTitle: {
    color: colors.text,
    fontFamily: "Inter_700Bold",
    fontSize: 29,
    lineHeight: 37,
    letterSpacing: -0.9,
  },
  welcomeCopy: {
    color: colors.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 22,
    maxWidth: 540,
  },
  welcomeIcon: {
    width: 62,
    height: 62,
    backgroundColor: "#352129",
    borderWidth: 1,
    borderColor: "#633039",
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  milestones: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: "#3D2B33",
    paddingTop: 19,
  },
  milestone: { flexDirection: "row", alignItems: "center", gap: 8 },
  milestoneText: {
    color: colors.text,
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  connector: { width: 35, height: 1, backgroundColor: "#54414A" },
  currentDot: {
    width: 8,
    height: 8,
    backgroundColor: colors.primaryLight,
    borderRadius: 4,
  },
  managerCard: { padding: 25, gap: 22, borderRadius: 16 },
  studentCard: { padding: 25, gap: 22, borderRadius: 16 },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 13,
    backgroundColor: "#2D171B",
    borderWidth: 1,
    borderColor: "#633039",
    alignItems: "center",
    justifyContent: "center",
  },
  actionTitle: {
    color: colors.text,
    fontSize: 21,
    lineHeight: 29,
    letterSpacing: -0.5,
    fontFamily: "Inter_600SemiBold",
  },
  fact: { flexDirection: "row", gap: 8, alignItems: "center" },
  factText: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    flexShrink: 1,
  },
  note: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 17,
    fontFamily: "Inter_400Regular",
  },
  steps: {
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#202126",
    borderRadius: 9,
  },
  stepText: {
    color: "#B4C4DA",
    fontSize: 11,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
  },
  help: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
    padding: 22,
  },
  helpCopy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexGrow: 1,
    flexBasis: "60%",
    minWidth: 190,
  },
  helpIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
});
