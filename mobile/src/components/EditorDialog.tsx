import { ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "./Icon";
import { colors } from "../theme";

export function EditorDialog({
  title,
  onClose,
  children,
  footer,
  pending = false,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  pending?: boolean;
  wide?: boolean;
}) {
  return (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={() => {
        if (!pending) onClose();
      }}
    >
      <SafeAreaView style={s.overlay}>
        <View
          accessibilityViewIsModal
          style={[s.panel, { maxWidth: wide ? 640 : 400 }]}
        >
          <View style={s.header}>
            <Text accessibilityRole="header" style={s.title}>
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fechar janela"
              disabled={pending}
              onPress={onClose}
              style={s.close}
            >
              <Icon name="close" size={20} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.content}
          >
            {children}
          </ScrollView>
          {footer ? <View style={s.footer}>{footer}</View> : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 12,
  },
  panel: {
    width: "100%",
    maxHeight: "94%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 18,
    paddingRight: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    gap: 12,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontFamily: "Inter_700Bold",
    fontSize: 18,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: 18, gap: 18 },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
});
