import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme";
export function Page({
  children,
  title,
  subtitle,
  action,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <Text style={styles.logo}>◈</Text>
          <Text style={styles.brandText}>Tatame</Text>
          {action && <View style={{ marginLeft: "auto" }}>{action}</View>}
        </View>
        {title && <Text style={styles.title}>{title}</Text>}
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function Label({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <Text style={[styles.label, muted && { color: colors.muted }]}>
      {children}
    </Text>
  );
}
export function Heading({ children }: { children: React.ReactNode }) {
  return <Text style={styles.heading}>{children}</Text>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={styles.input}
        autoCapitalize="none"
        {...props}
      />
    </View>
  );
}
export function Button({
  children,
  onPress,
  loading = false,
  secondary = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onPress: () => void;
  loading?: boolean;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        (pressed || disabled || loading) && { opacity: 0.6 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            secondary && { color: colors.primaryLight },
          ]}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}
export function Notice({
  message,
  success = false,
}: {
  message?: string;
  success?: boolean;
}) {
  if (!message) return null;
  return (
    <View
      accessibilityRole="alert"
      style={[styles.notice, success && { borderColor: colors.success }]}
    >
      <Text
        style={{
          color: success ? colors.success : colors.danger,
          fontSize: 14,
          lineHeight: 21,
        }}
      >
        {message}
      </Text>
    </View>
  );
}
export function Loading() {
  return <ActivityIndicator style={{ padding: 32 }} color={colors.primary} />;
}
export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <Label muted>{children}</Label>
    </Card>
  );
}
export function Row({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      {children}
    </View>
  );
}
export function Chip({
  children,
  selected = false,
  onPress,
}: {
  children: React.ReactNode;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityState={onPress ? { selected } : undefined}
      onPress={onPress}
      style={[
        styles.chip,
        selected && {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
      ]}
    >
      <Text
        style={{
          color: selected ? colors.text : colors.muted,
          fontWeight: "600",
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}
export function Avatar({ name }: { name: string }) {
  return (
    <View style={styles.avatar}>
      <Text style={{ color: colors.text, fontWeight: "700" }}>
        {name
          .split(" ")
          .slice(0, 2)
          .map((x) => x[0])
          .join("")}
      </Text>
    </View>
  );
}
export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    padding: 24,
    gap: 18,
    paddingBottom: 40,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 12,
  },
  logo: { fontSize: 38, color: colors.primary },
  brandText: { fontSize: 24, fontWeight: "800", color: colors.text },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.7,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.muted,
    marginTop: -8,
    marginBottom: 6,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  heading: { fontSize: 18, fontWeight: "700", color: colors.text },
  label: { fontSize: 14, lineHeight: 22, color: colors.text },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    color: colors.text,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    minHeight: 52,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    minHeight: 50,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonText: { fontSize: 15, fontWeight: "700", color: colors.text },
  notice: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  avatar: {
    height: 44,
    width: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
});
