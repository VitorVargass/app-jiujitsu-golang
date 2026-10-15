import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Button, Label } from "./ui";
import type { BeltOption } from "../types/billing";
import { colors } from "../theme";

export function BeltSwatch({ colors: bands }: { colors: readonly string[] }) {
  return (
    <View style={styles.swatch}>
      {bands.map((color, index) => (
        <View key={index} style={{ flex: 1, backgroundColor: color }} />
      ))}
      <View style={styles.tip} />
    </View>
  );
}
export function BeltPicker({
  modality,
  options,
  value,
  onChange,
}: {
  modality: string;
  options: BeltOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const window = useWindowDimensions();
  const selected = options.find((o) => o.label === value);
  if (!options.length && !value)
    return <Label muted>Esta modalidade não utiliza faixas.</Label>;
  const choices =
    selected || !value
      ? options
      : [...options, { label: value, colors: ["#929292"] }];
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={"Faixa em " + modality}
        onPress={() => setOpen(true)}
        style={styles.trigger}
      >
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.hint}>GRADUAÇÃO</Text>
          <Text style={styles.label}>{value || "Selecionar faixa"}</Text>
        </View>
        {value ? (
          <BeltSwatch colors={selected?.colors ?? ["#929292"]} />
        ) : (
          <Text style={styles.arrow}>›</Text>
        )}
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.backdrop}>
          <View
            accessibilityViewIsModal
            style={[styles.sheet, { maxHeight: window.height * 0.85 }]}
          >
            <Text accessibilityRole="header" style={styles.heading}>
              Faixa em {modality}
            </Text>
            <ScrollView
              contentContainerStyle={styles.options}
              keyboardShouldPersistTaps="handled"
            >
              {choices.map((option) => (
                <Pressable
                  key={option.label}
                  accessibilityRole="button"
                  accessibilityLabel={"Selecionar " + option.label}
                  accessibilityState={{ selected: value === option.label }}
                  onPress={() => {
                    onChange(option.label);
                    setOpen(false);
                  }}
                  style={[
                    styles.option,
                    value === option.label && styles.selected,
                  ]}
                >
                  <BeltSwatch colors={option.colors} />
                  <Text style={styles.optionLabel}>
                    {option.label.replace(/^Faixa /, "")}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Button secondary onPress={() => setOpen(false)}>
              Fechar seleção
            </Button>
          </View>
        </View>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  trigger: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    minHeight: 76,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  hint: {
    fontFamily: "Lato_700Bold",
    color: colors.muted,
    fontSize: 10,
    letterSpacing: 1,
  },
  label: { color: colors.text, fontFamily: "Lato_700Bold", fontSize: 14 },
  arrow: { color: colors.text, fontSize: 28 },
  swatch: {
    width: 68,
    height: 19,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#707070",
    overflow: "hidden",
    flexDirection: "column",
  },
  tip: {
    position: "absolute",
    right: 8,
    top: 0,
    bottom: 0,
    width: 9,
    backgroundColor: "#080808",
    borderLeftWidth: 1,
    borderLeftColor: "#777",
    borderRightWidth: 1,
    borderRightColor: "#777",
  },
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  sheet: {
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: 20,
    gap: 20,
  },
  heading: {
    color: colors.text,
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 18,
  },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 8 },
  option: {
    width: "30%",
    flexGrow: 1,
    minWidth: 80,
    padding: 10,
    minHeight: 74,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  selected: { borderColor: colors.text, backgroundColor: "#303030" },
  optionLabel: {
    color: colors.text,
    fontFamily: "Lato_400Regular",
    fontSize: 11,
    textAlign: "center",
  },
});
