import { ResponsiveGrid } from "../../components/ResponsiveGrid";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "../../components/Icon";
import { Badge, Card, Heading, Label } from "../../components/ui";
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
        <Card key={item.id}>
          <View style={s.heading}>
            <View style={s.icon}>
              <Icon name="home" color={accents.blue.color} />
            </View>
            <View style={s.name}>
              <Heading>{item.name}</Heading>
              <Label muted>Escolha a área para acessar</Label>
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
                  <Text style={s.label}>
                    {manager ? "Gestão da academia" : "Área do aluno"}
                  </Text>
                  {current ? <Badge label="Atual" tone="mint" /> : null}
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
  heading: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { padding: 12, borderRadius: 14, backgroundColor: accents.blue.soft },
  name: { flex: 1, gap: 5, minWidth: 0 },
  option: {
    minHeight: 56,
    padding: 12,
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
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: colors.text,
  },
});
