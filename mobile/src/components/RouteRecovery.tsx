import { useState } from "react";
import { router, type ErrorBoundaryProps } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";


// Avoid session, query and safe-area providers: one of them may have failed.
export function RouteRecovery({
  retry,
  canNavigate = false,
}: ErrorBoundaryProps & { canNavigate?: boolean }) {
  const { colors } = useTheme();
  const [pending, setPending] = useState(false);
  async function recover() {
    setPending(true);
    try {
      await retry();
    } catch {
      // A repeated render failure stays in this recovery screen.
    } finally {
      setPending(false);
    }
  }
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        padding: 24,
        gap: 20,
        backgroundColor: colors.background,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 24 }}
      >
        Não foi possível abrir esta tela
      </Text>
      <Text style={{ color: colors.muted }}>
        Tente carregar novamente. Se estava salvando ou pagando, confira o
        resultado antes de repetir a operação.
      </Text>
      <Pressable
        accessibilityRole="button"
        disabled={pending}
        onPress={() => void recover()}
        style={{
          padding: 16,
          borderRadius: 12,
          backgroundColor: colors.primary,
        }}
      >
        <Text style={{ color: colors.onPrimary }}>
          {pending ? "Tentando novamente…" : "Tentar novamente"}
        </Text>
      </Pressable>
      {canNavigate ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace("/entry")}
          style={{ padding: 16 }}
        >
          <Text style={{ color: colors.text }}>
            Voltar ao acesso do sistema
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ScreenRecovery(props: ErrorBoundaryProps) {
  return <RouteRecovery {...props} canNavigate />;
}
