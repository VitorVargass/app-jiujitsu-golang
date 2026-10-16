import React, { useCallback } from "react";
import { Redirect, router, usePathname, Href } from "expo-router";
import { View, Pressable, Text, StyleSheet, Keyboard } from "react-native";
import { Page } from "../../components/ui";
import { SwipeDirection } from "../../components/SwipeNavigator";
import {
  SectionPreview,
  useSectionPages,
  useSectionPreview,
} from "./SectionPagesContext";
import { Icon, IconName } from "../../components/Icon";
import { useSession } from "../../services/session";
import { Role } from "../../types";
import { roleLabel, colors, accents, Accent } from "../../theme";

type Tab = {
  label: string;
  url: string;
  icon: IconName;
  routes: string[];
  tone: Accent;
};
const managerTabs: Tab[] = [
  {
    label: "Início",
    url: "/academy",
    icon: "home",
    tone: "mint",
    routes: ["/academy"],
  },
  {
    label: "Alunos",
    url: "/students",
    icon: "users",
    tone: "blue",
    routes: ["/students"],
  },
  {
    label: "Financeiro",
    url: "/finance",
    icon: "wallet",
    tone: "mint",
    routes: ["/finance", "/invoice"],
  },
  {
    label: "Turmas",
    url: "/classes",
    icon: "calendar",
    tone: "amber",
    routes: ["/classes", "/attendance"],
  },
  {
    label: "Mais",
    url: "/more",
    icon: "more",
    tone: "lavender",
    routes: ["/more", "/catalog", "/academy-history", "/devices"],
  },
];
const studentTabs: Tab[] = [
  {
    label: "Mensalidades",
    url: "/student",
    icon: "wallet",
    tone: "mint",
    routes: ["/student", "/invoice"],
  },
  {
    label: "Presenças",
    url: "/history",
    icon: "check-circle",
    tone: "blue",
    routes: ["/history"],
  },
  {
    label: "Meu QR",
    url: "/qr",
    icon: "qr",
    tone: "lavender",
    routes: ["/qr"],
  },
];

export function RoleGate({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const { session, academy } = useSession();
  if (session?.kind === "device") return <Redirect href="/kiosk" />;
  if (
    !academy ||
    !academy.roles.includes(role) ||
    (role !== "student" && academy.status !== "active")
  )
    return <Redirect href="/onboarding" />;
  return <>{children}</>;
}

export function AcademyShell({
  title,
  subtitle,
  titleAction,
  children,
  swipeEnabled = true,
}: {
  title: string;
  subtitle?: string;
  titleAction?: React.ReactNode;
  children: React.ReactNode;
  swipeEnabled?: boolean;
}) {
  const { academy, role, session } = useSession();
  const pathname = usePathname();
  const tabs = role === "student" ? studentTabs : managerTabs;
  const name = session?.kind === "user" ? session.user.name : "";
  const currentIndex = tabs.findIndex((tab) => tab.url === pathname);
  const screens = useSectionPages();
  const preview = useSectionPreview();
  const next =
    currentIndex >= 0
      ? screens[tabs[(currentIndex + 1) % tabs.length].url]
      : undefined;
  const previous =
    currentIndex >= 0
      ? screens[tabs[(currentIndex - 1 + tabs.length) % tabs.length].url]
      : undefined;
  const swipe = useCallback(
    (direction: SwipeDirection) => {
      if (currentIndex < 0) return;
      const nextIndex =
        (currentIndex + (direction === "right" ? 1 : -1) + tabs.length) %
        tabs.length;
      Keyboard.dismiss();
      router.replace(tabs[nextIndex].url as Href);
    },
    [currentIndex, tabs],
  );
  if (preview) {
    return (
      <Page
        title={title}
        subtitle={subtitle || academy?.name}
        titleAction={titleAction}
        contentOnly
      >
        {children}
      </Page>
    );
  }
  return (
    <Page
      title={title}
      subtitle={subtitle || academy?.name}
      titleAction={titleAction}
      onSwipe={swipeEnabled && next && previous ? swipe : undefined}
      swipePages={
        next && previous
          ? {
              right: <SectionPreview screen={next} />,
              left: <SectionPreview screen={previous} />,
            }
          : undefined
      }
      header={
        <View style={styles.header}>
          <View style={styles.brand}>
            <Text style={styles.mark}>◈</Text>
            <Text style={styles.brandName}>Tatame</Text>
          </View>
          <View style={styles.account}>
            <View
              style={styles.identity}
              accessible
              accessibilityLabel={name + (role ? ", " + roleLabel[role] : "")}
            >
              <Text numberOfLines={1} style={styles.name}>
                {name}
              </Text>
              <Text style={styles.role}>{role ? roleLabel[role] : ""}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Trocar academia ou perfil"
              onPress={() => router.replace("/onboarding")}
              style={({ pressed }) => [
                styles.switch,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Icon name="swap" size={16} color={colors.muted} />
              <Text style={styles.switchText}>Trocar</Text>
            </Pressable>
          </View>
        </View>
      }
      footer={
        <View style={styles.dock}>
          {tabs.map((tab) => {
            const accent = accents[tab.tone];
            const selected = tab.routes.some(
              (url) => pathname === url || pathname.startsWith(url + "/"),
            );
            return (
              <Pressable
                key={tab.url}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected }}
                onPress={() => {
                  if (pathname !== tab.url) {
                    Keyboard.dismiss();
                    router.replace(tab.url as Href);
                  }
                }}
                style={({ pressed }) => [
                  styles.tab,
                  pressed && { opacity: 0.65 },
                ]}
              >
                <View
                  style={[
                    styles.tabIcon,
                    selected && {
                      backgroundColor: accent.soft,
                      borderColor: accent.border,
                    },
                  ]}
                >
                  <Icon
                    name={tab.icon}
                    size={22}
                    color={selected ? accent.color : colors.muted}
                  />
                </View>
                <Text
                  numberOfLines={1}
                  style={[styles.tabLabel, selected && { color: accent.color }]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      }
    >
      {children}
    </Page>
  );
}
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    minHeight: 44,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 6 },
  mark: { color: colors.primary, fontSize: 27 },
  brandName: {
    color: colors.text,
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
    letterSpacing: -0.5,
  },
  account: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
  },
  identity: {
    flexShrink: 1,
    minWidth: 0,
    maxWidth: 140,
    gap: 3,
    alignItems: "flex-end",
  },
  name: { color: colors.text, fontFamily: "Lato_700Bold", fontSize: 12 },
  role: { color: colors.primary, fontFamily: "Lato_400Regular", fontSize: 11 },
  switch: {
    minHeight: 44,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  switchText: { color: colors.muted, fontFamily: "Lato_700Bold", fontSize: 11 },
  dock: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  tabIcon: {
    width: 44,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabLabel: { fontFamily: "Lato_700Bold", fontSize: 10, color: colors.muted },
});
