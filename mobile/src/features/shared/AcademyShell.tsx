import { AccountMenu } from "../../components/AccountMenu";
import React, { useCallback } from "react";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { DesktopSidebar } from "../../components/DesktopSidebar";
import { Brand } from "../../components/Brand";
import { Redirect, router, usePathname, Href } from "expo-router";
import { View, Pressable, Text, StyleSheet, Keyboard } from "react-native";
import { Page, Loading } from "../../components/ui";
import { SwipeDirection } from "../../components/SwipeNavigator";
import {
  SectionPreview,
  useSectionPages,
  useSectionPreview,
} from "./SectionPagesContext";
import { Icon, IconName } from "../../components/Icon";
import { useSession } from "../../services/session";
import { Role } from "../../types";
import { colors, accents, Accent } from "../../theme";
import { useClassSetup } from "../classes/useClassSetup";
import { ClassSetupNotice } from "../classes/ClassSetupNotice";

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
    tone: "brand",
    routes: ["/academy"],
  },
  {
    label: "Alunos",
    url: "/students",
    icon: "users",
    tone: "brand",
    routes: ["/students"],
  },
  {
    label: "Financeiro",
    url: "/finance",
    icon: "wallet",
    tone: "brand",
    routes: ["/finance", "/invoice"],
  },
  {
    label: "Turmas",
    url: "/classes",
    icon: "calendar",
    tone: "brand",
    routes: ["/classes", "/attendance", "/attendance-day"],
  },
  {
    label: "Mais",
    url: "/more",
    icon: "more",
    tone: "brand",
    routes: [
      "/more",
      "/managers",
      "/catalog",
      "/academy-history",
      "/devices",
      "/participation",
      "/create-academy",
    ],
  },
];
const studentTabs: Tab[] = [
  {
    label: "Mensalidades",
    url: "/student",
    icon: "wallet",
    tone: "brand",
    routes: ["/student", "/invoice"],
  },
  {
    label: "Presenças",
    url: "/history",
    icon: "check-circle",
    tone: "brand",
    routes: ["/history"],
  },
  {
    label: "Meu QR",
    url: "/qr",
    icon: "qr",
    tone: "brand",
    routes: ["/qr"],
  },
];

export function PersonalGate({ children }: { children: React.ReactNode }) {
  const { ready, session, academy, academiesLoading } = useSession();
  if (!ready || academiesLoading)
    return (
      <Page>
        <Loading />
      </Page>
    );
  if (session?.kind === "device") return <Redirect href="/kiosk" />;
  if (!session || !academy) return <Redirect href="/entry" />;
  return <>{children}</>;
}

export function RoleGate({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const {
    ready,
    session,
    academy,
    role: currentRole,
    academiesLoading,
  } = useSession();
  if (!ready || academiesLoading)
    return (
      <Page>
        <Loading />
      </Page>
    );
  if (session?.kind === "device") return <Redirect href="/kiosk" />;
  if (
    !academy ||
    !academy.roles.includes(role) ||
    (role !== "student" && academy.status !== "active")
  )
    return <Redirect href="/entry" />;
  if (currentRole !== role)
    return <Redirect href={{ pathname: "/entry", params: { area: role } }} />;
  return <>{children}</>;
}

export function AcademyShell({
  title,
  subtitle,
  titleAction,
  children,
  swipeEnabled = true,
  showClassSetupNotice = false,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  titleAction?: React.ReactNode;
  children: React.ReactNode;
  swipeEnabled?: boolean;
  showClassSetupNotice?: boolean;
  wide?: boolean;
}) {
  const { academy, role, session } = useSession();
  const pathname = usePathname();
  const { isWide } = useResponsiveLayout();
  const tabs = role === "student" ? studentTabs : managerTabs;
  const currentIndex = tabs.findIndex((tab) => tab.url === pathname);
  const screens = useSectionPages();
  const preview = useSectionPreview();
  const setup = useClassSetup(
    academy?.id,
    role === "admin" &&
      academy?.status === "active" &&
      session?.kind === "user" &&
      !preview,
  );
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
        wide={wide}
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
      wide={wide || isWide}
      sidebar={
        isWide ? (
          <DesktopSidebar
            items={tabs}
            pathname={pathname}
            needsSetup={setup.needsSetup}
          />
        ) : undefined
      }
      onSwipe={!isWide && swipeEnabled && next && previous ? swipe : undefined}
      swipePages={
        !isWide && swipeEnabled && next && previous
          ? {
              right: <SectionPreview screen={next} />,
              left: <SectionPreview screen={previous} />,
            }
          : undefined
      }
      header={
        !isWide ? (
          <View style={styles.header}>
            <Brand compact />
            <View style={styles.account}>
              <AccountMenu compact />
            </View>
          </View>
        ) : undefined
      }
      footer={
        !isWide ? (
          <View style={styles.dock}>
            {tabs.map((tab) => {
              const accent = accents[tab.tone];
              const attention = tab.url === "/classes" && setup.needsSetup;
              const selected = tab.routes.some(
                (url) => pathname === url || pathname.startsWith(url + "/"),
              );
              return (
                <Pressable
                  key={tab.url}
                  accessibilityRole="tab"
                  accessibilityLabel={tab.label}
                  accessibilityHint={
                    attention
                      ? "Configuração pendente. Cadastre ou ative uma turma com horários para liberar o check-in."
                      : undefined
                  }
                  accessibilityState={{ selected }}
                  onPress={() => {
                    if (pathname !== tab.url) {
                      Keyboard.dismiss();
                      router.navigate(tab.url as Href);
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
                      attention && styles.tabAttention,
                    ]}
                  >
                    <Icon
                      name={tab.icon}
                      size={22}
                      color={
                        attention
                          ? accents.coral.color
                          : selected
                            ? accent.color
                            : colors.muted
                      }
                    />
                    {attention ? (
                      <View
                        style={styles.pendingBadge}
                        pointerEvents="none"
                        aria-hidden
                      >
                        <Text style={styles.pendingBadgeText}>!</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.tabLabel,
                      selected && { color: accent.color },
                      attention && { color: accents.coral.color },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : undefined
      }
    >
      {showClassSetupNotice && setup.needsSetup ? (
        <ClassSetupNotice hasClasses={setup.hasClasses} />
      ) : null}
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
  account: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
  },
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
  tabAttention: {
    backgroundColor: accents.coral.soft,
    borderColor: accents.coral.border,
  },
  pendingBadge: {
    position: "absolute",
    top: -5,
    right: -3,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: "#D43B47",
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingBadgeText: {
    color: "#FFFFFF",
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    lineHeight: 12,
  },
  tabLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: colors.muted,
  },
});
