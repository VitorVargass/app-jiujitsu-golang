import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSession } from "../services/session";
import { academyAccesses, accessHome, AcademyAccess } from "../services/access";
import { colors, accents, roleLabel } from "../theme";
import { EditorDialog } from "./EditorDialog";
import { Badge, Button, Label, Loading, Notice } from "./ui";
import { Icon } from "./Icon";

/** The account trigger replaces the old switch button on both layouts. */
export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const {
    session,
    academy,
    role,
    academies,
    academiesLoading,
    academiesError,
    reloadAcademies,
    select,
    logout,
  } = useSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (session?.kind !== "user") return null;
  const user = session.user;
  const initials = user.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const options = academyAccesses(academies);
  const multiple = options.length > 1;
  function choose(option: AcademyAccess) {
    setOpen(false);
    if (academy?.id === option.academy.id && role === option.role) return;
    select(option.academy, option.role);
    router.replace(accessHome(option.role));
  }
  async function signOut() {
    setBusy(true);
    try {
      await logout();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Abrir minha conta"
        accessibilityHint="Consulte sua conta e seus acessos à academia"
        accessibilityState={{ expanded: open }}
        aria-haspopup="dialog"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          s.trigger,
          compact && s.compact,
          pressed && s.pressed,
        ]}
      >
        <View style={s.avatar}>
          <Text style={s.initials}>{initials || "TM"}</Text>
        </View>
        {!compact ? (
          <View style={s.copy}>
            <Text numberOfLines={1} style={s.name}>
              {user.name}
            </Text>
            <Text style={s.role}>{role ? roleLabel[role] : "Minha conta"}</Text>
          </View>
        ) : null}
        <View style={{ transform: [{ rotate: "90deg" }] }}>
          <Icon name="chevron-right" size={14} color={colors.muted} />
        </View>
      </Pressable>
      {open ? (
        <EditorDialog
          title="Minha conta"
          pending={busy}
          onClose={() => setOpen(false)}
        >
          <View style={s.profile}>
            <View style={s.avatar}>
              <Text style={s.initials}>{initials || "TM"}</Text>
            </View>
            <View style={s.copy}>
              <Text style={s.name}>{user.name}</Text>
              <Text selectable style={s.email}>
                {user.email}
              </Text>
            </View>
          </View>
          <View style={s.section}>
            <Text style={s.sectionLabel}>
              {multiple ? "ACADEMIAS E ACESSOS" : "ACADEMIA ATUAL"}
            </Text>
            {academiesLoading ? (
              <Loading />
            ) : academiesError ? (
              <>
                <Notice message={academiesError.message} />
                <Button compact secondary onPress={reloadAcademies}>
                  Tentar novamente
                </Button>
              </>
            ) : options.length ? (
              <View
                accessibilityRole={multiple ? "radiogroup" : undefined}
                accessibilityLabel={multiple ? "Seus acessos" : undefined}
                style={{ gap: 10 }}
              >
                {options.map((option) => {
                  const current =
                    academy?.id === option.academy.id && role === option.role;
                  const content = (
                    <>
                      <Icon
                        name={option.role === "admin" ? "home" : "users"}
                        size={18}
                        color={current ? colors.primaryLight : colors.muted}
                      />
                      <View style={s.copy}>
                        <Text style={s.academyName}>{option.academy.name}</Text>
                        <Text style={s.role}>{roleLabel[option.role]}</Text>
                      </View>
                      {current ? (
                        <Badge label="Em uso" tone="brand" />
                      ) : (
                        <Icon
                          name="chevron-right"
                          size={16}
                          color={colors.muted}
                        />
                      )}
                    </>
                  );
                  return multiple ? (
                    <Pressable
                      key={option.academy.id + option.role}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: current, disabled: busy }}
                      disabled={busy}
                      accessibilityLabel={
                        option.academy.name +
                        ". " +
                        roleLabel[option.role] +
                        (current ? ". Em uso" : "")
                      }
                      onPress={() => choose(option)}
                      style={({ pressed }) => [
                        s.access,
                        current && s.current,
                        pressed && s.pressed,
                      ]}
                    >
                      {content}
                    </Pressable>
                  ) : (
                    <View
                      key={option.academy.id + option.role}
                      style={[s.access, s.current]}
                    >
                      {content}
                    </View>
                  );
                })}
              </View>
            ) : (
              <Label muted>
                Nenhum acesso disponível. Atualize os acessos para conferir.
              </Label>
            )}
            {multiple ? (
              <Label muted>
                Escolha a academia e a área que deseja acessar.
              </Label>
            ) : null}
            {!academiesLoading && !academiesError ? (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={reloadAcademies}
                style={s.refresh}
              >
                <Text style={s.refreshText}>Atualizar acessos</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={s.footer}>
            <Button
              compact
              secondary
              loading={busy}
              onPress={() => void signOut()}
            >
              Sair da conta
            </Button>
          </View>
        </EditorDialog>
      ) : null}
    </>
  );
}
const s = StyleSheet.create({
  trigger: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 2,
    minWidth: 0,
  },
  compact: { paddingHorizontal: 6, gap: 6 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: accents.brand.soft,
    borderWidth: 1,
    borderColor: accents.brand.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  initials: {
    color: colors.primaryLight,
    fontFamily: "Inter_700Bold",
    fontSize: 12,
  },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  name: {
    color: colors.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    lineHeight: 20,
  },
  role: {
    color: colors.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 17,
  },
  email: {
    color: colors.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 19,
  },
  profile: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingBottom: 4,
  },
  section: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: 18,
  },
  sectionLabel: {
    color: colors.muted,
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 1,
  },
  access: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 12,
  },
  current: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
  },
  academyName: {
    color: colors.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    lineHeight: 19,
  },
  refresh: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  refreshText: {
    color: colors.muted,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  footer: {
    alignItems: "flex-start",
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: 16,
  },
  pressed: { opacity: 0.65 },
});
