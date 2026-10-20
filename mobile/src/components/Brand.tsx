import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { brand } from "../theme/brand";
import { brandMarkPaths } from "../theme/mark";

export function BrandGlyph({ color }: { color?: string }) {
  return (
    <>
      <Path d={brandMarkPaths.light} fill={color ?? brand.text} />
      <Path d={brandMarkPaths.accent} fill={color ?? brand.accent} />
    </>
  );
}
export function BrandMark({
  size = 36,
  color,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <BrandGlyph color={color} />
    </Svg>
  );
}
export function Brand({
  compact = false,
  caption = false,
}: {
  compact?: boolean;
  caption?: boolean;
}) {
  return (
    <View style={s.brand} accessible accessibilityLabel={brand.name}>
      <BrandMark size={compact ? 29 : 42} />
      <View style={{ gap: 5 }}>
        <Text style={[s.name, compact && s.compact]}>
          {brand.wordmark}
          <Text style={{ color: compact ? brand.accentLight : brand.accent }}>
            {brand.suffix}
          </Text>
        </Text>
        {caption ? <Text style={s.caption}>GESTÃO DE ACADEMIAS</Text> : null}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: {
    color: brand.text,
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    letterSpacing: -1,
  },
  compact: { fontSize: 19, letterSpacing: -0.6 },
  caption: {
    color: brand.muted,
    fontFamily: "Inter_600SemiBold",
    fontSize: 7,
    letterSpacing: 1.8,
  },
});
