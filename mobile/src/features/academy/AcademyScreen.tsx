import { Href, router } from "expo-router";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api, academyPath } from "../../services/api";
import { useSession } from "../../services/session";
import { AcademyShell, RoleGate } from "../shared/AcademyShell";
import {
  Card,
  Heading,
  Label,
  Notice,
  Loading,
  Badge,
} from "../../components/ui";
import { Icon, IconName } from "../../components/Icon";
import { Dashboard, Session } from "../../types";
import { money } from "../../types/billing";
import { displayTime, colors, accents, Accent } from "../../theme";

function Metric({
  label,
  value,
  hint,
  icon,
  tone,
  href,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: IconName;
  tone: Accent;
  href: Href;
}) {
  const accent = accents[tone];
  const { width } = useWindowDimensions();
  const valueSize =
    typeof value === "string"
      ? Math.min(
          23,
          Math.max(
            13,
            Math.floor(
              (Math.min(width, 720) - 116) / 2 / (value.length * 0.54),
            ),
          ),
        )
      : 32;
  return (
    <Card
      onPress={() => router.replace(href)}
      accessibilityLabel={label + ": " + value + ". " + hint}
      style={[styles.metric, { borderColor: accent.border }]}
    >
      <View style={styles.metricTop}>
        <View style={[styles.metricIcon, { backgroundColor: accent.soft }]}>
          <Icon name={icon} size={21} color={accent.color} />
        </View>
        <Icon name="chevron-right" size={16} color={accent.color} />
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.65}
        style={[
          styles.value,
          {
            color: accent.color,
            fontSize: valueSize,
          },
        ]}
      >
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricHint}>{hint}</Text>
    </Card>
  );
}

function Content() {
  const { academy } = useSession();
  const a = academy!;
  const dash = useQuery({
    queryKey: ["dashboard", a.id],
    queryFn: () => api<Dashboard>(academyPath(a.id, "/dashboard?role=admin")),
    refetchInterval: 10000,
  });
  const sessions = useQuery({
    queryKey: ["sessions", a.id],
    queryFn: () => api<Session[]>(academyPath(a.id, "/sessions")),
    refetchInterval: 8000,
  });
  const week = dash.data?.week ?? [];
  const maximum = Math.max(1, ...week.map((d) => d.count));
  const total = week.reduce((sum, d) => sum + d.count, 0);
  const open = sessions.data?.filter((s) => s.status === "open") ?? [];
  const date = new Intl.DateTimeFormat("pt-BR", {
    timeZone: a.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  return (
    <AcademyShell title="Minha academia">
      <Card
        onPress={() =>
          router.push({ pathname: "/students/[id]", params: { id: "new" } })
        }
        accessibilityLabel="Novo aluno. Cadastrar aluno na academia"
        style={styles.hero}
      >
        <View pointerEvents="none" style={styles.heroCircle} />
        <View style={styles.heroTop}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.eyebrow}>FAÇA SEU TATAME CRESCER</Text>
            <Text style={styles.heroTitle}>Novo aluno</Text>
            <Text style={styles.heroDescription}>
              Cadastro simples, passo a passo.
            </Text>
          </View>
          <View style={styles.heroArrow}>
            <Icon name="plus" size={23} color={colors.onPrimary} />
          </View>
        </View>
      </Card>

      <View style={styles.sectionHeading}>
        <View style={{ flex: 1, gap: 4 }}>
          <Heading>Visão geral</Heading>
          <Text style={styles.date}>
            {date.charAt(0).toUpperCase() + date.slice(1)}
          </Text>
        </View>
      </View>
      {dash.isPending ? (
        <Loading />
      ) : dash.error ? (
        <Notice message={dash.error.message} />
      ) : (
        <View style={styles.metrics}>
          <Metric
            label="Alunos ativos"
            value={dash.data?.active_students ?? 0}
            hint="Ver alunos"
            icon="users"
            tone="blue"
            href="/students"
          />
          <Metric
            label="Recebido no mês"
            value={money(dash.data?.received_month_cents ?? 0)}
            hint="Ver financeiro"
            icon="wallet"
            tone="mint"
            href="/finance"
          />
          <Metric
            label="Em aberto"
            value={money(dash.data?.open_cents ?? 0)}
            hint="Ver mensalidades"
            icon="wallet"
            tone="amber"
            href="/finance"
          />
          <Metric
            label="Presenças hoje"
            value={dash.data?.presences_today ?? 0}
            hint="Ver histórico"
            icon="check-circle"
            tone="lavender"
            href="/academy-history"
          />
        </View>
      )}

      {dash.data ? (
        <Card
          onPress={() => router.push("/academy-history")}
          accessibilityLabel={
            "Ritmo da semana. " +
            total +
            " presenças nos últimos sete dias. Ver histórico de presenças"
          }
          style={styles.chartCard}
        >
          <View style={styles.sectionHeading}>
            <View style={{ flex: 1, gap: 5 }}>
              <Heading>Ritmo da semana</Heading>
              <Label muted>Presenças nos últimos 7 dias</Label>
            </View>
            <View
              style={[
                styles.metricIcon,
                { backgroundColor: accents.blue.soft },
              ]}
            >
              <Icon name="calendar" size={21} color={accents.blue.color} />
            </View>
          </View>
          <View
            style={styles.chart}
            accessible
            accessibilityLabel={week
              .map((d) => d.date + ": " + d.count)
              .join(", ")}
          >
            {week.map((d, index) => {
              const latest = index === week.length - 1;
              const weekday = new Intl.DateTimeFormat("pt-BR", {
                weekday: "short",
                timeZone: "UTC",
              })
                .format(new Date(d.date + "T12:00:00Z"))
                .replace(".", "");
              return (
                <View key={d.date} style={styles.chartColumn}>
                  <Text
                    style={[
                      styles.chartCount,
                      latest && { color: colors.primary },
                    ]}
                  >
                    {d.count}
                  </Text>
                  <View style={styles.chartTrack}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: Math.max(5, (d.count / maximum) * 80),
                          backgroundColor: latest
                            ? colors.primary
                            : accents.blue.color,
                          opacity: d.count ? 1 : 0.28,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.chartDay,
                      latest && { color: colors.primary },
                    ]}
                  >
                    {weekday}
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={styles.cardFooter}>
            <Text style={styles.footerText}>
              {total}{" "}
              {total === 1 ? "presença na semana" : "presenças na semana"}
            </Text>
            <Icon name="chevron-right" size={17} color={accents.blue.color} />
          </View>
        </Card>
      ) : null}

      <View style={styles.sectionHeading}>
        <Heading>Aulas abertas</Heading>
        <Badge
          label={String(open.length) + (open.length === 1 ? " aula" : " aulas")}
          tone="mint"
        />
      </View>
      <Notice message={sessions.error?.message} />
      {sessions.isPending ? (
        <Loading />
      ) : open.length ? (
        open.map((s) => (
          <Card
            key={s.id}
            onPress={() =>
              router.push({
                pathname: "/attendance/[id]",
                params: { id: s.id },
              })
            }
            accessibilityLabel={
              "Abrir aula " + s.class_name + ". Ver presenças e encerrar aula"
            }
            style={styles.sessionCard}
          >
            <View style={styles.sectionHeading}>
              <View
                style={[
                  styles.metricIcon,
                  { backgroundColor: accents.amber.soft },
                ]}
              >
                <Icon name="calendar" size={22} color={accents.amber.color} />
              </View>
              <View style={{ flex: 1, gap: 5 }}>
                <Heading>{s.class_name}</Heading>
                <Label muted>
                  {displayTime(s.starts_at, a.timezone)} • {s.attendance_count}{" "}
                  presentes
                </Label>
              </View>
              <Icon
                name="chevron-right"
                size={20}
                color={accents.amber.color}
              />
            </View>
            <View style={styles.cardFooter}>
              <Badge label="Aula em andamento" tone="mint" />
              <Text style={styles.footerText}>Ver lista</Text>
            </View>
          </Card>
        ))
      ) : !sessions.error ? (
        <Card
          onPress={() => router.replace("/classes")}
          accessibilityLabel="Nenhuma aula aberta. Abrir turmas"
          style={styles.emptySession}
        >
          <View
            style={[styles.metricIcon, { backgroundColor: accents.amber.soft }]}
          >
            <Icon name="calendar" size={24} color={accents.amber.color} />
          </View>
          <Heading>Vamos para o tatame?</Heading>
          <Label muted>
            Abra uma aula em Turmas para começar a receber os alunos.
          </Label>
          <View style={styles.cardFooter}>
            <Text style={[styles.footerText, { color: accents.amber.color }]}>
              Ir para turmas
            </Text>
            <Icon name="chevron-right" size={18} color={accents.amber.color} />
          </View>
        </Card>
      ) : null}
    </AcademyShell>
  );
}
export default function AcademyScreen() {
  return (
    <RoleGate role="admin">
      <Content />
    </RoleGate>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: "#15372F",
    borderColor: "#2B5749",
    borderRadius: 24,
    padding: 20,
    gap: 14,
    overflow: "hidden",
  },
  heroCircle: {
    position: "absolute",
    right: -60,
    top: 38,
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 30,
    borderColor: "#1C4338",
    opacity: 0.65,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  eyebrow: {
    color: "#B3E8D6",
    fontSize: 9,
    letterSpacing: 1.1,
    fontFamily: "Lato_700Bold",
    flexShrink: 1,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 23,
    lineHeight: 30,
    letterSpacing: -0.7,
    fontFamily: "Montserrat_700Bold",
  },
  heroDescription: {
    color: "#BDCDC9",
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "Lato_400Regular",
    maxWidth: 265,
  },
  heroArrow: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  date: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Lato_400Regular",
  },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metric: {
    flexGrow: 1,
    flexBasis: "46%",
    minWidth: 118,
    minHeight: 175,
    padding: 16,
    gap: 7,
    borderRadius: 20,
  },
  metricTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  metricIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  value: { fontFamily: "Montserrat_700Bold", letterSpacing: -0.8 },
  metricLabel: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Lato_700Bold",
  },
  metricHint: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 16,
    fontFamily: "Lato_400Regular",
  },
  chartCard: { padding: 20, borderRadius: 22, gap: 20 },
  chart: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end",
    paddingTop: 6,
  },
  chartColumn: { flex: 1, alignItems: "center", gap: 8 },
  chartCount: { color: colors.muted, fontFamily: "Lato_700Bold", fontSize: 11 },
  chartTrack: {
    height: 85,
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bar: {
    width: "68%",
    maxWidth: 28,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  chartDay: { color: colors.muted, fontSize: 10, fontFamily: "Lato_700Bold" },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  footerText: { color: colors.muted, fontSize: 12, fontFamily: "Lato_700Bold" },
  sessionCard: { borderRadius: 20, borderColor: accents.amber.border, gap: 15 },
  emptySession: { borderRadius: 22, gap: 12 },
});
