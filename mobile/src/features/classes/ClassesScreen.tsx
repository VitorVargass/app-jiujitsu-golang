import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Icon, IconName } from "../../components/Icon";
import { Button, Label, Loading, Notice } from "../../components/ui";
import { api, academyPath } from "../../services/api";
import { queryClient, useSession } from "../../services/session";
import { Class, Schedule } from "../../types";
import { academyDate } from "../../types/attendance";
import { Catalog } from "../../types/billing";
import { accents, colors } from "../../theme";
import { AcademyShell, RoleGate } from "../shared/AcademyShell";
import { ClassDialog } from "./ClassDialog";
import { ClassEditor } from "./ClassEditor";
import { WeeklyTimetable } from "./WeeklyTimetable";
import { fullDays, scheduleRange } from "./weekly";

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
type Selection = { item: Class; schedule?: Schedule };

function Content() {
  const { academy } = useSession(),
    a = academy!;
  const [editor, setEditor] = useState<Class | "new" | null>(null);
  const [menu, setMenu] = useState<Selection | null>(null);
  const [deleting, setDeleting] = useState<Class | null>(null);
  const [filter, setFilter] = useState("active");
  const [message, setMessage] = useState("");
  const [browsing, setBrowsing] = useState(false);
  const date = academyDate(a.timezone);
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
  const active = list.data?.filter((c) => c.active).length ?? 0;
  const paused = (list.data?.length ?? 0) - active;
  const visible =
    list.data?.filter(
      (c) => filter === "all" || (filter === "active" ? c.active : !c.active),
    ) ?? [];
  const emptyMessage =
    filter === "paused"
      ? "Nenhuma turma pausada."
      : filter === "active" && paused
        ? "Nenhuma turma ativa. Consulte as pausadas ou crie uma turma."
        : "Crie sua primeira turma para preencher os dias e horários desta grade.";
  return (
    <AcademyShell
      wide
      title="Turmas"
      subtitle="Os horários da sua academia, em uma só grade."
      swipeEnabled={!browsing && !editor && !menu && !deleting}
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
                filter === key && { color: accents.brand.color },
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
      ) : (
        <WeeklyTimetable
          items={visible}
          today={today}
          emptyMessage={emptyMessage}
          onInteractionChange={setBrowsing}
          onSelect={(item, schedule) => {
            changeStatus.reset();
            setMenu({ item, schedule });
          }}
        />
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
          title={menu.item.name}
          pending={changeStatus.isPending}
          onClose={() => setMenu(null)}
        >
          {menu.schedule ? (
            <View style={s.lessonSummary}>
              <View style={s.summaryIcon}>
                <Icon name="calendar" size={22} color={accents.brand.color} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
                <Text style={s.summaryDay}>
                  {fullDays[menu.schedule.weekday]} ·{" "}
                  {scheduleRange(menu.schedule)}
                </Text>
                <Label muted>
                  {menu.item.modality_name} ·{" "}
                  {menu.item.active ? "Repete toda semana" : "Turma pausada"}
                </Label>
              </View>
            </View>
          ) : (
            <Label muted>
              Configure os dias e horários para incluir esta turma na grade.
            </Label>
          )}
          {menu.item.active && menu.schedule?.weekday === today ? (
            <Button
              compact
              secondary
              icon="check-circle"
              onPress={() => {
                if (!menu.schedule) return;
                const scheduleId = menu.schedule.id;
                setMenu(null);
                router.push({
                  pathname: "/attendance-day",
                  params: { scheduleId, date },
                });
              }}
            >
              Presenças de hoje
            </Button>
          ) : null}
          <View>
            <MenuAction
              label="Editar turma e agenda"
              icon="calendar"
              disabled={changeStatus.isPending}
              onPress={() => {
                setEditor(menu.item);
                setMenu(null);
              }}
            />
            <MenuAction
              label={menu.item.active ? "Pausar turma" : "Reativar turma"}
              icon="swap"
              disabled={changeStatus.isPending}
              onPress={() => changeStatus.mutate(menu.item)}
            />
            <MenuAction
              label="Excluir turma"
              icon="close"
              danger
              disabled={changeStatus.isPending}
              onPress={() => {
                remove.reset();
                setDeleting(menu.item);
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
  return (
    <RoleGate role="admin">
      <Content />
    </RoleGate>
  );
}
const s = StyleSheet.create({
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
  filterSelected: { borderBottomColor: accents.brand.color },
  filterText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: colors.muted,
  },
  filterCount: { fontSize: 11, color: colors.muted },
  menuItem: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: colors.text,
    flexShrink: 1,
  },
  lessonSummary: { flexDirection: "row", alignItems: "center", gap: 12 },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: accents.brand.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryDay: {
    fontFamily: "Inter_600SemiBold",
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
});
