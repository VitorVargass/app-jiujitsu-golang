import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Href, Link } from "expo-router";
import { Brand } from "./Brand";
import { AccountMenu } from "./AccountMenu";
import { Icon, IconName } from "./Icon";
import { colors } from "../theme";
import { useSession } from "../services/session";

export type NavigationItem = {
  label: string;
  url: string;
  icon: IconName;
  routes: string[];
};
export function DesktopSidebar({
  items,
  pathname,
  needsSetup,
}: {
  items: NavigationItem[];
  pathname: string;
  needsSetup: boolean;
}) {
  const { academy } = useSession();
  return (
    <View testID="desktop-sidebar" style={s.sidebar}>
      <ScrollView contentContainerStyle={s.content}>
        <Brand compact />
        <View style={s.academy}>
          <Text style={s.eyebrow}>ACADEMIA ATIVA</Text>
          <Text style={s.academyName}>{academy?.name}</Text>
        </View>
        <View role="navigation" style={s.navigation}>
          {items.map((item) => {
            const selected = item.routes.some(
              (path) => pathname === path || pathname.startsWith(path + "/"),
            );
            const attention = needsSetup && item.url === "/classes";
            return (
              <Link
                key={item.url}
                href={item.url as Href}
                accessibilityLabel={
                  item.label +
                  (attention
                    ? ". Configure os horários para liberar o check-in"
                    : "")
                }
                aria-current={selected ? "page" : undefined}
                style={[s.link, selected && s.selected]}
              >
                <View style={s.linkContent}>
                  <Icon
                    name={item.icon}
                    size={20}
                    color={selected ? colors.onPrimary : colors.muted}
                  />
                  <Text
                    style={[
                      s.linkText,
                      selected && { color: colors.onPrimary },
                    ]}
                  >
                    {item.label}
                  </Text>
                  {attention ? <Text style={s.pending}>!</Text> : null}
                </View>
              </Link>
            );
          })}
        </View>
        <View style={s.identity}>
          <AccountMenu />
        </View>
        <Text style={s.eyebrow}>MENOS GESTÃO. MAIS TATAME.</Text>
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  sidebar: {
    width: 232,
    flexShrink: 0,
    borderRightWidth: 1,
    borderRightColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  content: { padding: 20, gap: 28, flexGrow: 1 },
  academy: { gap: 8, paddingTop: 8 },
  eyebrow: {
    color: colors.muted,
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 1.2,
  },
  academyName: {
    color: colors.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    lineHeight: 22,
  },
  navigation: { gap: 8 },
  link: {
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 12,
    textDecorationLine: "none",
  },
  linkContent: { flexDirection: "row", gap: 12, alignItems: "center" },
  linkText: {
    color: colors.muted,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    flex: 1,
  },
  selected: { backgroundColor: colors.primary },
  pending: { color: colors.danger, fontFamily: "Inter_700Bold", fontSize: 16 },
  identity: {
    marginTop: "auto",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: 20,
  },
});
