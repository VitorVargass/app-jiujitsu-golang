import { useState } from "react";
import { FormWizard } from "../../components/FormWizard";
import { Redirect, router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, academyPath } from "../../services/api";
import { queryClient, useSession } from "../../services/session";
import { AcademyShell, RoleGate } from "../shared/AcademyShell";
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
import { Catalog } from "../../types/billing";
import { weekdays } from "../../theme";

function ModalityPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string, name?: string) => void;
}) {
  const { academy } = useSession();
  const list = useQuery({
    queryKey: ["modalities", academy!.id],
    queryFn: () => api<Catalog[]>(academyPath(academy!.id, "/modalities")),
  });
  return (
    <>
      <Label>Modalidade</Label>
      <Notice message={list.error?.message} />
      <Row>
        {list.data
          ?.filter((m) => m.active)
          .map((m) => (
            <Chip
              key={m.id}
              selected={value === m.id}
              onPress={() => onChange(m.id, m.name)}
            >
              {m.name}
            </Chip>
          ))}
      </Row>
    </>
  );
}
function TeacherPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string, name?: string) => void;
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
      <Label>Professor responsável (opcional)</Label>
      {members.isPending ? (
        <Loading />
      ) : (
        <Row>
          <Chip selected={!value} onPress={() => onChange("", "Sem professor")}>
            Sem professor
          </Chip>
          {teachers.map((m) => (
            <Chip
              key={m.id}
              selected={value === m.id}
              onPress={() => onChange(m.id, m.name)}
            >
              {m.name}
            </Chip>
          ))}
        </Row>
      )}
      <Notice message={members.error?.message} />
      {members.data && !teachers.length && (
        <Label muted>Você pode criar a turma sem professor vinculado.</Label>
      )}
    </>
  );
}

function AddSchedule({
  classId,
  onFormChange,
}: {
  classId: string;
  onFormChange: (key: string, open: boolean) => void;
}) {
  const { academy } = useSession();
  const [adding, setAdding] = useState(false);
  const [day, setDay] = useState(1),
    [start, setStart] = useState("19:00"),
    [duration, setDuration] = useState("60");
  function close() {
    setAdding(false);
    onFormChange(classId + "-schedule", false);
  }
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
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["schedules", academy!.id, classId],
      });
      close();
    },
  });
  if (!adding)
    return (
      <Button
        secondary
        onPress={() => {
          save.reset();
          setAdding(true);
          onFormChange(classId + "-schedule", true);
        }}
      >
        Adicionar horário semanal
      </Button>
    );
  return (
    <FormWizard
      steps={["Dia e horário", "Revisão do horário"]}
      submitLabel="Salvar horário"
      pending={save.isPending}
      error={save.error?.message}
      onCancel={close}
      onSubmit={() => save.mutate()}
      validate={(step) =>
        step === 0 &&
        (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) ||
          !/^\d+$/.test(duration) ||
          Number(duration) < 15 ||
          Number(duration) > 240)
          ? "Informe horário HH:MM e duração entre 15 e 240 minutos."
          : undefined
      }
    >
      {(step) =>
        step === 0 ? (
          <>
            <Row>
              {weekdays.map((label, index) => (
                <Chip
                  key={label}
                  selected={day === index}
                  onPress={() => setDay(index)}
                >
                  {label}
                </Chip>
              ))}
            </Row>
            <Field
              label="Horário (HH:MM)"
              value={start}
              onChangeText={setStart}
            />
            <Field
              label="Duração em minutos"
              value={duration}
              onChangeText={setDuration}
              keyboardType="number-pad"
            />
          </>
        ) : (
          <>
            <Heading>
              {weekdays[day]} • {start}
            </Heading>
            <Label>{duration} minutos por aula</Label>
          </>
        )
      }
    </FormWizard>
  );
}

function ClassCard({
  item,
  onFormChange,
}: {
  item: Class;
  onFormChange: (key: string, open: boolean) => void;
}) {
  const { academy, role } = useSession();
  const a = academy!;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [teacher, setTeacher] = useState(item.teacher_membership_id);
  const [modality, setModality] = useState(item.modality_id);
  const [modalityName, setModalityName] = useState(item.modality_name);
  const [teacherName, setTeacherName] = useState(
    item.teacher_name || "Sem professor",
  );
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["classes", a.id] });
      setEditing(false);
      onFormChange(item.id, false);
    },
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
      <Label muted>
        {item.modality_name}
        {item.teacher_name ? " • " + item.teacher_name : ""}
      </Label>
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
            <Button
              secondary
              onPress={() => {
                setEditing(!editing);
                onFormChange(item.id, !editing);
                save.reset();
              }}
            >
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
          {editing ? (
            <FormWizard
              steps={[
                "Nome da turma",
                "Modalidade e responsável",
                "Revisão da turma",
              ]}
              validate={(step) =>
                step === 0 && name.trim().length < 2
                  ? "Informe o nome da turma."
                  : step === 1 && !modality
                    ? "Selecione uma modalidade."
                    : undefined
              }
              onCancel={() => {
                setEditing(false);
                onFormChange(item.id, false);
              }}
              pending={save.isPending}
              error={save.error?.message}
              submitLabel="Salvar turma"
              onSubmit={() =>
                save.mutate({
                  name,
                  teacher_membership_id: teacher,
                  modality_id: modality,
                  clear_teacher: !teacher,
                })
              }
            >
              {(step) =>
                step === 0 ? (
                  <Field
                    label="Nome da turma"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                ) : step === 1 ? (
                  <>
                    <ModalityPicker
                      value={modality}
                      onChange={(id, label) => {
                        setModality(id);
                        setModalityName(label ?? "");
                      }}
                    />
                    <TeacherPicker
                      value={teacher}
                      onChange={(id, label) => {
                        setTeacher(id);
                        setTeacherName(label ?? "Sem professor");
                      }}
                    />
                  </>
                ) : (
                  <>
                    <Heading>{name}</Heading>
                    <Label>{modalityName}</Label>
                    <Label>{teacherName}</Label>
                  </>
                )
              }
            </FormWizard>
          ) : (
            <AddSchedule classId={item.id} onFormChange={onFormChange} />
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
  const [modality, setModality] = useState("");
  const [modalityName, setModalityName] = useState("");
  const [teacherName, setTeacherName] = useState("Sem professor");
  const [creating, setCreating] = useState(false);
  const [activeForms, setActiveForms] = useState<string[]>([]);
  function formChange(key: string, open: boolean) {
    setActiveForms((old) =>
      open ? [...new Set([...old, key])] : old.filter((k) => k !== key),
    );
  }
  const list = useQuery({
    queryKey: ["classes", a.id],
    queryFn: () => api<Class[]>(academyPath(a.id, "/classes")),
  });
  const create = useMutation({
    mutationFn: () =>
      api<Class>(academyPath(a.id, "/classes"), {
        method: "POST",
        body: { name, teacher_membership_id: teacher, modality_id: modality },
      }),
    onSuccess: () => {
      setName("");
      setCreating(false);
      setTeacher("");
      setModality("");
      void queryClient.invalidateQueries({ queryKey: ["classes", a.id] });
    },
  });
  const visible = list.data?.filter((c) => role === "admin" || c.active) ?? [];
  return (
    <AcademyShell
      title="Turmas e horários"
      subtitle="Encontre seu próximo treino."
      swipeEnabled={!creating && !activeForms.length}
    >
      {role === "admin" && !creating ? (
        <Button
          icon="plus"
          onPress={() => {
            create.reset();
            setCreating(true);
          }}
        >
          Nova turma
        </Button>
      ) : null}
      {creating ? (
        <Card>
          <FormWizard
            steps={[
              "Identificação da turma",
              "Modalidade e responsável",
              "Revisão",
            ]}
            validate={(step) =>
              step === 0 && name.trim().length < 2
                ? "Informe o nome da turma."
                : step === 1 && !modality
                  ? "Selecione uma modalidade."
                  : undefined
            }
            onCancel={() => setCreating(false)}
            pending={create.isPending}
            error={create.error?.message}
            submitLabel="Criar turma"
            onSubmit={() => create.mutate()}
          >
            {(step) =>
              step === 0 ? (
                <Field
                  label="Nome da turma"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              ) : step === 1 ? (
                <>
                  <ModalityPicker
                    value={modality}
                    onChange={(id, label) => {
                      setModality(id);
                      setModalityName(label ?? "");
                    }}
                  />
                  <TeacherPicker
                    value={teacher}
                    onChange={(id, label) => {
                      setTeacher(id);
                      setTeacherName(label ?? "Sem professor");
                    }}
                  />
                </>
              ) : (
                <>
                  <Heading>{name}</Heading>
                  <Label>{modalityName}</Label>
                  <Label>{teacherName}</Label>
                  <Label muted>
                    Depois de criar, adicione os horários semanais à turma.
                  </Label>
                </>
              )
            }
          </FormWizard>
        </Card>
      ) : null}
      {create.isSuccess ? (
        <Notice
          success
          message="Turma criada. Adicione os horários semanais abaixo."
        />
      ) : null}
      {!creating &&
        (list.isPending ? (
          <Loading />
        ) : list.error ? (
          <Notice message={list.error.message} />
        ) : visible.length ? (
          visible.map((c) => (
            <ClassCard key={c.id} item={c} onFormChange={formChange} />
          ))
        ) : (
          <Empty>As turmas desta academia aparecerão aqui.</Empty>
        ))}
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
