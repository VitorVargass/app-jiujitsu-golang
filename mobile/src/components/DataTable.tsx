import { ReactNode } from "react";
import {
  GestureResponderEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors } from "../theme";

export type TableColumn<T> = {
  key: string;
  label: string;
  flex?: number;
  render: (item: T) => ReactNode;
};
/** Paginated data comes from the owning screen; this component never fetches. */
export function DataTable<T>({
  label,
  columns,
  items,
  itemKey,
  onRowPress,
}: {
  label: string;
  columns: TableColumn<T>[];
  items: T[];
  itemKey: (item: T) => string;
  onRowPress?: (item: T) => void;
}) {
  return (
    <View style={s.frame}>
      <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
        <View role="table" accessibilityLabel={label} style={s.table}>
          <View role="row" style={[s.row, s.header]}>
            {columns.map((c) => (
              <View
                key={c.key}
                role="columnheader"
                style={[s.cell, { flex: c.flex ?? 1 }]}
              >
                <Text style={s.heading}>{c.label}</Text>
              </View>
            ))}
          </View>
          {items.map((item) => {
            const cells = columns.map((c) => (
              <View
                key={c.key}
                role="cell"
                style={[s.cell, { flex: c.flex ?? 1 }]}
              >
                {c.render(item)}
              </View>
            ));
            if (!onRowPress)
              return (
                <View key={itemKey(item)} role="row" style={s.row}>
                  {cells}
                </View>
              );
            function open(event: GestureResponderEvent) {
              if (event.defaultPrevented) return;
              // Nested links/actions keep their own behavior; text selection does not navigate.
              const target = event.target as unknown;
              if (
                Platform.OS === "web" &&
                typeof Element !== "undefined" &&
                target instanceof Element
              ) {
                if (
                  target.closest(
                    'a,button,input,textarea,select,[role="button"],[role="link"],[role="checkbox"],[role="switch"],[role="radio"],[contenteditable="true"]',
                  )
                )
                  return;
                if (window.getSelection()?.toString()) return;
              }
              onRowPress?.(item);
            }
            return (
              <Pressable
                key={itemKey(item)}
                role="row"
                tabIndex={-1}
                onPress={open}
                style={({ pressed, hovered }) => [
                  s.row,
                  (pressed || hovered) && s.highlight,
                ]}
              >
                {cells}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  frame: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  table: { minWidth: 640, flex: 1 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    minHeight: 78,
    alignItems: "center",
    paddingHorizontal: 18,
    gap: 16,
  },
  header: { minHeight: 48, backgroundColor: colors.surfaceRaised },
  highlight: { backgroundColor: colors.surfaceRaised },
  cell: { minWidth: 0, paddingVertical: 12, gap: 5 },
  heading: {
    color: colors.muted,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 17,
  },
});
