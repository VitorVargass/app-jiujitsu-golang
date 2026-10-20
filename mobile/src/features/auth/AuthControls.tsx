import { ReactNode, Ref, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { Icon, IconName } from "../../components/Icon";
import { brand } from "../../theme/brand";

export function AuthField({
  label,
  icon,
  inputRef,
  trailing,
  ...props
}: TextInputProps & {
  label: string;
  icon: IconName;
  inputRef?: Ref<TextInput>;
  trailing?: ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.inputRow, focused && s.inputFocused]}>
        <Icon
          name={icon}
          size={19}
          color={focused ? brand.accent : brand.muted}
        />
        <TextInput
          ref={inputRef}
          accessibilityLabel={label}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          placeholderTextColor="#85858E"
          selectionColor={brand.accent}
          underlineColorAndroid="transparent"
          style={s.input}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {trailing}
      </View>
    </View>
  );
}
export function AuthAction({
  children,
  onPress,
  loading = false,
  disabled = false,
  secondary = false,
}: {
  children: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  secondary?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        s.action,
        secondary && s.secondary,
        focused && s.actionFocused,
        pressed && { opacity: 0.82 },
        (disabled || loading) && { opacity: 0.65 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={brand.onAccent} size="small" />
      ) : null}
      <Text style={[s.actionText, secondary && { color: "#EDF1F4" }]}>
        {children}
      </Text>
      {!loading && !secondary ? (
        <Icon name="arrow-right" size={20} color={brand.onAccent} />
      ) : null}
    </Pressable>
  );
}
export const authControlStyles = StyleSheet.create({
  eye: {
    width: 44,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
});
const s = StyleSheet.create({
  field: { gap: 9 },
  label: { color: "#D7DDE2", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingLeft: 16,
    paddingRight: 5,
    borderWidth: 1,
    borderColor: brand.border,
    borderRadius: 14,
    backgroundColor: brand.background,
  },
  inputFocused: { borderColor: brand.accentLight, backgroundColor: "#211619" },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    paddingVertical: 14,
    paddingRight: 10,
    color: "#F1F4F6",
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    outlineWidth: 0,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    minHeight: 56,
    paddingVertical: 15,
    paddingHorizontal: 18,
    backgroundColor: brand.accent,
    borderWidth: 2,
    borderColor: brand.accent,
    borderRadius: 14,
  },
  actionText: {
    color: brand.onAccent,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    lineHeight: 22,
    flexShrink: 1,
    textAlign: "center",
  },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: brand.border,
    minHeight: 50,
    paddingVertical: 12,
  },
  actionFocused: { borderColor: brand.accentLight },
});
