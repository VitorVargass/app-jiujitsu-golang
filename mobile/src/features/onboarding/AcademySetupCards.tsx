import { ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Badge, Card, Heading, Label } from "../../components/ui";
import { Icon } from "../../components/Icon";
import { colors } from "../../theme";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { money } from "../../types/billing";
import { planOptions } from "../subscription/plan-options";
import { planRange, SubscriptionPlan } from "../subscription/types";

export function SetupHeading({
  number,
  title,
  subtitle,
}: {
  number: string;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={s.headingRow}>
      <View style={s.step}>
        <Text style={s.stepText}>{number}</Text>
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <Heading>{title}</Heading>
        <Text style={s.muted}>{subtitle}</Text>
      </View>
    </View>
  );
}

export function AcademyPlanPicker({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (id: string) => void;
}) {
  const { isCompact } = useResponsiveLayout();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Plano da academia"
      style={s.plans}
    >
      {planOptions.map((plan, i) => {
        const selected = value === plan.id;
        return (
          <Pressable
            key={plan.id}
            accessibilityRole="radio"
            accessibilityLabel={`${plan.name}, ${planRange(plan)}, ${money(plan.amount_cents)} por mês após 5 dias grátis`}
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(plan.id)}
            style={({ pressed }) => [
              s.plan,
              isCompact && { flexBasis: "100%", minWidth: 0 },
              selected && s.selectedPlan,
              pressed && { opacity: 0.8 },
            ]}
          >
            <View style={s.between}>
              <View
                style={[s.planIcon, selected && { backgroundColor: "#3B2029" }]}
              >
                <Icon
                  name={i === 0 ? "users" : i === 1 ? "home" : "sliders"}
                  size={20}
                  color={selected ? colors.primaryLight : colors.muted}
                />
              </View>
              <View style={[s.radio, selected && s.radioSelected]}>
                {selected ? <View style={s.radioDot} /> : null}
              </View>
            </View>
            <Text style={s.planName}>{plan.name}</Text>
            <Text style={s.planRange}>{planRange(plan)}</Text>
            <View style={s.priceRow}>
              <Text style={s.planPrice}>{money(plan.amount_cents)}</Text>
              <Text style={s.unit}>/mês</Text>
            </View>
            <View style={s.planFooter}>
              <Icon
                name="check-circle"
                size={14}
                color={selected ? colors.primaryLight : colors.muted}
              />
              <Text
                style={[
                  s.planFootnote,
                  selected && { color: colors.primaryLight },
                ]}
              >
                {selected ? "Plano selecionado" : "Todos os recursos"}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function AcademySetupSummary({
  plan,
  children,
}: {
  plan?: SubscriptionPlan;
  children: ReactNode;
}) {
  return (
    <Card style={s.summary}>
      <View style={s.between}>
        <Text style={s.eyebrow}>SEU RESUMO</Text>
        <Badge label="5 dias grátis" tone="mint" />
      </View>
      <View style={{ gap: 5 }}>
        <Text style={s.muted}>Para começar hoje</Text>
        <Text style={s.today}>
          R$ 0<Text style={s.todayCents}>,00</Text>
        </Text>
        <Text style={s.muted}>Teste contado a partir da criação.</Text>
      </View>
      <View style={s.summaryPlan}>
        <View style={{ gap: 6, flex: 1 }}>
          <Text style={s.muted}>Depois do teste</Text>
          <Text style={s.summaryPlanName}>
            {plan?.name ?? "Escolha seu plano"}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 3 }}>
          <Text style={s.summaryPrice}>
            {plan ? money(plan.amount_cents) : "—"}
          </Text>
          <Text style={s.unit}>por mês / academia</Text>
        </View>
      </View>
      <View style={s.fact}>
        <Icon name="lock" size={17} color={colors.muted} />
        <Text style={s.factText}>
          Pix ou cartão. Você inicia o pagamento, sem débito automático.
        </Text>
      </View>
      <View style={s.fact}>
        <Icon name="users" size={17} color={colors.muted} />
        <Text style={s.factText}>
          Seus alunos, turmas e financeiro ficam separados de outras academias.
        </Text>
      </View>
      <View style={s.minimum}>
        <Text style={s.minimumTitle}>Sobre o valor do plano</Text>
        <Text style={s.factText}>
          O plano escolhido é o mínimo contratado. Se ultrapassar a faixa de
          alunos ativos, o valor sobe na próxima cobrança ainda não emitida.
        </Text>
      </View>
      {children}
    </Card>
  );
}

export function AcademySetupRules() {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card style={{ padding: 0, gap: 0 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel="Como funcionam o teste e os planos"
        onPress={() => setExpanded((v) => !v)}
        style={s.rulesTrigger}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.rulesTitle}>Como funcionam o teste e os planos</Text>
          <Text style={s.muted}>Regras de acesso e enquadramento</Text>
        </View>
        <Icon
          name={expanded ? "close" : "plus"}
          size={18}
          color={colors.muted}
        />
      </Pressable>
      {expanded ? (
        <View style={{ padding: 22, paddingTop: 0, gap: 15 }}>
          <Label muted>
            O teste dura 5 dias a partir da criação. Sem pagamento confirmado no
            fim do teste, novas operações ficam restritas. Consultas e
            regularização continuam disponíveis.
          </Label>
          <Label muted>
            Contam apenas alunos ativos e não arquivados. O plano escolhido é
            seu compromisso mínimo: diminuir a quantidade de alunos não reduz o
            valor abaixo dele. Ultrapassar a faixa aumenta o enquadramento antes
            da próxima emissão.
          </Label>
          <Label muted>
            Pagamentos e links já emitidos mantêm seu valor. Pagar durante o
            teste preserva os dias gratuitos. A assinatura da TatameMix é
            separada das mensalidades dos alunos.
          </Label>
        </View>
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({
  headingRow: { flexDirection: "row", alignItems: "center", gap: 13 },
  step: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2D171B",
    borderWidth: 1,
    borderColor: "#633039",
  },
  stepText: {
    color: colors.primaryLight,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  muted: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
  },
  plans: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  plan: {
    flexBasis: "30%",
    flexGrow: 1,
    minWidth: 150,
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 13,
  },
  selectedPlan: {
    backgroundColor: "#24191F",
    borderColor: colors.primaryLight,
  },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  planIcon: {
    height: 35,
    width: 35,
    borderRadius: 10,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#6D6D78",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: colors.primaryLight },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primaryLight,
  },
  planName: {
    color: colors.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    lineHeight: 22,
    minHeight: 44,
  },
  planRange: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    minHeight: 36,
  },
  priceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: 4,
    marginTop: "auto",
  },
  planPrice: {
    color: colors.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: 25,
    letterSpacing: -0.8,
  },
  unit: {
    color: colors.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    lineHeight: 17,
  },
  planFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  planFootnote: {
    color: colors.muted,
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    flexShrink: 1,
  },
  summary: {
    padding: 25,
    borderColor: "#59303A",
    backgroundColor: "#1D181D",
    gap: 22,
  },
  eyebrow: {
    fontFamily: "Inter_600SemiBold",
    color: colors.muted,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  today: {
    color: colors.text,
    fontFamily: "Inter_700Bold",
    fontSize: 45,
    letterSpacing: -1.8,
  },
  todayCents: { fontSize: 28 },
  summaryPlan: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#3D2B33",
    paddingVertical: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    alignItems: "center",
  },
  summaryPlanName: {
    color: colors.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    lineHeight: 23,
  },
  summaryPrice: {
    color: colors.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: 22,
    letterSpacing: -0.7,
  },
  fact: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  factText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    color: colors.muted,
  },
  minimum: { gap: 7, padding: 14, backgroundColor: "#272026", borderRadius: 9 },
  minimumTitle: {
    color: colors.text,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  rulesTrigger: {
    padding: 20,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    minHeight: 66,
  },
  rulesTitle: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "Inter_600SemiBold",
  },
});
