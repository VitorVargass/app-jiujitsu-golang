import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EditorDialog } from "./EditorDialog";
import { Button, IconButton, Label } from "./ui";
import { Icon } from "./Icon";
import { colors, accents } from "../theme";
import { monthNow } from "../types/billing";
import { formatMonth, monthNames } from "../types/month";

function PickerField({
  label,
  value,
  onPress,
  disabled = false,
}: {
  label: string;
  value: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Label>{label}</Label>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label + ": " + value}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={[s.field, disabled && { opacity: 0.6 }]}
      >
        <Icon name="calendar" size={20} color={colors.primaryLight} />
        <Text style={s.value}>{value}</Text>
        {!disabled ? (
          <Icon name="chevron-right" size={16} color={colors.muted} />
        ) : null}
      </Pressable>
    </View>
  );
}
export function MonthPicker({
  label,
  value,
  onChange,
  disabled = false,
  allowClear = false,
  min = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  allowClear?: boolean;
  min?: string;
}) {
  const [open, setOpen] = useState(false),
    [year, setYear] = useState(Number((value || monthNow()).slice(0, 4)));
  function choose(v: string) {
    onChange(v);
    setOpen(false);
  }
  return (
    <>
      <PickerField
        label={label}
        value={
          value
            ? formatMonth(value)
            : allowClear
              ? "Todos os meses"
              : "Selecionar mês"
        }
        disabled={disabled}
        onPress={() => {
          setYear(Number((value || monthNow()).slice(0, 4)));
          setOpen(true);
        }}
      />
      {open ? (
        <EditorDialog title={label} onClose={() => setOpen(false)}>
          <View style={s.year}>
            <IconButton
              icon="chevron-left"
              label="Ano anterior"
              onPress={() => setYear((v) => Math.max(1900, v - 1))}
            />
            <Text style={s.yearText}>{year}</Text>
            <IconButton
              icon="chevron-right"
              label="Próximo ano"
              onPress={() => setYear((v) => Math.min(9999, v + 1))}
            />
          </View>
          <View style={s.grid}>
            {monthNames.map((name, index) => {
              const month = year + "-" + String(index + 1).padStart(2, "0"),
                unavailable = !!min && month < min;
              return (
                <Pressable
                  key={name}
                  accessibilityRole="button"
                  accessibilityLabel={name + " de " + year}
                  accessibilityState={{
                    selected: month === value,
                    disabled: unavailable,
                  }}
                  disabled={unavailable}
                  onPress={() => choose(month)}
                  style={[
                    s.month,
                    month === value && s.selected,
                    unavailable && { opacity: 0.3 },
                  ]}
                >
                  <Text style={s.monthText}>{name.slice(0, 3)}</Text>
                </Pressable>
              );
            })}
          </View>
          {allowClear ? (
            <Button secondary compact onPress={() => choose("")}>
              Todos os meses
            </Button>
          ) : null}
        </EditorDialog>
      ) : null}
    </>
  );
}
export function DueDayPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PickerField
        label="Dia do vencimento"
        value={"Todo dia " + value}
        disabled={disabled}
        onPress={() => setOpen(true)}
      />
      {open ? (
        <EditorDialog title="Dia do vencimento" onClose={() => setOpen(false)}>
          <Label muted>
            Escolha o dia de cada mês. Nos meses mais curtos, usamos o último
            dia disponível.
          </Label>
          <View style={s.grid}>
            {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((day) => (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityLabel={"Vencer no dia " + day}
                accessibilityState={{ selected: day === value }}
                onPress={() => {
                  onChange(day);
                  setOpen(false);
                }}
                style={[s.day, day === value && s.selected]}
              >
                <Text style={s.monthText}>{day}</Text>
              </Pressable>
            ))}
          </View>
        </EditorDialog>
      ) : null}
    </>
  );
}
const s = StyleSheet.create({
  field: {
    minHeight: 54,
    padding: 14,
    gap: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
  },
  value: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  year: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  yearText: { fontSize: 22, color: colors.text, fontFamily: "Inter_700Bold" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  month: {
    width: "30%",
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  day: {
    width: "17%",
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  selected: {
    borderColor: accents.brand.color,
    backgroundColor: accents.brand.soft,
  },
  monthText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: colors.text,
  },
});
