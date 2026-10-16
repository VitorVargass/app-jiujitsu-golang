import { ReactNode, useContext, useState } from "react";
import { Keyboard, Text, View, StyleSheet } from "react-native";
import { Button, Notice } from "./ui";
import { FormScrollContext } from "./FormScrollContext";
import { colors } from "../theme";

export function FormWizard({
  steps,
  children,
  validate,
  onSubmit,
  onCancel,
  pending = false,
  error,
  submitLabel = "Salvar",
  initialStep = 0,
}: {
  steps: readonly string[];
  children: (step: number) => ReactNode;
  validate: (step: number) => string | undefined;
  onSubmit: () => void;
  onCancel?: () => void;
  pending?: boolean;
  error?: string;
  submitLabel?: string;
  initialStep?: number;
}) {
  const [step, setStep] = useState(initialStep);
  const [message, setMessage] = useState("");
  const resetScroll = useContext(FormScrollContext);
  function change(next: number) {
    Keyboard.dismiss();
    setMessage("");
    setStep(next);
    resetScroll();
  }
  function advance() {
    const last = step === steps.length - 1;
    const indexes = last ? steps.map((_, i) => i) : [step];
    for (const index of indexes) {
      let problem: string | undefined;
      try {
        problem = validate(index);
      } catch (cause) {
        problem =
          cause instanceof Error
            ? cause.message
            : "Confira os dados desta etapa.";
      }
      if (problem) {
        setMessage(problem);
        if (index !== step) {
          setStep(index);
          resetScroll();
        }
        return;
      }
    }
    if (last) {
      setMessage("");
      Keyboard.dismiss();
      onSubmit();
    } else change(step + 1);
  }
  return (
    <View style={styles.root}>
      <View
        accessible
        accessibilityLabel={
          "Etapa " + (step + 1) + " de " + steps.length + ": " + steps[step]
        }
        style={styles.progress}
      >
        <View style={styles.bars}>
          {steps.map((name, index) => (
            <View
              key={name}
              style={[styles.bar, index <= step && styles.reached]}
            />
          ))}
        </View>
        <Text style={styles.counter}>
          ETAPA {step + 1} DE {steps.length}
        </Text>
        <Text accessibilityRole="header" style={styles.title}>
          {steps[step]}
        </Text>
      </View>
      <View key={step} style={styles.body}>
        {children(step)}
      </View>
      <Notice message={message || error} />
      <View style={styles.actions}>
        {step > 0 ? (
          <View style={styles.action}>
            <Button
              secondary
              disabled={pending}
              onPress={() => change(step - 1)}
            >
              Anterior
            </Button>
          </View>
        ) : onCancel ? (
          <View style={styles.action}>
            <Button secondary disabled={pending} onPress={onCancel}>
              Cancelar
            </Button>
          </View>
        ) : null}
        <View style={styles.action}>
          <Button loading={pending} onPress={advance}>
            {step === steps.length - 1 ? submitLabel : "Continuar"}
          </Button>
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { gap: 20 },
  progress: { gap: 10 },
  bars: { flexDirection: "row", gap: 6 },
  bar: { height: 4, flex: 1, borderRadius: 4, backgroundColor: colors.border },
  reached: { backgroundColor: colors.primary },
  counter: {
    fontFamily: "Lato_700Bold",
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 1.2,
  },
  title: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 22,
    color: colors.text,
  },
  body: { gap: 16 },
  actions: { flexDirection: "row", gap: 12 },
  action: { flex: 1, minWidth: 0 },
});
