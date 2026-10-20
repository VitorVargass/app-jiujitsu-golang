import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Card } from "../../components/ui";
import { Icon } from "../../components/Icon";
import { accents, colors } from "../../theme";

export function ClassSetupNotice({ hasClasses }: { hasClasses: boolean }) {
  const action = hasClasses ? "Revisar turmas e horários" : "Cadastrar turmas";
  return (
    <Card
      onPress={() => router.replace("/classes")}
      accessibilityLabel={
        "Configuração pendente. " +
        action +
        ". O check-in precisa de uma turma ativa com horários. O financeiro já pode ser usado."
      }
      style={s.card}
    >
      <View style={s.top}>
        <View style={s.icon}>
          <Icon name="calendar" size={23} color={accents.coral.color} />
        </View>
        <View style={s.heading}>
          <Text style={s.eyebrow}>CONFIGURAÇÃO PENDENTE</Text>
          <Text style={s.title}>
            {hasClasses ? "Complete sua agenda" : "Prepare o primeiro treino"}
          </Text>
        </View>
      </View>
      <Text style={s.description}>
        {hasClasses
          ? "Ative uma turma e cadastre seus dias e horários para liberar o check-in por CPF ou QR."
          : "Cadastre uma turma com os dias e horários das aulas para liberar o check-in por CPF ou QR."}
      </Text>
      <View style={s.action}>
        <Text style={s.actionText}>{action}</Text>
        <Icon name="arrow-right" size={18} color={colors.onPrimary} />
      </View>
      <Text style={s.hint}>
        O financeiro já pode ser usado. Não é preciso abrir aulas diariamente.
      </Text>
    </Card>
  );
}

const s = StyleSheet.create({
  card: {
    borderColor: accents.coral.border,
    backgroundColor: accents.brand.soft,
    borderRadius: 20,
    gap: 14,
  },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: accents.coral.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: { flex: 1, minWidth: 0, gap: 5 },
  eyebrow: {
    color: accents.coral.color,
    fontSize: 10,
    letterSpacing: 1,
    fontFamily: "Inter_600SemiBold",
  },
  title: {
    color: colors.text,
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    lineHeight: 24,
  },
  description: {
    color: colors.text,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 21,
  },
  action: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  actionText: {
    color: colors.onPrimary,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    flexShrink: 1,
  },
  hint: {
    color: colors.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
  },
});
