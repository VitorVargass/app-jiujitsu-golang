import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router, Href } from "expo-router";
import { EditorDialog } from "../../components/EditorDialog";
import { Icon } from "../../components/Icon";
import { Avatar, Badge, Button, Card } from "../../components/ui";
import { Attendance } from "../../types";
import { accents, colors, displayTime } from "../../theme";

function dateKey(value: string, zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  return ["year", "month", "day"]
    .map((type) => parts.find((p) => p.type === type)?.value ?? "")
    .join("-");
}
function fullDate(value: string, zone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: zone,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}
function origin(item: Attendance) {
  return item.source === "manager" ? "Gestor" : "Tablet";
}

export function HistoryList({
  items,
  timezone,
  admin,
}: {
  items: Attendance[];
  timezone: string;
  admin: boolean;
}) {
  const { width } = useWindowDimensions();
  const desktop = admin && width >= 900;
  const [detail, setDetail] = useState<Attendance | null>(null);
  const days = new Map<string, Attendance[]>();
  for (const item of items) {
    const key = dateKey(item.starts_at ?? item.checked_in_at, timezone);
    const group = days.get(key);
    if (group) group.push(item);
    else days.set(key, [item]);
  }
  return (
    <>
      {Array.from(days, ([key, records]) => {
        const time = records[0].starts_at ?? records[0].checked_in_at;
        const weekday = new Intl.DateTimeFormat("pt-BR", {
          weekday: "long",
          timeZone: timezone,
        }).format(new Date(time));
        return (
          <View key={key} style={s.group}>
            <View style={s.dayHeading}>
              <View style={s.dateIcon}>
                <Icon name="calendar" size={17} color={colors.primaryLight} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text accessibilityRole="header" style={s.day}>
                  {fullDate(time, timezone)}
                </Text>
                <Text style={s.caption}>{weekday}</Text>
              </View>
            </View>
            <Card style={s.list}>
              {desktop ? (
                <View style={s.columns}>
                  <Text style={[s.column, s.person]}>ALUNO</Text>
                  <Text style={[s.column, s.classroom]}>TURMA</Text>
                  <Text style={[s.column, s.time]}>AULA</Text>
                  <Text style={[s.column, s.origin]}>ORIGEM</Text>
                  <View style={{ width: 16 }} />
                </View>
              ) : null}
              {records.map((item, index) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={
                    "Ver presença de " +
                    item.student_name +
                    " em " +
                    item.class_name +
                    ", " +
                    fullDate(item.starts_at ?? item.checked_in_at, timezone)
                  }
                  onPress={() => setDetail(item)}
                  style={({ pressed }) => [
                    s.record,
                    index > 0 && s.divider,
                    pressed && { backgroundColor: colors.surfaceRaised },
                  ]}
                >
                  {desktop ? (
                    <>
                      <View style={[s.person, s.personRow]}>
                        <Avatar name={item.student_name} />
                        <View style={s.copy}>
                          <Text style={s.name}>{item.student_name}</Text>
                          {item.belt ? (
                            <Text style={s.caption}>{item.belt}</Text>
                          ) : null}
                        </View>
                      </View>
                      <View style={[s.classroom, s.copy]}>
                        <Text style={s.className}>{item.class_name}</Text>
                        {item.modality_name ? (
                          <Text style={s.caption}>{item.modality_name}</Text>
                        ) : null}
                      </View>
                      <Text style={[s.time, s.hour]}>
                        {displayTime(
                          item.starts_at ?? item.checked_in_at,
                          timezone,
                        )}
                      </Text>
                      <View style={[s.origin, s.source]}>
                        <Icon
                          name={item.source === "manager" ? "edit" : "tablet"}
                          size={15}
                          color={colors.muted}
                        />
                        <Text style={s.caption}>{origin(item)}</Text>
                      </View>
                    </>
                  ) : (
                    <>
                      {admin ? (
                        <Avatar name={item.student_name} />
                      ) : (
                        <View style={s.presentIcon}>
                          <Icon
                            name="check-circle"
                            size={20}
                            color={accents.mint.color}
                          />
                        </View>
                      )}
                      <View style={s.copy}>
                        <Text style={s.name}>
                          {admin ? item.student_name : item.class_name}
                        </Text>
                        <Text style={s.caption}>
                          {admin
                            ? item.class_name
                            : item.modality_name || "Presença confirmada"}
                        </Text>
                        <View style={s.source}>
                          <Icon
                            name={item.source === "manager" ? "edit" : "tablet"}
                            size={12}
                            color={colors.muted}
                          />
                          <Text style={s.small}>
                            {origin(item)}
                            {admin && item.belt ? " · " + item.belt : ""}
                          </Text>
                        </View>
                      </View>
                      <View style={s.mobileTime}>
                        <Text style={s.hour}>
                          {displayTime(
                            item.starts_at ?? item.checked_in_at,
                            timezone,
                          )}
                        </Text>
                        <Text style={s.small}>aula</Text>
                      </View>
                    </>
                  )}
                  <Icon name="chevron-right" size={16} color={colors.muted} />
                </Pressable>
              ))}
            </Card>
          </View>
        );
      })}
      {detail ? (
        <EditorDialog
          title="Detalhes da presença"
          onClose={() => setDetail(null)}
          footer={
            admin && detail.student_id ? (
              <Button
                compact
                secondary
                icon="users"
                onPress={() => {
                  const destination = ("/students/" + detail.student_id) as Href;
                  setDetail(null);
                  router.push(destination);
                }}
              >
                Ver cadastro do aluno
              </Button>
            ) : undefined
          }
        >
          <View style={s.personRow}>
            <Avatar name={detail.student_name} />
            <View style={s.copy}>
              <Text style={s.name}>{detail.student_name}</Text>
              {detail.belt ? (
                <Text style={s.caption}>{detail.belt}</Text>
              ) : null}
            </View>
          </View>
          <Badge label="Presença confirmada" tone="mint" />
          <View style={s.detailBlock}>
            <Text style={s.caption}>Turma</Text>
            <Text style={s.name}>{detail.class_name}</Text>
            {detail.modality_name ? (
              <Text style={s.caption}>{detail.modality_name}</Text>
            ) : null}
          </View>
          <View style={s.detailBlock}>
            <Text style={s.caption}>Dia e horário do treino</Text>
            <Text style={s.detailValue}>
              {fullDate(detail.starts_at ?? detail.checked_in_at, timezone)} ·{" "}
              {displayTime(detail.starts_at ?? detail.checked_in_at, timezone)}
            </Text>
          </View>
          <View style={s.detailBlock}>
            <Text style={s.caption}>Registrado em</Text>
            <Text style={s.detailValue}>
              {fullDate(detail.checked_in_at, timezone)} ·{" "}
              {displayTime(detail.checked_in_at, timezone)}
            </Text>
            <Text style={s.caption}>
              {detail.source === "manager"
                ? "Lançamento feito pelo gestor"
                : "Check-in no tablet"}
            </Text>
          </View>
        </EditorDialog>
      ) : null}
    </>
  );
}
const s = StyleSheet.create({
  group: { gap: 12 },
  dayHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  dateIcon: {
    height: 36,
    width: 36,
    borderRadius: 11,
    backgroundColor: accents.brand.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  day: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: colors.text },
  list: { padding: 0, gap: 0, overflow: "hidden" },
  columns: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  column: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 1,
    color: colors.muted,
  },
  record: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 15,
    minHeight: 78,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  person: { flex: 1.3, minWidth: 0 },
  personRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  copy: { flex: 1, minWidth: 0, gap: 5 },
  name: {
    fontFamily: "Inter_600SemiBold",
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  className: {
    fontFamily: "Inter_400Regular",
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  classroom: { flex: 1, minWidth: 0 },
  time: { width: 64 },
  hour: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: colors.text },
  origin: { width: 80 },
  source: { flexDirection: "row", gap: 5, alignItems: "center" },
  caption: {
    fontFamily: "Inter_400Regular",
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  small: {
    fontFamily: "Inter_400Regular",
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    flexShrink: 1,
  },
  mobileTime: { alignItems: "flex-end", gap: 3 },
  presentIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: accents.mint.soft,
  },
  detailBlock: {
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: 16,
  },
  detailValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
  },
});
