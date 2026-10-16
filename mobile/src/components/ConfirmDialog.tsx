import { Modal, ScrollView, View } from "react-native";
import { colors } from "../theme";
import { Button, Heading, Label, Notice } from "./ui";

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  pending,
  error,
  danger = false,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  pending?: boolean;
  error?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!pending) onCancel();
      }}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
          backgroundColor: "rgba(0,0,0,0.75)",
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: 440,
            maxHeight: "90%",
            borderRadius: 22,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: 24,
          }}
        >
          <ScrollView
            contentContainerStyle={{ gap: 18 }}
            keyboardShouldPersistTaps="handled"
          >
            <Heading>{title}</Heading>
            <Label>{message}</Label>
            <Notice message={error} />
            <Button danger={danger} loading={pending} onPress={onConfirm}>
              {confirmLabel}
            </Button>
            <Button secondary disabled={pending} onPress={onCancel}>
              Cancelar
            </Button>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
