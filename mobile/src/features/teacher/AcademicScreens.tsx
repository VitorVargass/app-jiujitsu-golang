import { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AcademyShell, RoleGate } from "../shared/AcademyShell";
import {
  Button,
  Card,
  Chip,
  Empty,
  Field,
  Heading,
  Label,
  Loading,
  Notice,
  Row,
} from "../../components/ui";
import { Pagination } from "../../components/Pagination";
import { EditorDialog } from "../../components/EditorDialog";
import { api, academyPath } from "../../services/api";
import { queryClient, useSession } from "../../services/session";
import { Class, Attendance } from "../../types";
import { Page, BeltOption } from "../../types/billing";
import { ManualAttendance } from "../attendance/ManualAttendance";
import { HistoryList } from "../attendance/HistoryList";
import { formatBirth } from "../../types/age";

export type AcademicStudent = {
  id: string;
  name: string;
  email: string;
  phone: string;
  alternate_phone: string;
  birth_date: string;
  started_on: string;
  status: string;
  archived_at: string | null;
  student_code: string;
  belt: string;
  modality_ids: string[];
  modality_details: { modality_id: string; belt: string; degrees: number }[];
};
type Modality = {
  id: string;
  name: string;
  active: boolean;
  belt_options: BeltOption[];
};
type Progress = {
  started_on: string;
  active_days: number;
  history: Page<{
    id: string;
    modality_name: string;
    belt: string;
    degrees: number;
    actor_name: string;
    recorded_at: string;
  }>;
};

function Students() {
  const { academy } = useSession();
  const a = academy!;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["academic", "teacher", a.id, "students", search, status, page],
    queryFn: () =>
      api<Page<AcademicStudent>>(
        academyPath(
          a.id,
          "/academic/students?" +
            new URLSearchParams({ search, status, page: String(page) }),
        ),
      ),
  });
  return (
    <AcademyShell
      title="Alunos"
      subtitle="Acompanhamento acadêmico"
      swipeEnabled={false}
    >
      <Field
        label="Buscar por nome ou número do aluno"
        value={search}
        onChangeText={(v) => {
          setSearch(v);
          setPage(1);
        }}
      />
      <Row>
        {[
          ["", "Atuais"],
          ["active", "Ativos"],
          ["inactive", "Inativos"],
          ["archived", "Arquivados"],
        ].map(([value, label]) => (
          <Chip
            key={value}
            selected={status === value}
            onPress={() => {
              setStatus(value);
              setPage(1);
            }}
          >
            {label}
          </Chip>
        ))}
      </Row>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <Notice message={q.error.message} />
      ) : q.data?.items.length ? (
        q.data.items.map((s) => (
          <Card key={s.id}>
            <Heading>{s.name}</Heading>
            <Label muted>
              {s.archived_at
                ? "Arquivado"
                : s.status === "active"
                  ? "Ativo"
                  : "Inativo"}{" "}
              · Nº {s.student_code}
            </Label>
            <Button
              compact
              secondary
              onPress={() =>
                router.push({
                  pathname: "/teacher-student",
                  params: { id: s.id },
                })
              }
            >
              Ver acompanhamento
            </Button>
          </Card>
        ))
      ) : (
        <Empty>Nenhum aluno encontrado.</Empty>
      )}
      <Pagination page={page} total={q.data?.total ?? 0} onChange={setPage} />
    </AcademyShell>
  );
}
export function TeacherStudents() {
  return (
    <RoleGate role="teacher">
      <Students />
    </RoleGate>
  );
}

function RankEditor({
  student,
  modality,
  onClose,
}: {
  student: AcademicStudent;
  modality: Modality;
  onClose: () => void;
}) {
  const { academy } = useSession();
  const a = academy!;
  const rank = student.modality_details.find(
    (r) => r.modality_id === modality.id,
  )!;
  const [belt, setBelt] = useState(rank.belt);
  const [degrees, setDegrees] = useState(rank.degrees);
  const save = useMutation({
    mutationFn: () =>
      api<AcademicStudent>(
        academyPath(
          a.id,
          "/academic/students/" + student.id + "/graduations/" + modality.id,
        ),
        { method: "PATCH", body: { belt, degrees } },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["academic"] });
      onClose();
    },
  });
  const options = modality.belt_options ?? [];
  return (
    <EditorDialog
      title={"Graduação · " + modality.name}
      pending={save.isPending}
      onClose={onClose}
      footer={
        <>
          <Button compact secondary disabled={save.isPending} onPress={onClose}>
            Cancelar
          </Button>
          <Button
            compact
            loading={save.isPending}
            onPress={() => {
              if (!save.isPending) save.mutate();
            }}
          >
            Salvar graduação
          </Button>
        </>
      }
    >
      <Label>Faixa</Label>
      <Row>
        {options.map((o) => (
          <Chip
            key={o.label}
            selected={belt === o.label}
            onPress={() => {
              if (!save.isPending) {
                setBelt(o.label);
                setDegrees(0);
              }
            }}
          >
            {o.label}
          </Chip>
        ))}
      </Row>
      {belt ? (
        <>
          <Label>Graus</Label>
          <Row>
            {[0, 1, 2, 3, 4].map((n) => (
              <Chip
                key={n}
                selected={degrees === n}
                onPress={() => {
                  if (!save.isPending) setDegrees(n);
                }}
              >
                {String(n)}
              </Chip>
            ))}
          </Row>
        </>
      ) : null}
      <Notice message={save.error?.message} />
    </EditorDialog>
  );
}

function StudentProfile() {
  const { academy } = useSession();
  const a = academy!;
  const { id } = useLocalSearchParams<{ id: string }>();
  const [editing, setEditing] = useState<Modality | null>(null);
  const [page, setPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const q = useQuery({
    queryKey: ["academic", "teacher", a.id, "student", id],
    queryFn: () =>
      api<AcademicStudent>(academyPath(a.id, "/academic/students/" + id)),
  });
  const modalities = useQuery({
    queryKey: ["academic", "teacher", a.id, "modalities"],
    queryFn: () => api<Modality[]>(academyPath(a.id, "/academic/modalities")),
  });
  const progress = useQuery({
    queryKey: ["academic", "teacher", a.id, "progress", id, page],
    queryFn: () =>
      api<Progress>(
        academyPath(
          a.id,
          "/students/" + id + "/progress?page=" + page + "&page_size=10",
        ),
      ),
    enabled: !!q.data,
  });
  const history = useQuery({
    queryKey: ["academic", "teacher", a.id, "attendance", id, historyPage],
    queryFn: () =>
      api<Page<Attendance>>(
        academyPath(
          a.id,
          "/attendances?student_id=" +
            id +
            "&page=" +
            historyPage +
            "&page_size=10",
        ),
      ),
    enabled: !!q.data,
  });
  const s = q.data;
  return (
    <AcademyShell
      title={s?.name ?? "Aluno"}
      subtitle="Dados e evolução acadêmica"
      swipeEnabled={false}
    >
      <Button
        compact
        secondary
        onPress={() => router.replace("/teacher-students")}
      >
        Voltar aos alunos
      </Button>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <Notice message={q.error.message} />
      ) : s ? (
        <>
          <Card>
            <Heading>Dados do aluno</Heading>
            <Label>
              {s.archived_at
                ? "Arquivado"
                : s.status === "active"
                  ? "Ativo"
                  : "Inativo"}{" "}
              · Nº {s.student_code}
            </Label>
            <Label>
              Nascimento:{" "}
              {s.birth_date ? formatBirth(s.birth_date) : "Não informado"}
            </Label>
            <Label>E-mail: {s.email || "Não informado"}</Label>
            <Label>Telefone: {s.phone || "Não informado"}</Label>
            {s.alternate_phone ? (
              <Label>Outro contato: {s.alternate_phone}</Label>
            ) : null}
          </Card>
          <Card>
            <Heading>Graduação por modalidade</Heading>
            <Notice message={modalities.error?.message} />
            {modalities.isPending ? <Loading /> : null}
            {s.modality_details.map((rank) => {
              const m = modalities.data?.find((v) => v.id === rank.modality_id);
              return (
                <View key={rank.modality_id} style={{ gap: 10 }}>
                  <Label>
                    {m?.name ?? "Modalidade"} · {rank.belt || "Sem faixa"} ·{" "}
                    {rank.degrees} grau(s)
                  </Label>
                  {m &&
                  !s.archived_at &&
                  (rank.belt || m.belt_options?.length) ? (
                    <Button compact secondary onPress={() => setEditing(m)}>
                      Alterar faixa e graus
                    </Button>
                  ) : null}
                </View>
              );
            })}
          </Card>
          <Card>
            <Heading>Evolução</Heading>
            {progress.isPending ? (
              <Loading />
            ) : progress.error ? (
              <Notice message={progress.error.message} />
            ) : progress.data ? (
              <>
                <Label>
                  Início: {formatBirth(progress.data.started_on)} ·{" "}
                  {progress.data.active_days} dias de atividade acompanhada
                </Label>
                {progress.data.history.items.map((e) => (
                  <View key={e.id} style={{ gap: 4 }}>
                    <Label>
                      {e.modality_name}: {e.belt || "Sem faixa"} · {e.degrees}{" "}
                      grau(s)
                    </Label>
                    <Label muted>
                      {new Date(e.recorded_at).toLocaleDateString("pt-BR", {
                        timeZone: a.timezone,
                      })}{" "}
                      · {e.actor_name || "Registro inicial"}
                    </Label>
                  </View>
                ))}
                <Pagination
                  page={page}
                  total={progress.data.history.total}
                  size={10}
                  onChange={setPage}
                />
              </>
            ) : null}
          </Card>
          <Heading>Presenças</Heading>
          <ManualAttendance
            studentId={s.id}
            disabled={!!s.archived_at || s.status !== "active"}
            onRecorded={() =>
              void queryClient.invalidateQueries({ queryKey: ["academic"] })
            }
          />
          {history.isPending ? (
            <Loading />
          ) : history.error ? (
            <Notice message={history.error.message} />
          ) : history.data?.items.length ? (
            <HistoryList
              items={history.data.items}
              timezone={a.timezone}
              admin={false}
            />
          ) : (
            <Empty>Nenhuma presença registrada.</Empty>
          )}
          <Pagination
            page={historyPage}
            total={history.data?.total ?? 0}
            size={10}
            onChange={setHistoryPage}
          />
          {editing ? (
            <RankEditor
              student={s}
              modality={editing}
              onClose={() => setEditing(null)}
            />
          ) : null}
        </>
      ) : null}
    </AcademyShell>
  );
}
export function TeacherStudent() {
  return (
    <RoleGate role="teacher">
      <StudentProfile />
    </RoleGate>
  );
}

function Classes() {
  const { academy } = useSession();
  const a = academy!;
  const q = useQuery({
    queryKey: ["academic", "teacher", a.id, "classes"],
    queryFn: () => api<Class[]>(academyPath(a.id, "/classes")),
  });
  const days = [
    "Domingo",
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado",
  ];
  return (
    <AcademyShell
      title="Turmas"
      subtitle="Horários e presenças da academia"
      swipeEnabled={false}
    >
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <Notice message={q.error.message} />
      ) : q.data?.length ? (
        q.data.map((c) => (
          <Card key={c.id}>
            <Heading>{c.name}</Heading>
            <Label>
              {c.modality_name} · {c.active ? "Ativa" : "Pausada"}
            </Label>
            <Label muted>
              Professor: {c.teacher_name || "Sem professor atribuído"}
            </Label>
            {c.schedules.map((sc) => (
              <View key={sc.id} style={{ gap: 8 }}>
                <Label>
                  {days[sc.weekday]} · {sc.start_time.slice(0, 5)} ·{" "}
                  {sc.duration_minutes} min
                </Label>
                {c.active ? <ManualAttendance scheduleId={sc.id} /> : null}
              </View>
            ))}
          </Card>
        ))
      ) : (
        <Empty>Nenhuma turma cadastrada.</Empty>
      )}
    </AcademyShell>
  );
}
export function TeacherClasses() {
  return (
    <RoleGate role="teacher">
      <Classes />
    </RoleGate>
  );
}
