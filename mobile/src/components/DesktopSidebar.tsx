import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Href, Link } from "expo-router";
import { Brand } from "./Brand";
import { Icon, IconName } from "./Icon";
import { useTheme, useThemedStyles } from "../theme/ThemeProvider";
import { createThemedStyles } from "../theme";
import { useSession } from "../services/session";

export type NavigationItem = {
  label: string;
  url: string;
  icon: IconName;
  routes: string[];
};
const administration: NavigationItem[] = [
  {
    label: "Planos e modalidades",
    url: "/catalog",
    icon: "sliders",
    routes: ["/catalog"],
  },
  {
    label: "Equipe de gestão",
    url: "/managers",
    icon: "users",
    routes: ["/managers"],
  },
  {
    label: "Matrículas pelo link",
    url: "/enrollment-settings",
    icon: "plus",
    routes: ["/enrollment-settings"],
  },
];
const operations: NavigationItem[] = [
  {
    label: "Recebimentos",
    url: "/receipts",
    icon: "wallet",
    routes: ["/receipts"],
  },
  {
    label: "Check-in e dispositivos",
    url: "/devices",
    icon: "tablet",
    routes: ["/devices"],
  },
];
const subscription: NavigationItem = {
  label: "Minha assinatura",
  url: "/subscription",
  icon: "wallet",
  routes: ["/subscription"],
};
const settings: NavigationItem = {
  label: "Configurações",
  url: "/more",
  icon: "sliders",
  routes: ["/more", "/participation", "/create-academy"],
};

function MenuLink({
  item,
  selected,
  attention = false,
}: {
  item: NavigationItem;
  selected: boolean;
  attention?: boolean;
}) {
  const { colors } = useTheme();
  const s = useThemedStyles(themedS);
  const [hovered, setHovered] = useState(false);
  // Router's Slot merges plain style objects; callbacks lose layout, arrays throw in dev.
  return (
    <Link href={item.url as Href} asChild>
      <Pressable
        accessibilityRole="link"
        aria-current={selected ? "page" : undefined}
        accessibilityLabel={
          item.label +
          (attention ? ". Configure os horários para liberar o check-in" : "")
        }
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={StyleSheet.flatten([
          s.link,
          hovered && s.hovered,
          selected && s.selected,
        ])}
      >
        {selected ? <View style={s.selectionRail} /> : null}
        <Icon
          name={item.icon}
          size={19}
          color={
            selected ? colors.onPrimary : hovered ? colors.text : colors.muted
          }
        />
        <Text
          numberOfLines={1}
          style={[s.linkText, (selected || hovered) && { color: colors.text }]}
        >
          {item.label}
        </Text>
        {attention ? (
          <View
            style={[s.attention, selected && { backgroundColor: "#FFFFFF26" }]}
          >
            <Text style={[s.attentionText, selected && { color: "#FFFFFF" }]}>
              !
            </Text>
          </View>
        ) : null}
      </Pressable>
    </Link>
  );
}

export function DesktopSidebar({
  items,
  pathname,
  needsSetup,
}: {
  items: NavigationItem[];
  pathname: string;
  needsSetup: boolean;
}) {
  const { colors } = useTheme();
  const s = useThemedStyles(themedS);
  const { academy, role } = useSession();
  const admin = role === "admin";
  const primary = admin
    ? [
        ...items
          .filter((item) => item.url !== "/more")
          .map((item) => ({
            ...item,
            label: item.url === "/academy" ? "Visão geral" : item.label,
          })),
        {
          label: "Presenças",
          url: "/academy-history",
          icon: "check-circle" as const,
          routes: ["/academy-history"],
        },
      ]
    : items;
  const all = [
    ...primary,
    ...(admin
      ? [...administration, ...operations, settings, subscription]
      : []),
  ];
  // The most specific match wins: never highlight two sections for a nested route.
  const active = all
    .flatMap((item) =>
      item.routes
        .filter(
          (route) => pathname === route || pathname.startsWith(route + "/"),
        )
        .map((route) => ({ url: item.url, length: route.length })),
    )
    .sort((a, b) => b.length - a.length)[0]?.url;
  function group(title: string, links: NavigationItem[]) {
    return (
      <View style={s.group}>
        <Text style={s.groupLabel}>{title}</Text>
        {links.map((item) => (
          <MenuLink
            key={item.url}
            item={item}
            selected={active === item.url}
            attention={needsSetup && item.url === "/classes"}
          />
        ))}
      </View>
    );
  }
  return (
    <View testID="desktop-sidebar" style={s.sidebar}>
      <View style={s.top}>
        <View style={s.brandRow}>
          <Link
            href={(role === "student" ? "/history" : "/academy") as Href}
            accessibilityLabel="TatameMix, início da academia"
          >
            <Brand compact />
          </Link>
          <Text style={s.appBadge}>WORKSPACE</Text>
        </View>
        <Link href="/academies" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Academia atual: ${academy?.name ?? "Minha academia"}. Ver meus acessos e trocar academia`}
            style={s.academy}
          >
            <View style={s.academyAvatar}>
              <Text style={s.academyInitial}>
                {academy?.name?.trim().slice(0, 1).toUpperCase() || "A"}
              </Text>
            </View>
            <View style={s.academyCopy}>
              <Text style={s.academyCaption}>Academia atual</Text>
              <Text numberOfLines={1} style={s.academyName}>
                {academy?.name ?? "Minha academia"}
              </Text>
            </View>
            <Icon name="swap" size={16} color={colors.muted} />
          </Pressable>
        </Link>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={s.navigation}
        accessibilityLabel="Menu da academia"
      >
        <View
          role="navigation"
          aria-label="Navegação da academia"
          style={{ gap: 23 }}
        >
          {group(admin ? "PRINCIPAL" : "MEU ESPAÇO", primary)}
          {admin ? (
            <>
              {group("GESTÃO", administration)}
              {group("OPERAÇÃO", operations)}
            </>
          ) : null}
        </View>
      </ScrollView>
      <View style={s.footer}>
        {admin ? (
          <>
            <MenuLink item={settings} selected={active === settings.url} />
            <Link href="/subscription" asChild>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Minha assinatura. Consultar plano e pagamentos"
                aria-current={active === subscription.url ? "page" : undefined}
                style={StyleSheet.flatten([
                  s.subscription,
                  active === subscription.url && s.subscriptionSelected,
                ])}
              >
                <View style={s.subscriptionIcon}>
                  <Icon name="wallet" size={19} color={colors.primaryLight} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.subscriptionTitle}>Minha assinatura</Text>
                  <Text style={s.subscriptionHint}>Plano e pagamentos</Text>
                </View>
                <Icon name="chevron-right" size={15} color={colors.muted} />
              </Pressable>
            </Link>
          </>
        ) : null}
        <View style={s.signature}>
          <View style={s.brandLine} />
          <Text style={s.signatureText}>Menos gestão. Mais tatame.</Text>
        </View>
      </View>
    </View>
  );
}
const themedS = createThemedStyles(({ accents, colors }) => ({
  sidebar: {
    width: 264,
    flexShrink: 0,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.borderSubtle,
  },
  top: { paddingHorizontal: 18, paddingTop: 25, paddingBottom: 22, gap: 27 },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 5,
  },
  appBadge: {
    color: colors.muted,
    fontSize: 6,
    letterSpacing: 1,
    fontFamily: "Inter_600SemiBold",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: 5,
  },
  academy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  academyAvatar: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: accents.brand.soft,
    borderWidth: 1,
    borderColor: accents.brand.border,
    alignItems: "center",
    justifyContent: "center",
  },
  academyInitial: {
    color: accents.coral.color,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  academyCopy: { flex: 1, minWidth: 0, gap: 5 },
  academyCaption: {
    color: colors.muted,
    fontSize: 9,
    fontFamily: "Inter_400Regular",
  },
  academyName: {
    color: colors.text,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  navigation: { paddingHorizontal: 14, paddingBottom: 22 },
  group: { gap: 4 },
  groupLabel: {
    paddingHorizontal: 13,
    paddingBottom: 9,
    color: colors.muted,
    fontSize: 8,
    letterSpacing: 1.7,
    fontFamily: "Inter_600SemiBold",
  },
  link: {
    minHeight: 43,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    position: "relative",
    overflow: "hidden",
  },
  linkText: {
    flex: 1,
    color: colors.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  hovered: { backgroundColor: colors.surfaceRaised },
  selected: { backgroundColor: colors.primary },
  selectionRail: {
    position: "absolute",
    left: 0,
    top: 11,
    bottom: 11,
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.danger,
  },
  attention: {
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: accents.coral.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  attentionText: {
    color: accents.coral.color,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  footer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 9,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  subscription: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subscriptionSelected: {
    borderColor: colors.primaryLight,
    backgroundColor: accents.brand.soft,
  },
  subscriptionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: accents.brand.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  subscriptionTitle: {
    color: colors.text,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  subscriptionHint: {
    color: colors.muted,
    fontSize: 9,
    fontFamily: "Inter_400Regular",
  },
  signature: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
  },
  brandLine: { width: 13, height: 2, backgroundColor: colors.primary },
  signatureText: {
    color: colors.muted,
    fontSize: 8,
    fontFamily: "Inter_400Regular",
  },
}));
