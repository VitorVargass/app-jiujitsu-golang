import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import {
  Badge,
  Button,
  Card,
  Heading,
  Label,
  Notice,
} from "../../components/ui";
import { Icon } from "../../components/Icon";
import { ResponsiveGrid } from "../../components/ResponsiveGrid";
import { colors, Accent } from "../../theme";
import { money } from "../../types/billing";
import { privacyContact } from "../legal/content";
import { Subscription, planRange, subscriptionDate } from "./types";

const stateAppearance: Record<
  Subscription["status"],
  { label: string; tone: Accent }
> = {
  trial: { label: "Teste grátis", tone: "blue" },
  active: { label: "Ativa", tone: "mint" },
  grace: { label: "Pagamento pendente", tone: "amber" },
  overdue: { label: "Em atraso", tone: "coral" },
  cancelled: { label: "Encerrada", tone: "slate" },
  disabled: { label: "Cobrança desativada", tone: "slate" },
};

export function SubscriptionSummary({ value: v }: { value: Subscription }) {
  const appearance = stateAppearance[v.status];
  const maximum = v.plan?.max_students;
  const count = v.active_students;
  const percent =
    maximum && count !== undefined
      ? Math.min(100, Math.round((count / maximum) * 100))
      : 0;
  return (
    <Card style={s.summary}>
      <View style={s.between}>
        <Text style={s.eyebrow}>SEU PLANO</Text>
        <Badge label={appearance.label} tone={appearance.tone} />
      </View>
      <View style={s.planHeading}>
        <View style={s.icon}>
          <Icon name="sliders" size={24} color={colors.primaryLight} />
        </View>
        <View style={{ gap: 5, flex: 1 }}>
          <Text style={s.name}>{v.plan?.name ?? "Plano mensal"}</Text>
          <Text style={s.muted}>
            {v.plan ? planRange(v.plan) : "Assinatura da academia"}
          </Text>
        </View>
      </View>
      <View style={s.priceRow}>
        <Text style={s.price}>{money(v.amount_cents)}</Text>
        <Text style={s.muted}>/ mês</Text>
      </View>
      <View style={s.divider} />
      <View style={s.stats}>
        <View style={s.stat}>
          <View style={s.statLabel}>
            <Icon name="users" size={15} color={colors.muted} />
            <Text style={s.muted}>Alunos ativos</Text>
          </View>
          <Text style={s.statValue}>
            {count === undefined ? "—" : count.toLocaleString("pt-BR")}
            {maximum ? (
              <Text style={s.statSuffix}>
                {" "}
                / {maximum.toLocaleString("pt-BR")}
              </Text>
            ) : null}
          </Text>
        </View>
        <View style={s.stat}>
          <View style={s.statLabel}>
            <Icon name="calendar" size={15} color={colors.muted} />
            <Text style={s.muted}>
              {v.status === "trial"
                ? "Teste grátis até"
                : v.status === "active" && !v.renewal_enabled
                  ? "Acesso até"
                  : "Vencimento"}
            </Text>
          </View>
          <Text style={s.date}>
            {subscriptionDate(
              v.status === "trial" ? v.trial_ends_at : v.paid_until,
            )}
          </Text>
        </View>
      </View>
      {maximum && count !== undefined ? (
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Alunos ativos em relação ao limite do plano"
          accessibilityValue={{
            min: 0,
            max: maximum,
            now: Math.min(count, maximum),
            text: `${count} de ${maximum} alunos ativos`,
          }}
          style={s.track}
        >
          <View style={[s.fill, { width: `${percent}%` }]} />
        </View>
      ) : null}
      {maximum && count !== undefined && count >= Math.ceil(maximum * 0.9) ? (
        <Text style={s.warning}>
          Perto da próxima faixa. O reajuste vale na próxima emissão.
        </Text>
      ) : null}
      {v.status === "trial" ? (
        <View style={s.trial}>
          <Icon name="check-circle" size={18} color="#B4C4DA" />
          <Text style={s.trialText}>
            5 dias para conhecer sua academia no TatameMix. Sem débito
            automático.
          </Text>
        </View>
      ) : null}
      {v.status === "trial" ? (
        <Button secondary compact onPress={() => router.replace("/academy")}>
          Continuar meu teste
        </Button>
      ) : null}
      {v.status === "grace" ? (
        <Text style={s.warning}>
          Regularize até {subscriptionDate(v.grace_until)} para manter as
          operações.
        </Text>
      ) : null}
      {v.cycle && v.cycle.amount_cents !== v.amount_cents ? (
        <Notice
          message={`Cobrança já emitida: ${money(v.cycle.amount_cents)}. A nova faixa vale no próximo período ainda sem emissão.`}
        />
      ) : null}
    </Card>
  );
}

export function SubscriptionPlanCards({ value: v }: { value: Subscription }) {
  if (!v.plans?.length) return null;
  return (
    <View style={{ gap: 18 }}>
      <View style={s.between}>
        <Heading>Planos para cada fase</Heading>
        <Text style={s.muted}>Todos os recursos incluídos</Text>
      </View>
      <ResponsiveGrid columns={3}>
        {v.plans.map((plan, i) => {
          const current = v.plan?.id === plan.id;
          return (
            <Card key={plan.id} style={[s.planCard, current && s.currentPlan]}>
              <View style={s.between}>
                <View
                  style={[
                    s.smallIcon,
                    current && { backgroundColor: "#3A1F28" },
                  ]}
                >
                  <Icon
                    name={i === 0 ? "users" : i === 1 ? "home" : "sliders"}
                    size={20}
                    color={current ? colors.primaryLight : colors.muted}
                  />
                </View>
                {current ? (
                  <Badge label="Seu plano atual" tone="brand" />
                ) : (
                  <Text style={s.eyebrow}>0{i + 1}</Text>
                )}
              </View>
              <Heading>{plan.name}</Heading>
              <Text style={s.muted}>{planRange(plan)}</Text>
              <View style={s.priceRow}>
                <Text style={s.planPrice}>{money(plan.amount_cents)}</Text>
                <Text style={s.muted}>/ mês</Text>
              </View>
              <View style={s.planBenefit}>
                <Icon
                  name="check-circle"
                  size={15}
                  color={colors.primaryLight}
                />
                <Text style={s.muted}>Gestão completa da academia</Text>
              </View>
            </Card>
          );
        })}
      </ResponsiveGrid>
    </View>
  );
}

export function SubscriptionDetails({ value: v }: { value: Subscription }) {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  return (
    <Card style={{ padding: 0, gap: 0 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Como funciona a assinatura"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((x) => !x)}
        style={s.detailsTrigger}
      >
        <View style={s.statLabel}>
          <Icon name="sliders" size={18} color={colors.muted} />
          <Text style={s.detailsTitle}>Como funciona a assinatura</Text>
        </View>
        <Icon
          name={expanded ? "close" : "plus"}
          size={18}
          color={colors.muted}
        />
      </Pressable>
      {expanded ? (
        <View style={s.detailsBody}>
          <Label muted>
            Uma assinatura por academia, compartilhada pelos gestores. As
            mensalidades dos alunos são recebidas separadamente pela academia.
          </Label>
          {v.selected_plan_id ? (
            <Label>
              Plano escolhido:{" "}
              {v.plans?.find((p) => p.id === v.selected_plan_id)?.name ??
                v.selected_plan_id}
              . Ele é o mínimo contratado.
            </Label>
          ) : null}
          <Label muted>
            Contam apenas alunos ativos e não arquivados. Ultrapassar a faixa
            aumenta o enquadramento antes da próxima emissão. Diminuir a
            quantidade não reduz o plano abaixo do escolhido. Pagamentos e links
            já emitidos mantêm o valor.
          </Label>
          <Label muted>
            O teste gratuito dura 5 dias. Depois, sem pagamento confirmado,
            novas operações ficam restritas; consultas e pagamento continuam
            acessíveis. Pagar durante o teste preserva seus dias gratuitos.
          </Label>
          <Label muted>
            Você inicia o pagamento mensal por Pix ou cartão. Não há débito
            automático. A liberação depende da confirmação do provedor, e não
            apenas do retorno do navegador.
          </Label>
          <Button compact secondary onPress={() => router.push("/terms")}>
            Ler Termos de Uso
          </Button>
          {v.enabled && v.renewal_enabled ? (
            <Label muted>
              Para encerrar a renovação, use a opção na área de pagamento. O
              período pago é preservado, sem estorno automático; links emitidos
              podem continuar pagáveis.
            </Label>
          ) : null}
          <Notice message={error} />
          <Button
            compact
            secondary
            icon="mail"
            onPress={() => {
              setError("");
              void Linking.openURL(`mailto:${privacyContact}`).catch(() =>
                setError(
                  `Não foi possível abrir seu e-mail. Escreva para ${privacyContact}.`,
                ),
              );
            }}
          >
            Falar com o suporte
          </Button>
        </View>
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({
  summary: {
    padding: 26,
    gap: 22,
    borderColor: "#59303A",
    backgroundColor: "#1C171C",
  },
  between: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 9,
    letterSpacing: 1.6,
    fontFamily: "Inter_600SemiBold",
  },
  planHeading: { flexDirection: "row", alignItems: "center", gap: 15 },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#342029",
    borderWidth: 1,
    borderColor: "#633039",
  },
  name: {
    color: colors.text,
    fontSize: 25,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: -0.6,
  },
  muted: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    flexWrap: "wrap",
  },
  price: {
    fontSize: 40,
    letterSpacing: -1.8,
    color: colors.text,
    fontFamily: "Inter_700Bold",
  },
  divider: { height: 1, backgroundColor: "#3D2B33" },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 24 },
  stat: { gap: 10, flexGrow: 1, flexBasis: "40%" },
  statLabel: { flexDirection: "row", alignItems: "center", gap: 9 },
  statValue: {
    fontSize: 22,
    fontFamily: "Inter_600SemiBold",
    color: colors.text,
  },
  statSuffix: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: colors.muted,
  },
  date: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: colors.text },
  track: {
    height: 5,
    backgroundColor: "#3A2A32",
    borderRadius: 3,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: colors.primaryLight,
    borderRadius: 3,
  },
  trial: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 13,
    backgroundColor: "#20252E",
    borderRadius: 9,
  },
  trialText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    color: "#C0CDDF",
  },
  warning: {
    color: "#DBB987",
    fontSize: 12,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
  },
  planCard: { padding: 22, gap: 14, borderRadius: 13 },
  currentPlan: { borderColor: colors.primaryLight, backgroundColor: "#21181E" },
  smallIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  planPrice: {
    color: colors.text,
    fontSize: 27,
    letterSpacing: -0.8,
    fontFamily: "Inter_600SemiBold",
  },
  planBenefit: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 15,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  detailsTrigger: {
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
  },
  detailsTitle: {
    color: colors.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  detailsBody: { padding: 22, paddingTop: 0, gap: 16 },
});
