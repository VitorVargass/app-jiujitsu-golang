import { useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { Button, Heading, Label, Notice } from "../../components/ui";
import { colors } from "../../theme";

export function StudentNumberCard({
  name,
  academy,
  code,
  qrToken,
}: {
  name: string;
  academy: string;
  code: string;
  qrToken: string;
}) {
  const { width } = useWindowDimensions();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function copy() {
    setError("");
    setMessage("");
    try {
      const copied = await Clipboard.setStringAsync(
        "Aluno: " +
          name +
          "\nAcademia: " +
          academy +
          "\nNúmero do aluno: " +
          code,
      );
      if (copied)
        setMessage("Identificação copiada. Envie ao aluno ou responsável.");
      else setError("Não foi possível copiar. Você pode selecionar o número.");
    } catch {
      setError("Não foi possível copiar. Você pode selecionar o número.");
    }
  }
  return (
    <View style={s.card}>
      <View style={s.qr}>
        <QRCode
          value={qrToken}
          size={Math.max(100, Math.min(190, width - 140))}
          color="black"
          backgroundColor="white"
        />
      </View>
      <View style={s.number}>
        <Label muted>Número do aluno</Label>
        <Text
          selectable
          accessibilityLabel={"Número do aluno: " + code.split("").join(" ")}
          style={s.code}
        >
          {code}
        </Text>
      </View>
      <Heading>{name}</Heading>
      <Label muted>{academy}</Label>
      <Label muted>
        Digite os 5 números ou apresente este QR no tablet da academia.
      </Label>
      <Button compact secondary onPress={() => void copy()}>
        Copiar identificação
      </Button>
      <Label muted>
        O responsável pode salvar uma captura deste cartão para a criança.
      </Label>
      <Notice success message={message} />
      <Notice message={error} />
    </View>
  );
}
const s = StyleSheet.create({
  card: { alignItems: "center", gap: 12 },
  qr: { backgroundColor: "white", padding: 20, borderRadius: 16 },
  number: { alignItems: "center", gap: 5 },
  code: {
    fontFamily: "Inter_700Bold",
    fontSize: 40,
    letterSpacing: 6,
    color: colors.text,
  },
});
