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
import { colors, accents } from "../theme";
import { degreeLabel, rankLabel } from "../types/graduation";

export function BeltSwatch({
  colors: bands,
  degrees = 0,
}: {
  colors: readonly string[];
  degrees?: number;
}) {
  const count = Math.min(4, Math.max(0, Math.floor(degrees)));
  return (
    <View style={styles.swatch}>
      {bands.map((color, index) => (
        <View key={index} style={{ flex: 1, backgroundColor: color }} />
      ))}
      <View style={styles.tip}>
        {Array.from({ length: count }, (_, index) => (
          <View key={index} style={styles.stripe} />
        ))}
      </View>
    </View>
  );
}
export function BeltPicker({
  modality,
  options,
  value,
  degrees = 0,
  onChange,
}: {
  modality: string;
  options: BeltOption[];
  value: string;
  degrees?: number;
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
          <Text style={styles.label}>
            {value ? rankLabel(value, degrees) : "Selecionar faixa"}
          </Text>
        </View>
        {value ? (
          <BeltSwatch
            colors={selected?.colors ?? ["#929292"]}
            degrees={degrees}
          />
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
export function DegreePicker({
  modality,
  value,
  onChange,
}: {
  modality: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <Text style={styles.hint}>GRAUS DA FAIXA</Text>
        <Text style={styles.degreeCaption}>{degreeLabel(value)}</Text>
      </View>
      <View style={styles.degreeOptions}>
        {[0, 1, 2, 3, 4].map((degrees) => (
          <Pressable
            key={degrees}
            accessibilityRole="button"
            accessibilityLabel={
              "Selecionar " +
              degreeLabel(degrees).toLowerCase() +
              " em " +
              modality
            }
            accessibilityState={{ selected: value === degrees }}
            onPress={() => onChange(degrees)}
            style={({ pressed }) => [
              styles.degreeOption,
              value === degrees && styles.degreeSelected,
              pressed && { opacity: 0.65 },
            ]}
          >
            <Text
              style={[
                styles.degreeNumber,
                value === degrees && { color: colors.primary },
              ]}
            >
              {degrees}
            </Text>
            <View style={styles.degreePreview} pointerEvents="none">
              {Array.from({ length: degrees }, (_, i) => (
                <View key={i} style={styles.degreeTick} />
              ))}
            </View>
          </Pressable>
        ))}
      </View>
      <Text style={styles.degreeHelp}>
        0 = sem grau. Ao trocar de faixa, os graus voltam para zero.
      </Text>
    </View>
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
    fontFamily: "Inter_600SemiBold",
    color: colors.muted,
    fontSize: 10,
    letterSpacing: 1,
  },
  label: { color: colors.text, fontFamily: "Inter_600SemiBold", fontSize: 14 },
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
    width: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    backgroundColor: "#080808",
    borderLeftWidth: 1,
    borderLeftColor: "#777",
    borderRightWidth: 1,
    borderRightColor: "#777",
  },
  stripe: { width: 2, height: 14, backgroundColor: "#FFFFFF" },
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
    fontFamily: "Inter_600SemiBold",
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
  selected: { borderColor: colors.primary, backgroundColor: accents.brand.soft },
  degreeOptions: { flexDirection: "row", gap: 6 },
  degreeOption: {
    flex: 1,
    minWidth: 36,
    minHeight: 58,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  degreeSelected: {
    borderColor: colors.primary,
    backgroundColor: accents.brand.soft,
  },
  degreeNumber: {
    color: colors.muted,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  degreeCaption: {
    color: colors.primary,
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
  degreeHelp: {
    color: colors.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 17,
  },
  degreePreview: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    width: 26,
    height: 8,
    borderRadius: 2,
    backgroundColor: "#080808",
  },
  degreeTick: { width: 2, height: 6, backgroundColor: "#FFFFFF" },
  optionLabel: {
    color: colors.text,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    textAlign: "center",
  },
});
