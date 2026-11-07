import { useState } from "react";
import { Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Button, Label, Notice } from "./ui";
import { useTheme } from "../theme/ThemeProvider";

export function CopyButton({
  value,
  label = "Copiar",
}: {
  value: string;
  label?: string;
}) {
  const [copying, setCopying] = useState(false);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function copy() {
    setCopying(true);
    setError("");
    setCopiedValue(null);
    try {
      if (!(await Clipboard.setStringAsync(value))) {
        throw new Error("clipboard_unavailable");
      }
      setCopiedValue(value);
    } catch {
      setError(
        "Não foi possível copiar. Selecione o texto e copie manualmente.",
      );
    } finally {
      setCopying(false);
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={{ alignItems: "flex-start" }}>
        <Button
          compact
          secondary
          icon={copiedValue === value ? "check" : "copy"}
          loading={copying}
          disabled={!value}
          onPress={() => void copy()}
        >
          {copiedValue === value ? "Copiado!" : label}
        </Button>
      </View>
      {copiedValue === value ? (
        <View accessibilityLiveRegion="polite">
          <Label muted>Copiado. Pronto para colar e enviar.</Label>
        </View>
      ) : null}
      {error ? <Notice message={error} /> : null}
    </View>
  );
}

export function CopyField({
  label,
  value,
  buttonLabel = "Copiar link",
}: {
  label: string;
  value: string;
  buttonLabel?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ width: "100%", gap: 10 }}>
      <Label muted>{label}</Label>
      <Text
        selectable
        style={{
          color: colors.text,
          fontFamily: "Inter_400Regular",
          fontSize: 13,
          lineHeight: 20,
          padding: 12,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
        }}
      >
        {value}
      </Text>
      <CopyButton key={value} value={value} label={buttonLabel} />
    </View>
  );
}
