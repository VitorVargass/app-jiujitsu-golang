import React from "react";
import { Redirect, router } from "expo-router";
import { View } from "react-native";
import { Page, Row, Chip, Label } from "../../components/ui";
import { useSession } from "../../services/session";
import { Role } from "../../types";
import { roleLabel } from "../../theme";
export function RoleGate({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const { session, academy } = useSession();
  if (session?.kind === "device") return <Redirect href="/kiosk" />;
  if (!academy || !academy.roles.includes(role) || academy.status !== "active")
    return <Redirect href="/onboarding" />;
  return <>{children}</>;
}
export function AcademyShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { academy, role, session } = useSession();
  return (
    <Page
      title={title}
      subtitle={subtitle || academy?.name}
      action={<Chip onPress={() => router.replace("/onboarding")}>Trocar</Chip>}
    >
      <Row>
        <Chip selected>{role ? roleLabel[role] : ""}</Chip>
        <Label muted>{session?.kind === "user" ? session.user.name : ""}</Label>
      </Row>
      {children}
      <View style={{ marginTop: 12 }}>
        <Row>
          <Chip
            onPress={() =>
              router.replace(
                role === "student"
                  ? "/student"
                  : role === "teacher"
                    ? "/teacher"
                    : "/academy",
              )
            }
          >
            Início
          </Chip>
          <Chip onPress={() => router.push("/classes")}>Turmas</Chip>
          {academy?.roles.includes("student") && (
            <Chip onPress={() => router.push("/history")}>Presenças</Chip>
          )}
        </Row>
      </View>
    </Page>
  );
}
