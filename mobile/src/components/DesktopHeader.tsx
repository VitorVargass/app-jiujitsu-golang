import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { AccountMenu } from "./AccountMenu";
import { Icon } from "./Icon";
import { useSession } from "../services/session";
import { colors, roleLabel } from "../theme";

export function DesktopHeader({ title }: { title: string }) {
  const { academy, role } = useSession();
  return (
    <View style={s.header}>
      <View style={s.breadcrumb}>
        <Link
          href={role === "student" ? "/student" : "/academy"}
          style={s.workspace}
        >
          {academy?.name ?? "Minha academia"}
        </Link>
        <Icon name="chevron-right" size={13} color={colors.muted} />
        <Text numberOfLines={1} style={s.current}>
          {title}
        </Text>
      </View>
      <View style={s.account}>
        {role ? (
          <View style={s.role}>
            <Text style={s.roleText}>{roleLabel[role]}</Text>
          </View>
        ) : null}
        <AccountMenu />
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 28,
    minHeight: 50,
  },
  breadcrumb: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
    minWidth: 0,
  },
  workspace: {
    color: colors.muted,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textDecorationLine: "none",
    maxWidth: 240,
  },
  current: {
    color: colors.text,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    flexShrink: 1,
  },
  account: { flexDirection: "row", alignItems: "center", gap: 20 },
  role: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  roleText: {
    color: colors.muted,
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 0.6,
  },
});
