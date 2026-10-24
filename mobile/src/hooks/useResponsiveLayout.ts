import { useWindowDimensions } from "react-native";

export const layoutBreakpoints = { intermediate: 768, wide: 1024 } as const;
export function layoutForWidth(width: number) {
  return width >= layoutBreakpoints.wide
    ? "wide"
    : width >= layoutBreakpoints.intermediate
      ? "intermediate"
      : "compact";
}
export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const size = layoutForWidth(width);
  return {
    width,
    height,
    size,
    isWide: size === "wide",
    isCompact: size === "compact",
  };
}
