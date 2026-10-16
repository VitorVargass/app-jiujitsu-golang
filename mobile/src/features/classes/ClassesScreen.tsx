import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Redirect, router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Icon, IconName } from "../../components/Icon";
import { Button, Empty, Label, Loading, Notice } from "../../components/ui";
import { api, academyPath } from "../../services/api";
import { queryClient, useSession } from "../../services/session";
import { Class, Schedule, Session } from "../../types";
import { Catalog } from "../../types/billing";
import { accents, colors, displayTime } from "../../theme";
import { AcademyShell, RoleGate } from "../shared/AcademyShell";
import { ClassDialog } from "./ClassDialog";
import { ClassEditor } from "./ClassEditor";
import { daysLabel, groupWeekly } from "./weekly";

function MenuAction({
  label,
  icon,
  danger = false,
  disabled = false,
  onPress,
}: {
  label: string;
  icon: IconName;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.menuItem,
        (pressed || disabled) && { opacity: 0.5 },
      ]}
    >
      <Icon
        name={icon}
        size={18}
        color={danger ? colors.danger : colors.muted}
      />
      <Text style={[s.menuLabel, danger && { color: colors.danger }]}>
        {label}
      </Text>
    </Pressable>
  );
}
function ClassCard({
  item,
  today,
  onOptions,
  onToday,
}: {
  item: Class;
  today: number;
  onOptions: () => void;
  onToday: () => void;
}) {
  const groups = groupWeekly(item.schedules ?? []);
  const slots = item.schedules?.filter((sc) => sc.weekday === today) ?? [];
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
          <Text style={s.modality}>{item.modality_name || "Modalidade"}</Text>
          <Text style={s.cardTitle}>{item.name}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={"Opções de " + item.name}
          onPress={onOptions}
          style={s.options}
        >
          <Icon name="more" size={21} color={colors.muted} />
        </Pressable>
      </View>
      {!item.active ? <Text style={s.paused}>Pausada</Text> : null}
      <View style={s.agenda}>
        {groups.length ? (
          groups.map((group) => (
            <View key={group.key} style={s.agendaRow}>
              <Icon name="calendar" size={15} color={accents.amber.color} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.days}>{daysLabel(group.days)}</Text>
                <Text style={s.times}>
                  {group.times.replaceAll(", ", " · ")}
                  <Text style={s.duration}> / {group.duration} min</Text>
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Label muted>Sem horários. Configure a agenda em Opções.</Label>
        )}
      </View>
      {item.teacher_name ? (
        <Text style={[s.teacher, { paddingHorizontal: 18, paddingBottom: 12 }]}>
          {item.teacher_name}
        </Text>
      ) : null}
      {item.active && slots.length ? (
        <View style={s.today}>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text style={s.todayLabel}>HOJE</Text>
            <Text style={s.todayTimes}>
              {slots.map((sc) => sc.start_time.slice(0, 5)).join(" · ")}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={"Aulas de hoje em " + item.name}
            onPress={onToday}
            style={({ pressed }) => [
              s.todayButton,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text style={s.todayButtonText}>Ver aulas</Text>
            <Icon name="chevron-right" size={14} color={accents.amber.color} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
function Content() {
  const { academy } = useSession(),
    a = academy!;
  const { width } = useWindowDimensions();
  const [editor, setEditor] = useState<Class | "new" | null>(null);
  const [menu, setMenu] = useState<Class | null>(null);
  const [deleting, setDeleting] = useState<Class | null>(null);
  const [todayClass, setTodayClass] = useState<Class | null>(null);
  const [filter, setFilter] = useState("active");
  const [message, setMessage] = useState("");
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: a.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const today = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    new Intl.DateTimeFormat("en-US", {
      timeZone: a.timezone,
      weekday: "short",
    }).format(new Date()),
  );
  const list = useQuery({
    queryKey: ["classes", a.id],
    queryFn: () => api<Class[]>(academyPath(a.id, "/classes")),
  });
  const modalities = useQuery({
    queryKey: ["modalities", a.id],
    queryFn: () => api<Catalog[]>(academyPath(a.id, "/modalities")),
  });
  const sessions = useQuery({
    queryKey: ["sessions", a.id, date],
    queryFn: () => api<Session[]>(academyPath(a.id, "/sessions?date=" + date)),
    enabled: !!todayClass,
  });
  const changeStatus = useMutation({
    mutationFn: (item: Class) =>
      api(academyPath(a.id, "/classes/" + item.id), {
        method: "PATCH",
        body: { active: !item.active },
      }),
    onSuccess: (_, item) => {
      setMenu(null);
      setMessage(item.active ? "Turma pausada." : "Turma reativada.");
      void queryClient.invalidateQueries();
    },
  });
  const remove = useMutation({
    mutationFn: (item: Class) =>
      api(academyPath(a.id, "/classes/" + item.id), { method: "DELETE" }),
    onSuccess: () => {
      setDeleting(null);
      setMessage("Turma excluída. Histórico preservado.");
      void queryClient.invalidateQueries();
    },
  });
  const open = useMutation({
    mutationFn: ({ item, schedule }: { item: Class; schedule: Schedule }) =>
      api<Session>(academyPath(a.id, "/classes/" + item.id + "/sessions"), {
        method: "POST",
        body: { schedule_id: schedule.id },
      }),
    onSuccess: (session) => {
      setTodayClass(null);
      void queryClient.invalidateQueries();
      router.push({ pathname: "/attendance/[id]", params: { id: session.id } });
    },
  });
  const active = list.data?.filter((c) => c.active).length ?? 0,
    paused = (list.data?.length ?? 0) - active;
  const visible =
    list.data?.filter(
      (c) => filter === "all" || (filter === "active" ? c.active : !c.active),
    ) ?? [];
  return (
    <AcademyShell
      title="Turmas"
      subtitle="Toda a semana, em uma só agenda."
      swipeEnabled={!editor && !menu && !deleting && !todayClass}
      titleAction={
        <Button
          compact
          icon="plus"
          onPress={() => {
            setMessage("");
            setEditor("new");
          }}
        >
          Nova turma
        </Button>
      }
    >
      <View style={s.filters}>
        {[
          ["active", "Ativas", active],
          ["paused", "Pausadas", paused],
          ["all", "Todas", list.data?.length ?? 0],
        ].map(([key, label, count]) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityLabel={String(label)}
            accessibilityState={{ selected: filter === key }}
            onPress={() => setFilter(String(key))}
            style={[s.filter, filter === key && s.filterSelected]}
          >
            <Text
              style={[
                s.filterText,
                filter === key && { color: accents.amber.color },
              ]}
            >
              {label} <Text style={s.filterCount}>{count}</Text>
            </Text>
          </Pressable>
        ))}
      </View>
      <Notice success message={message} />
      <Notice message={modalities.error?.message} />
      {list.isPending ? (
        <Loading />
      ) : list.error ? (
        <Notice message={list.error.message} />
      ) : visible.length ? (
        <View style={s.grid}>
          {visible.map((item) => (
            <View
              key={item.id}
              style={{ width: width >= 900 ? "48.7%" : "100%" }}
            >
              <ClassCard
                item={item}
                today={today}
                onOptions={() => {
                  changeStatus.reset();
                  setMenu(item);
                }}
                onToday={() => {
                  open.reset();
                  setTodayClass(item);
                }}
              />
            </View>
          ))}
        </View>
      ) : (
        <Empty>
          {filter === "paused"
            ? "Nenhuma turma pausada."
            : filter === "active" && paused
              ? "Nenhuma turma ativa. Consulte as pausadas ou crie uma turma."
              : "Comece por Nova turma e cadastre todos os dias e horários de uma vez."}
        </Empty>
      )}
      {editor ? (
        <ClassEditor
          key={editor === "new" ? "new" : editor.id}
          academyId={a.id}
          initial={editor === "new" ? undefined : editor}
          modalities={modalities.data ?? []}
          onClose={() => setEditor(null)}
        />
      ) : null}
      {menu ? (
        <ClassDialog
          title={menu.name}
          pending={changeStatus.isPending}
          onClose={() => setMenu(null)}
        >
          <View>
            <MenuAction
              label="Editar turma e agenda"
              icon="calendar"
              disabled={changeStatus.isPending}
              onPress={() => {
                setEditor(menu);
                setMenu(null);
              }}
            />
            <MenuAction
              label={menu.active ? "Pausar turma" : "Reativar turma"}
              icon="swap"
              disabled={changeStatus.isPending}
              onPress={() => changeStatus.mutate(menu)}
            />
            <MenuAction
              label="Excluir turma"
              icon="close"
              danger
              disabled={changeStatus.isPending}
              onPress={() => {
                remove.reset();
                setDeleting(menu);
                setMenu(null);
              }}
            />
          </View>
          <Notice message={changeStatus.error?.message} />
          {changeStatus.isPending ? (
            <ActivityIndicator color={colors.primary} />
          ) : null}
        </ClassDialog>
      ) : null}
      {todayClass ? (
        <ClassDialog
          title={"Aulas de hoje · " + todayClass.name}
          pending={open.isPending}
          onClose={() => setTodayClass(null)}
        >
          {sessions.isPending ? (
            <Loading />
          ) : sessions.error ? (
            <Notice message={sessions.error.message} />
          ) : (
            todayClass.schedules
              .filter((sc) => sc.weekday === today)
              .map((sc) => {
                const existing = sessions.data?.find(
                  (session) =>
                    session.class_id === todayClass.id &&
                    displayTime(session.starts_at, a.timezone) ===
                      sc.start_time.slice(0, 5),
                );
                return (
                  <View key={sc.id} style={s.sessionRow}>
                    <View style={{ gap: 5 }}>
                      <Text style={s.sessionTime}>
                        {sc.start_time.slice(0, 5)}
                      </Text>
                      <Text style={s.teacher}>
                        {sc.duration_minutes} min
                        {existing
                          ? " · " +
                            (existing.status === "open"
                              ? "Aberta"
                              : existing.status === "closed"
                                ? "Encerrada"
                                : "Cancelada")
                          : ""}
                      </Text>
                    </View>
                    {existing ? (
                      <Button
                        compact
                        secondary
                        disabled={open.isPending}
                        onPress={() => {
                          setTodayClass(null);
                          router.push({
                            pathname: "/attendance/[id]",
                            params: { id: existing.id },
                          });
                        }}
                      >
                        Ver presenças
                      </Button>
                    ) : (
                      <Button
                        compact
                        loading={
                          open.isPending &&
                          open.variables?.schedule.id === sc.id
                        }
                        disabled={open.isPending}
                        onPress={() =>
                          open.mutate({ item: todayClass, schedule: sc })
                        }
                      >
                        Abrir aula
                      </Button>
                    )}
                  </View>
                );
              })
          )}
          <Notice message={open.error?.message} />
        </ClassDialog>
      ) : null}
      <ConfirmDialog
        visible={!!deleting}
        title={"Excluir " + (deleting?.name ?? "turma") + "?"}
        message="A turma será removida e suas aulas abertas serão canceladas. Presenças e histórico serão preservados."
        confirmLabel="Confirmar exclusão"
        danger
        pending={remove.isPending}
        error={remove.error?.message}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting);
        }}
      />
    </AcademyShell>
  );
}
export default function ClassesScreen() {
  const { academy, session } = useSession();
  if (session?.kind === "device") return <Redirect href="/kiosk" />;
  if (!academy) return <Redirect href="/onboarding" />;
  return (
    <RoleGate role="admin">
      <Content />
    </RoleGate>
  );
}
const s = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    alignItems: "flex-start",
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 18,
    paddingBottom: 10,
    gap: 8,
  },
  modality: {
    fontFamily: "Lato_700Bold",
    fontSize: 10,
    color: accents.amber.color,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  cardTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
    color: colors.text,
    lineHeight: 25,
  },
  options: {
    height: 44,
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -8,
    marginRight: -8,
  },
  agenda: { paddingHorizontal: 18, paddingBottom: 16, gap: 14 },
  agendaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingTop: 7,
  },
  days: { fontFamily: "Lato_700Bold", fontSize: 13, color: colors.text },
  times: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: colors.muted,
    lineHeight: 20,
  },
  duration: { fontSize: 11, color: colors.muted },
  paused: {
    color: colors.muted,
    fontFamily: "Lato_700Bold",
    fontSize: 11,
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  teacher: {
    color: colors.muted,
    fontSize: 11,
    fontFamily: "Lato_400Regular",
    paddingHorizontal: 0,
  },
  today: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: accents.amber.soft,
    borderTopWidth: 1,
    borderTopColor: accents.amber.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  todayLabel: {
    fontFamily: "Lato_700Bold",
    fontSize: 9,
    letterSpacing: 1,
    color: accents.amber.color,
  },
  todayTimes: { fontFamily: "Lato_700Bold", fontSize: 12, color: colors.text },
  todayButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  todayButtonText: {
    fontFamily: "Lato_700Bold",
    fontSize: 12,
    color: accents.amber.color,
  },
  filters: {
    flexDirection: "row",
    gap: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  filter: {
    minHeight: 44,
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  filterSelected: { borderBottomColor: accents.amber.color },
  filterText: { fontFamily: "Lato_700Bold", fontSize: 13, color: colors.muted },
  filterCount: { fontSize: 11, color: colors.muted },
  menuItem: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuLabel: {
    fontFamily: "Lato_700Bold",
    fontSize: 14,
    color: colors.text,
    flexShrink: 1,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 6,
  },
  sessionTime: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 19,
    color: colors.text,
  },
});
