import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, type Href } from "expo-router";
import { Icon, type IconName } from "../../components/Icon";
import { Button, Chip, Notice, Row } from "../../components/ui";
import { useSession } from "../../services/session";
import {
  useTheme,
  useThemedStyles,
  type AppearancePreference,
} from "../../theme/ThemeProvider";
import { createThemedStyles, roleLabel } from "../../theme";
import { AcademyShell, PersonalGate } from "../shared/AcademyShell";

type MenuItem = {
  title: string;
  icon: IconName;
  route: Href;
};

const sections: { title: string; items: MenuItem[] }[] = [
  {
    title: "Academia",
    items: [
      {
        title: "Histórico da academia",
        icon: "calendar",
        route: "/academy-history",
      },
      { title: "Check-in da academia", icon: "tablet", route: "/devices" },
      {
        title: "Matrículas pelo link",
        icon: "qr",
        route: "/enrollment-settings",
      },
      { title: "Modalidades e planos", icon: "sliders", route: "/catalog" },
      { title: "Gestores", icon: "users", route: "/managers" },
      { title: "Nova academia", icon: "plus", route: "/create-academy" },
    ],
  },
  {
    title: "Financeiro",
    items: [
      { title: "Minha assinatura", icon: "wallet", route: "/subscription" },
      { title: "Recebimentos", icon: "wallet", route: "/receipts" },
    ],
  },
];

function MenuRow({
  title,
  icon,
  onPress,
  navigate = true,
}: {
  title: string;
  icon: IconName;
  onPress: () => void;
  navigate?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(themedStyles);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowIcon}>
        <Icon name={icon} size={19} color={colors.text} />
      </View>
      <Text style={styles.rowText}>{title}</Text>
      {navigate ? (
        <Icon name="chevron-right" size={16} color={colors.muted} />
      ) : null}
    </Pressable>
  );
}

function Content() {
  const styles = useThemedStyles(themedStyles);
  const { academy, role, session, logout } = useSession();
  const isManager =
    role === "admin" &&
    academy?.status === "active" &&
    academy.roles.includes("admin");
  const user = session?.kind === "user" ? session.user : null;
  const name = user?.name.trim() || user?.email || "Minha conta";
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <AcademyShell title="Mais" subtitle={null}>
      <View style={styles.menu}>
        <View style={styles.profile}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar} aria-hidden>
              <Text style={styles.initials}>{initials}</Text>
            </View>
            <View style={styles.profileDetails}>
              <View style={styles.status}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>
                  {role ? roleLabel[role] : "Minha conta"}
                </Text>
              </View>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.academy}>{academy?.name}</Text>
            </View>
          </View>
          {isManager ? (
            <Button secondary onPress={() => router.push("/participation")}>
              Minha participação
            </Button>
          ) : null}
        </View>

        <AppearanceSection />
        {isManager
          ? sections.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                  {section.title}
                </Text>
                <View style={styles.group}>
                  {section.items.map((item, index) => (
                    <View key={item.route.toString()}>
                      {index > 0 ? <View style={styles.divider} /> : null}
                      <MenuRow
                        title={item.title}
                        icon={item.icon}
                        onPress={() => router.push(item.route)}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ))
          : null}

        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Privacidade
          </Text>
          <View style={styles.group}>
            <MenuRow
              title="Privacidade e dados"
              icon="lock"
              onPress={() => router.push("/privacy")}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Conta
          </Text>
          <View style={styles.group}>
            <MenuRow
              title="Sair da conta"
              icon="arrow-right"
              onPress={() => void logout()}
              navigate={false}
            />
          </View>
        </View>
      </View>
    </AcademyShell>
  );
}

const appearanceOptions = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
] as const;

function AppearanceSection() {
  const styles = useThemedStyles(themedStyles);
  const { preference, setPreference } = useTheme();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function choose(value: AppearancePreference) {
    setSaving(true);
    setError("");
    try {
      await setPreference(value);
    } catch {
      setError("Não foi possível salvar a aparência. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        Aparência
      </Text>
      <View style={[styles.group, styles.appearance]}>
        <Row>
          {appearanceOptions.map(({ value, label }) => (
            <Chip
              key={value}
              selected={preference === value}
              onPress={saving ? undefined : () => void choose(value)}
            >
              {label}
            </Chip>
          ))}
        </Row>
        {error ? <Notice message={error} /> : null}
      </View>
    </View>
  );
}

export default function MoreScreen() {
  return (
    <PersonalGate>
      <Content />
    </PersonalGate>
  );
}

const themedStyles = createThemedStyles(({ accents, colors }) => ({
  menu: {
    width: "100%",
    maxWidth: 560,
    gap: 24,
  },
  profile: {
    gap: 16,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: accents.brand.soft,
    borderWidth: 1,
    borderColor: accents.brand.border,
  },
  initials: {
    color: colors.primaryLight,
    fontFamily: "Inter_700Bold",
    fontSize: 20,
  },
  profileDetails: {
    flex: 1,
    gap: 4,
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  statusText: {
    color: colors.success,
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  name: {
    color: colors.text,
    fontFamily: "Inter_700Bold",
    fontSize: 21,
  },
  academy: {
    color: colors.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  section: {
    gap: 9,
  },
  sectionTitle: {
    paddingHorizontal: 4,
    color: colors.muted,
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  group: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  appearance: { padding: 12, gap: 10 },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 14,
    backgroundColor: colors.border,
  },
  row: {
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pressed: {
    backgroundColor: colors.surfaceRaised,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  rowText: {
    flex: 1,
    color: colors.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
}));
