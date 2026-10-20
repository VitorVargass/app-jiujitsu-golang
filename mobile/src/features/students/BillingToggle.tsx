import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, accents } from "../../theme";

export function BillingToggle({
  enabled,
  disabled = false,
  onChange,
}: {
  enabled: boolean;
  disabled?: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel="Cobrança mensal automática"
      accessibilityState={{ checked: enabled, disabled }}
      aria-checked={enabled}
      aria-disabled={disabled}
      accessibilityHint="Marque para gerar as mensalidades do aluno automaticamente."
      disabled={disabled}
      onPress={() => onChange(!enabled)}
      style={({ pressed }) => [
        s.control,
        enabled && s.active,
        disabled && s.disabled,
        pressed && !disabled && s.pressed,
      ]}
    >
      <View style={[s.checkbox, enabled && s.checked]} accessible={false}>
        {enabled ? <Text style={s.check}>✓</Text> : null}
      </View>
      <View style={s.content}>
        <View style={s.titleRow}>
          <Text style={s.title}>Cobrança mensal automática</Text>
          <Text style={[s.state, enabled && s.activeState]}>
            {enabled ? "Ativa" : "Desativada"}
          </Text>
        </View>
        <Text style={s.description}>
          {disabled
            ? "Disponível para alunos ativos."
            : enabled
              ? "As mensalidades serão geradas a partir do mês escolhido abaixo. Toque para desmarcar."
              : "Nenhuma nova mensalidade será gerada automaticamente. Toque para ativar."}
        </Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  control: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    minHeight: 64,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  active: {
    borderColor: accents.brand.border,
    backgroundColor: accents.brand.soft,
  },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.8 },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.muted,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  checked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  check: {
    color: colors.onPrimary,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 20,
  },
  content: { flex: 1, gap: 7, minWidth: 0 },
  titleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: colors.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    flexShrink: 1,
  },
  state: { color: colors.muted, fontFamily: "Inter_600SemiBold", fontSize: 12 },
  activeState: { color: colors.primaryLight },
  description: {
    color: colors.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
});
