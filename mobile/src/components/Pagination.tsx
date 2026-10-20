import { View, Text, StyleSheet } from "react-native";
import { IconButton } from "./ui";
import { colors } from "../theme";

export function Pagination({
  page,
  total,
  size = 25,
  onChange,
}: {
  page: number;
  total: number;
  size?: number;
  onChange: (n: number) => void;
}) {
  if (total <= size) return null;
  return (
    <View style={styles.row}>
      <IconButton
        icon="chevron-left"
        label="Página anterior"
        disabled={page <= 1}
        onPress={() => onChange(page - 1)}
      />
      <Text style={styles.text}>
        Página {page} de {Math.ceil(total / size)}
      </Text>
      <IconButton
        icon="chevron-right"
        label="Próxima página"
        disabled={page * size >= total}
        onPress={() => onChange(page + 1)}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  text: { fontFamily: "Inter_400Regular", color: colors.muted, fontSize: 13 },
});
