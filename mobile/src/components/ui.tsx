import React, { useCallback, useRef, useState } from "react";
import { Brand } from "./Brand";
import { FormScrollContext } from "./FormScrollContext";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  TextInputProps,
  StyleProp,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, accents, Accent } from "../theme";
import { Icon, IconName } from "./Icon";
import { SwipeNavigator, SwipeDirection, SwipePages } from "./SwipeNavigator";
export function Page({
  children,
  title,
  subtitle,
  action,
  header,
  titleAction,
  footer,
  onSwipe,
  swipePages,
  contentOnly = false,
  wide = false,
  sidebar,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  header?: React.ReactNode;
  titleAction?: React.ReactNode;
  footer?: React.ReactNode;
  onSwipe?: (direction: SwipeDirection) => void;
  swipePages?: SwipePages;
  contentOnly?: boolean;
  wide?: boolean;
  sidebar?: React.ReactNode;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const resetScroll = useCallback(
    () => scrollRef.current?.scrollTo({ y: 0, animated: false }),
    [],
  );
  const content = (
    <FormScrollContext.Provider value={resetScroll}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.page,
          header || contentOnly ? styles.appPage : null,
          wide && styles.widePage,
          !!sidebar && styles.desktopPage,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {!header && !contentOnly && !sidebar ? (
          <View style={styles.brand}>
            <Brand />
            {action ? (
              <View style={{ marginLeft: "auto" }}>{action}</View>
            ) : null}
          </View>
        ) : null}
        {title ? (
          <View style={styles.titleRow}>
            <Text
              accessibilityRole="header"
              style={[styles.title, { flex: 1 }]}
            >
              {title}
            </Text>
            {titleAction}
          </View>
        ) : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children}
      </ScrollView>
    </FormScrollContext.Provider>
  );
  if (contentOnly) return content;
  return (
    <SafeAreaView style={[styles.safe, { flexDirection: "row" }]}>
      {sidebar}
      <View style={{ flex: 1, minWidth: 0 }}>
        {header ? (
          <View style={[styles.appHeader, wide && styles.widePage]}>
            {header}
          </View>
        ) : null}
        <SwipeNavigator onSwipe={onSwipe} pages={swipePages}>
          {content}
        </SwipeNavigator>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
  onPress,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        style,
        pressed && { opacity: 0.78, transform: [{ scale: 0.985 }] },
      ]}
    >
      {children}
    </Pressable>
  );
}
export function Badge({
  label,
  tone = "mint",
}: {
  label: string;
  tone?: Accent;
}) {
  const accent = accents[tone];
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: accent.soft, borderColor: accent.border },
      ]}
    >
      <View
        style={{
          width: 5,
          height: 5,
          borderRadius: 3,
          backgroundColor: accent.color,
        }}
      />
      <Text
        style={{
          color: accent.color,
          fontFamily: "Inter_600SemiBold",
          fontSize: 11,
        }}
      >
        {label}
      </Text>
    </View>
  );
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
  return (
    <Text accessibilityRole="header" style={styles.heading}>
      {children}
    </Text>
  );
}
export function Field({
  label,
  style,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & { label: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          focused && {
            borderColor: colors.primary,
            backgroundColor: colors.surfaceRaised,
          },
          style,
        ]}
        autoCapitalize="none"
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
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
  compact = false,
  danger = false,
  icon,
}: {
  children: React.ReactNode;
  onPress: () => void;
  loading?: boolean;
  secondary?: boolean;
  disabled?: boolean;
  compact?: boolean;
  danger?: boolean;
  icon?: IconName;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        compact && styles.compactButton,
        danger && {
          backgroundColor: colors.danger,
          borderColor: colors.danger,
        },
        (pressed || disabled || loading) && { opacity: 0.6 },
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={
            danger
              ? colors.background
              : secondary
                ? colors.text
                : colors.onPrimary
          }
        />
      ) : (
        <View style={styles.buttonContent}>
          {icon ? (
            <Icon
              name={icon}
              size={18}
              color={
                danger
                  ? colors.background
                  : secondary
                    ? colors.text
                    : colors.onPrimary
              }
            />
          ) : null}
          <Text
            style={[
              styles.buttonText,
              compact && { fontSize: 13 },
              secondary && { color: colors.primaryLight },
              danger && { color: colors.background },
            ]}
          >
            {children}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
export function IconButton({
  icon,
  label,
  onPress,
  selected = false,
  disabled = false,
  expanded,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  expanded?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled, expanded }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        selected && {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        (pressed || disabled) && { opacity: 0.5 },
      ]}
    >
      <Icon
        name={icon}
        size={20}
        color={selected ? colors.onPrimary : colors.muted}
      />
    </Pressable>
  );
}
export function SearchBar({
  value,
  onChangeText,
  placeholder = "Buscar...",
  label,
  action,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  label: string;
  action?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.search, focused && { borderColor: colors.primary }]}>
      <Icon name="search" size={20} color={colors.muted} />
      <TextInput
        style={styles.searchInput}
        accessibilityLabel={label}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Limpar busca"
          onPress={() => onChangeText("")}
          style={styles.clearSearch}
        >
          <Icon name="close" size={16} color={colors.muted} />
        </Pressable>
      ) : null}
      {action}
    </View>
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
  tone = "brand",
}: {
  children: React.ReactNode;
  selected?: boolean;
  onPress?: () => void;
  tone?: Accent;
}) {
  const accent = accents[tone];
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityState={onPress ? { selected } : undefined}
      onPress={onPress}
      style={[
        styles.chip,
        selected && {
          backgroundColor: accent.soft,
          borderColor: accent.border,
        },
      ]}
    >
      <Text
        style={{
          color: selected ? accent.color : colors.muted,
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
      <Text
        style={{ color: accents.blue.color, fontFamily: "Inter_600SemiBold" }}
      >
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
  appHeader: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  appPage: { paddingHorizontal: 20, paddingTop: 24, gap: 20 },
  widePage: { maxWidth: 1440 },
  desktopPage: { padding: 32, paddingBottom: 48, gap: 24 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  footer: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  compactButton: { minHeight: 44, paddingVertical: 10, paddingHorizontal: 12 },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  iconButton: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 54,
    paddingLeft: 14,
    paddingRight: 5,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 52,
    color: colors.text,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  clearSearch: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 12,
  },
  title: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    color: colors.text,
    letterSpacing: -0.7,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.muted,
    fontFamily: "Inter_400Regular",
    marginTop: -8,
    marginBottom: 6,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 20,
    gap: 12,
  },
  heading: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: colors.text,
  },
  label: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
    fontFamily: "Inter_400Regular",
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    color: colors.text,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
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
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: colors.onPrimary,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
    flexShrink: 1,
  },
  notice: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
  },
  chip: {
    minHeight: 44,
    justifyContent: "center",
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
    backgroundColor: accents.blue.soft,
    borderWidth: 1,
    borderColor: accents.blue.border,
    alignItems: "center",
    justifyContent: "center",
  },
});
