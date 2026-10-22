import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { CameraType } from "expo-camera";
import { EditorDialog } from "../../components/EditorDialog";
import { Icon } from "../../components/Icon";
import { Button, Label, Loading, Notice } from "../../components/ui";
import { colors, accents } from "../../theme";

export function KioskCamera({
  onRead,
  onClose,
  disabled,
}: {
  onRead: (data: string) => void;
  onClose: () => void;
  disabled: boolean;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [facing, setFacing] = useState<CameraType>("back");
  async function allowCamera() {
    setRequesting(true);
    setError("");
    try {
      await requestPermission();
    } catch {
      setError(
        "Não foi possível acessar a câmera. Você pode confirmar pelos 5 números do aluno.",
      );
    } finally {
      setRequesting(false);
    }
  }
  return (
    <EditorDialog
      title="Ler QR Code"
      onClose={onClose}
      footer={
        <Button compact secondary onPress={onClose}>
          Voltar ao check-in
        </Button>
      }
    >
      {disabled ? (
        <Label muted>
          O horário da aula mudou. Volte e confira a aula antes de continuar.
        </Label>
      ) : !permission ? (
        <Loading />
      ) : permission.granted ? (
        <>
          <Text style={s.instruction}>
            Aponte a câmera para o QR Code do aluno.
          </Text>
          <View style={s.preview}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing={facing}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onMountError={() =>
                setError(
                  "Não foi possível iniciar esta câmera. Tente trocar de câmera ou use o número do aluno.",
                )
              }
              onBarcodeScanned={({ data }) => {
                if (!data.startsWith("tatame:")) {
                  setError(
                    "QR Code inválido. Apresente o código do aluno no TatameMix.",
                  );
                  return;
                }
                onRead(data);
              }}
            />
            <View pointerEvents="none" style={s.guide}>
              <View style={s.frame} />
            </View>
          </View>
          <View style={s.cameraControls}>
            <Text style={s.cameraLabel} accessibilityLiveRegion="polite">
              {facing === "back" ? "Câmera traseira" : "Câmera frontal"}
            </Text>
            <Button
              compact
              secondary
              icon="swap"
              onPress={() => {
                setError("");
                setFacing((current) => (current === "back" ? "front" : "back"));
              }}
            >
              Trocar câmera
            </Button>
          </View>
        </>
      ) : (
        <View style={s.permission}>
          <View style={s.icon}>
            <Icon name="qr" size={30} color={colors.primaryLight} />
          </View>
          <Text style={s.title}>Permita o uso da câmera</Text>
          <Text style={s.instruction}>
            {permission.canAskAgain
              ? "Ela será usada para ler o QR Code do aluno."
              : "O acesso à câmera está bloqueado. Libere a permissão nas configurações do navegador ou do aparelho, ou use o número do aluno."}
          </Text>
          {permission.canAskAgain ? (
            <Button
              compact
              loading={requesting}
              onPress={() => void allowCamera()}
            >
              Permitir câmera
            </Button>
          ) : null}
        </View>
      )}
      <Notice message={error} />
    </EditorDialog>
  );
}
const s = StyleSheet.create({
  cameraControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  cameraLabel: {
    fontFamily: "Inter_400Regular",
    color: colors.muted,
    fontSize: 12,
    lineHeight: 20,
  },
  preview: {
    aspectRatio: 1,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.background,
  },
  guide: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    width: "65%",
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    borderRadius: 18,
    backgroundColor: "transparent",
  },
  permission: { alignItems: "center", gap: 18, paddingVertical: 12 },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: accents.brand.soft,
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    color: colors.text,
    fontSize: 18,
    textAlign: "center",
  },
  instruction: {
    fontFamily: "Inter_400Regular",
    color: colors.muted,
    fontSize: 13,
    lineHeight: 21,
    textAlign: "center",
  },
});
