import { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, G, Line, Path, Rect } from "react-native-svg";
import { Brand, BrandGlyph, BrandMark } from "../../components/Brand";
import { Icon, IconName } from "../../components/Icon";
import { brand } from "../../theme/brand";

const features: { icon: IconName; title: string }[] = [
  { icon: "users", title: "Alunos" },
  { icon: "wallet", title: "Mensalidades" },
  { icon: "check-circle", title: "Presenças" },
];
function ArenaGraphic() {
  return (
    <View
      style={s.graphic}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height={210} viewBox="0 0 500 210" aria-hidden={true}>
        <Rect
          x="1"
          y="1"
          width="498"
          height="208"
          rx="22"
          fill="#141416"
          stroke="#333337"
        />
        {[70, 140, 210, 280, 350, 420].map((x) => (
          <Line key={x} x1={x} y1="1" x2={x} y2="209" stroke="#252528" />
        ))}
        {[52, 105, 158].map((y) => (
          <Line key={y} x1="1" y1={y} x2="499" y2={y} stroke="#252528" />
        ))}
        <Circle cx="250" cy="105" r="92" fill="none" stroke="#3D3033" />
        <Circle cx="250" cy="105" r="72" fill="#211619" stroke="#5D2A33" />
        <G transform="translate(202 55) scale(1.5)">
          <BrandGlyph />
        </G>
        <Path
          d="M25 39V25h14M461 25h14v14M25 171v14h14M461 185h14v-14"
          stroke={brand.accent}
          strokeWidth="2"
          fill="none"
        />
        <Circle cx="424" cy="105" r="4" fill={brand.accent} />
        <Circle cx="76" cy="105" r="4" fill={brand.accent} />
      </Svg>
    </View>
  );
}
export function AuthLayout({
  register,
  fromStudentLink,
  children,
}: {
  register: boolean;
  fromStudentLink: boolean;
  children: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= 1024;
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.fill}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : Platform.OS === "android"
              ? "height"
              : undefined
        }
      >
        <ScrollView
          style={s.fill}
          contentContainerStyle={[s.viewport, wide && s.viewportWide]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={[s.shell, wide && s.shellWide]}>
            <View style={[s.story, wide && s.storyWide]}>
              <Brand caption />
              {wide ? (
                <View style={s.hero}>
                  <View style={s.eyebrowRow}>
                    <View style={s.dot} />
                    <Text style={s.eyebrow}>PARA TODAS AS SUAS LUTAS</Text>
                  </View>
                  <Text accessibilityRole="header" style={s.heroTitle}>
                    Menos gestão,{"\n"}
                    <Text style={{ color: brand.accentLight }}>
                      mais tatame.
                    </Text>
                  </Text>
                  <Text style={s.heroDescription}>
                    Menos tempo na gestão. Mais tempo para o treino. Alunos,
                    mensalidades e presenças no mesmo lugar.
                  </Text>
                  <ArenaGraphic />
                  <View style={s.features}>
                    {features.map((f) => (
                      <View key={f.title} style={s.feature}>
                        <Icon name={f.icon} size={17} color={brand.accent} />
                        <Text style={s.featureText}>{f.title}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
            <View style={[s.form, wide && s.formWide]}>
              <View style={s.formHeading}>
                <View style={s.eyebrowRow}>
                  <View style={s.dot} />
                  <Text style={s.eyebrow}>
                    {register ? "COMECE SUA JORNADA" : "ACESSE SUA CONTA"}
                  </Text>
                </View>
                <Text accessibilityRole="header" style={s.title}>
                  {register
                    ? "Tudo começa\ncom a sua conta."
                    : "Bom te ver\nde novo."}
                </Text>
                <Text style={s.description}>
                  {register
                    ? fromStudentLink
                      ? "Use o e-mail do convite para continuar com sua academia."
                      : "Crie sua conta para acessar sua academia e seus treinos."
                    : "Entre com seu e-mail e senha para continuar."}
                </Text>
              </View>
              {children}
            </View>
          </View>
          <View style={s.signature}>
            <BrandMark size={14} color="#7A7A83" />
            <Text style={s.signatureText}>FEITO PARA QUEM VIVE A LUTA.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  fill: { flex: 1 },
  safe: { flex: 1, backgroundColor: brand.background },
  viewport: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  viewportWide: { paddingHorizontal: 48, paddingVertical: 40 },
  shell: { width: "100%", maxWidth: 1160, alignSelf: "center", gap: 28 },
  shellWide: { flexDirection: "row", gap: 80, alignItems: "center" },
  story: { width: "100%", maxWidth: 460, alignSelf: "center" },
  storyWide: {
    flex: 1,
    maxWidth: 550,
    minWidth: 0,
    alignSelf: "stretch",
    justifyContent: "center",
    gap: 42,
  },
  hero: { gap: 22 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: brand.accent },
  eyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 1.5,
    color: brand.muted,
    flexShrink: 1,
  },
  heroTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 47,
    lineHeight: 55,
    letterSpacing: -1.9,
    color: "#F3F5F5",
  },
  heroDescription: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    lineHeight: 26,
    color: brand.muted,
    maxWidth: 410,
  },
  graphic: { marginTop: 2, width: "100%" },
  features: { flexDirection: "row", flexWrap: "wrap", gap: 20 },
  feature: { flexDirection: "row", alignItems: "center", gap: 7 },
  featureText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: "#D0D0D7",
  },
  form: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: brand.border,
    borderRadius: 24,
    padding: 24,
    backgroundColor: brand.surface,
    gap: 22,
  },
  formWide: { width: 420, padding: 34, flexShrink: 0 },
  formHeading: { gap: 14, marginBottom: 2 },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 31,
    lineHeight: 37,
    letterSpacing: -1,
    color: "#F5F7F6",
  },
  description: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 22,
    color: brand.muted,
  },
  signature: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 28,
  },
  signatureText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 8,
    letterSpacing: 1.2,
    color: "#8A8A94",
  },
});
