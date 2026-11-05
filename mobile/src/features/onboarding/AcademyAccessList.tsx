import { ResponsiveGrid } from "../../components/ResponsiveGrid";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "../../components/Icon";
import { Badge, Card, Heading } from "../../components/ui";
import { AcademyAccess, accessHome } from "../../services/access";
import { useSession } from "../../services/session";
import { router } from "expo-router";
import { accents, colors } from "../../theme";

export function AcademyAccessList({ options }: { options: AcademyAccess[] }) {
  const { academy, role, select } = useSession();
  const groups = [
    ...new Map(options.map((item) => [item.academy.id, item.academy])).values(),
  ];
  return (
    <ResponsiveGrid>
      {groups.map((item) => (
        <Card key={item.id} style={s.card}>
          <View style={s.heading}>
            <View style={s.icon}>
              <Text style={s.initial}>
                {item.name.trim().slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={s.name}>
              <Heading>{item.name}</Heading>
              <Text style={s.caption}>SEU ESPAÇO NA ACADEMIA</Text>
            </View>
          </View>
          {options
            .filter((option) => option.academy.id === item.id)
            .map((option) => {
              const manager = option.role === "admin";
              const current = academy?.id === item.id && role === option.role;
              return (
                <Pressable
                  key={option.role}
                  accessibilityRole="button"
                  accessibilityLabel={
                    item.name +
                    ". " +
                    (manager ? "Abrir gestão" : "Abrir área do aluno")
                  }
                  onPress={() => {
                    select(item, option.role);
                    router.replace(accessHome(option.role));
                  }}
                  style={({ pressed }) => [
                    s.option,
                    current && s.current,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Icon
                    name={manager ? "sliders" : "users"}
                    size={20}
                    color={current ? accents.brand.color : colors.muted}
                  />
                  <View style={{ flex: 1, gap: 5, minWidth: 0 }}>
                    <Text style={s.label}>
                      {manager ? "Gestão da academia" : "Área do aluno"}
                    </Text>
                    <Text style={s.optionHint}>
                      {manager
                        ? "Alunos, turmas e financeiro"
                        : "Mensalidades, presenças e identificação"}
                    </Text>
                    {current ? (
                      <Badge label="Acesso atual" tone="mint" />
                    ) : null}
                  </View>
                  <Icon name="chevron-right" size={18} color={colors.muted} />
                </Pressable>
              );
            })}
        </Card>
      ))}
    </ResponsiveGrid>
  );
}
const s = StyleSheet.create({
  card: { padding: 24, gap: 20, borderRadius: 15 },
  heading: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: accents.brand.soft,
    borderWidth: 1,
    borderColor: accents.brand.border,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    fontFamily: "Inter_700Bold",
    fontSize: 21,
    color: colors.primaryLight,
  },
  caption: {
    color: colors.muted,
    fontFamily: "Inter_600SemiBold",
    fontSize: 8,
    letterSpacing: 1,
  },
  optionHint: {
    color: colors.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    lineHeight: 17,
  },
  name: { flex: 1, gap: 5, minWidth: 0 },
  option: {
    minHeight: 72,
    padding: 15,
    gap: 10,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  current: {
    borderColor: accents.brand.border,
    backgroundColor: accents.brand.soft,
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: colors.text,
  },
});
