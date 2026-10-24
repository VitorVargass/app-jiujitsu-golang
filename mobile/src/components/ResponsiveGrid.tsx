import { Children, ReactNode } from "react";
import { View } from "react-native";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";

/** Stable child containers preserve form state while the viewport changes. */
export function ResponsiveGrid({
  children,
  columns = 2,
}: {
  children: ReactNode;
  columns?: 2 | 3;
}) {
  const { isWide } = useResponsiveLayout();
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 20,
        alignItems: "flex-start",
      }}
    >
      {Children.toArray(children).map((child, index) => (
        <View
          key={(child as { key?: string }).key ?? index}
          style={{
            minWidth: 0,
            flexGrow: 1,
            flexBasis: isWide ? (columns === 3 ? "30%" : "46%") : "100%",
            gap: 20,
          }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}
