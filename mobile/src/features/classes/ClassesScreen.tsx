import { useState } from "react";
import { Redirect, router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, academyPath } from "../../services/api";
import { queryClient, useSession } from "../../services/session";
import { AcademyShell } from "../shared/AcademyShell";
import {
  Card,
  Heading,
  Label,
  Button,
  Field,
  Notice,
  Loading,
  Row,
  Chip,
  Empty,
} from "../../components/ui";
import { Class, Member, Schedule } from "../../types";
import { weekdays } from "../../theme";

function TeacherPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { academy } = useSession();
  const members = useQuery({
    queryKey: ["members", academy!.id],
    queryFn: () => api<Member[]>(academyPath(academy!.id, "/members")),
  });
  const teachers =
    members.data?.filter(
      (m) => m.status === "active" && m.roles.includes("teacher"),
    ) ?? [];
  return (
    <>
      <Label>Professor responsável</Label>
      {members.isPending ? (
        <Loading />
      ) : (
        <Row>
          {teachers.map((m) => (
            <Chip
              key={m.id}
              selected={value === m.id}
              onPress={() => onChange(m.id)}
            >
              {m.name}
            </Chip>
          ))}
        </Row>
      )}
      <Notice message={members.error?.message} />
      {members.data && !teachers.length && (
        <Label muted>Aprove um professor antes de criar a turma.</Label>
      )}
    </>
  );
}

function AddSchedule({ classId }: { classId: string }) {
  const { academy } = useSession();
  const [day, setDay] = useState(1);
  const [start, setStart] = useState("19:00");
  const [duration, setDuration] = useState("60");
  const save = useMutation({
    mutationFn: () =>
      api(academyPath(academy!.id, "/classes/" + classId + "/schedules"), {
        method: "POST",
        body: {
          weekday: day,
          start_time: start,
          duration_minutes: Number(duration),
        },
      }),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: ["schedules", academy!.id, classId],
      }),
  });
  return (
    <>
      <Heading>Adicionar horário semanal</Heading>
      <Row>
        {weekdays.map((d, i) => (
          <Chip key={d} selected={day === i} onPress={() => setDay(i)}>
            {d}
          </Chip>
        ))}
      </Row>
      <Field label="Horário (HH:MM)" value={start} onChangeText={setStart} />
      <Field
        label="Duração em minutos"
        value={duration}
        onChangeText={setDuration}
        keyboardType="number-pad"
      />
      <Notice message={save.error?.message} />
      {save.isSuccess && <Notice success message="Horário adicionado." />}
      <Button loading={save.isPending} onPress={() => save.mutate()}>
        Adicionar horário
      </Button>
    </>
  );
}

function ClassCard({ item }: { item: Class }) {
  const { academy, role } = useSession();
  const a = academy!;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [teacher, setTeacher] = useState(item.teacher_membership_id);
  const schedules = useQuery({
    queryKey: ["schedules", a.id, item.id],
    queryFn: () =>
      api<Schedule[]>(academyPath(a.id, "/classes/" + item.id + "/schedules")),
  });
  const open = useMutation({
    mutationFn: (id: string) =>
      api(academyPath(a.id, "/classes/" + item.id + "/sessions"), {
        method: "POST",
        body: { schedule_id: id },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
      router.push(role === "admin" ? "/academy" : "/teacher");
    },
  });
  const save = useMutation({
    mutationFn: (body: object) =>
      api(academyPath(a.id, "/classes/" + item.id), { method: "PATCH", body }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["classes", a.id] }),
  });
  const currentDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: a.timezone,
    }).format(new Date()),
  );
  const canOpen =
    item.active &&
    (role === "admin" ||
      (role === "teacher" && item.teacher_membership_id === a.membership_id));
  return (
    <Card>
      <Heading>
        {item.name}
        {!item.active ? " • Inativa" : ""}
      </Heading>
      <Label muted>{item.teacher_name}</Label>
      {schedules.isPending ? (
        <Loading />
      ) : schedules.error ? (
        <Notice message={schedules.error.message} />
      ) : schedules.data?.length ? (
        schedules.data.map((sc) => (
          <Row key={sc.id}>
            <Chip>
              {weekdays[sc.weekday]} • {sc.start_time.slice(0, 5)} •{" "}
              {sc.duration_minutes} min
            </Chip>
            {canOpen && sc.weekday === currentDay && (
              <Button
                loading={open.isPending}
                onPress={() => open.mutate(sc.id)}
              >
                Abrir aula
              </Button>
            )}
          </Row>
        ))
      ) : (
        <Label muted>Nenhum horário cadastrado.</Label>
      )}
      <Notice message={open.error?.message || save.error?.message} />
      {role === "admin" && (
        <>
          <Row>
            <Button secondary onPress={() => setEditing(!editing)}>
              {editing ? "Fechar edição" : "Editar turma e horários"}
            </Button>
            <Button
              secondary
              loading={save.isPending}
              onPress={() => save.mutate({ active: !item.active })}
            >
              {item.active ? "Desativar turma" : "Reativar turma"}
            </Button>
          </Row>
          {editing && (
            <>
              <Field
                label="Nome da turma"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
              <TeacherPicker value={teacher} onChange={setTeacher} />
              <Button
                disabled={!name.trim() || !teacher}
                loading={save.isPending}
                onPress={() =>
                  save.mutate({ name, teacher_membership_id: teacher })
                }
              >
                Salvar turma
              </Button>
              {save.isSuccess && <Notice success message="Turma atualizada." />}
              <AddSchedule classId={item.id} />
            </>
          )}
        </>
      )}
    </Card>
  );
}

function Content() {
  const { academy, role } = useSession();
  const a = academy!;
  const [name, setName] = useState("");
  const [teacher, setTeacher] = useState("");
  const list = useQuery({
    queryKey: ["classes", a.id],
    queryFn: () => api<Class[]>(academyPath(a.id, "/classes")),
  });
  const create = useMutation({
    mutationFn: () =>
      api<Class>(academyPath(a.id, "/classes"), {
        method: "POST",
        body: { name, teacher_membership_id: teacher },
      }),
    onSuccess: () => {
      setName("");
      void queryClient.invalidateQueries({ queryKey: ["classes", a.id] });
    },
  });
  const visible = list.data?.filter((c) => role === "admin" || c.active) ?? [];
  return (
    <AcademyShell
      title="Turmas e horários"
      subtitle="Encontre seu próximo treino."
    >
      {role === "admin" && (
        <Card>
          <Heading>Nova turma</Heading>
          <Field
            label="Nome"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          <TeacherPicker value={teacher} onChange={setTeacher} />
          <Notice message={create.error?.message} />
          {create.isSuccess && (
            <Notice
              success
              message="Turma criada. Use Editar turma e horários para configurar os treinos."
            />
          )}
          <Button
            disabled={!teacher || !name.trim()}
            loading={create.isPending}
            onPress={() => create.mutate()}
          >
            Criar turma
          </Button>
        </Card>
      )}
      {list.isPending ? (
        <Loading />
      ) : list.error ? (
        <Notice message={list.error.message} />
      ) : visible.length ? (
        visible.map((c) => <ClassCard key={c.id} item={c} />)
      ) : (
        <Empty>As turmas desta academia aparecerão aqui.</Empty>
      )}
    </AcademyShell>
  );
}
export default function ClassesScreen() {
  const { academy, session } = useSession();
  if (session?.kind === "device") return <Redirect href="/kiosk" />;
  if (!academy) return <Redirect href="/onboarding" />;
  return <Content />;
}
