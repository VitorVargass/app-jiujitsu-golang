import { useRef, useState } from "react";
import { View } from "react-native";
import * as Crypto from "expo-crypto";
import { useMutation, useQuery } from "@tanstack/react-query";
import { EditorDialog } from "../../components/EditorDialog";
import {
  Badge,
  Button,
  Chip,
  Field,
  Label,
  Loading,
  Notice,
  Row,
} from "../../components/ui";
import { academyPath, api } from "../../services/api";
import { queryClient, useSession } from "../../services/session";
import { AttendanceOptions, CheckinResult } from "../../types";
import { academyDate } from "../../types/attendance";
import { Page, Student } from "../../types/billing";
import { birthToISO, formatBirth } from "../../types/age";
import { displayTime } from "../../theme";

export function ManualAttendance({
  studentId,
  scheduleId,
  date,
  disabled = false,
  label = "Lançar presença",
  onRecorded,
}: {
  studentId?: string;
  scheduleId?: string;
  date?: string;
  disabled?: boolean;
  label?: string;
  onRecorded?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <>
      <Button
        compact
        secondary
        icon="plus"
        disabled={disabled}
        onPress={() => {
          setMessage("");
          setOpen(true);
        }}
      >
        {label}
      </Button>
      <Notice success message={message} />
      {open ? (
        <ManualAttendanceDialog
          studentId={studentId}
          scheduleId={scheduleId}
          initialDate={date}
          onClose={() => setOpen(false)}
          onRecorded={() => {
            setOpen(false);
            setMessage("Presença confirmada no histórico do aluno.");
            onRecorded?.();
          }}
        />
      ) : null}
    </>
  );
}
export function ManualAttendanceDialog({
  studentId,
  scheduleId,
  initialDate,
  onClose,
  onRecorded,
}: {
  studentId?: string;
  scheduleId?: string;
  initialDate?: string;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const { academy } = useSession(),
    a = academy!;
  const today = academyDate(a.timezone);
  const [day, setDay] = useState(formatBirth(initialDate ?? today));
  const date = birthToISO(day);
  const validDate =
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(new Date(date + "T12:00:00Z").getTime()) &&
    new Date(date + "T12:00:00Z").toISOString().slice(0, 10) === date &&
    date <= today &&
    date >= "2020-01-01";
  const [selected, setSelected] = useState(scheduleId ?? "");
  const [student, setStudent] = useState(studentId ?? "");
  const [search, setSearch] = useState("");
  const submitting = useRef(false);
  const attempt = useRef<{
    body: { student_id: string; schedule_id: string; date: string };
    key: string;
  } | null>(null);
  const lessons = useQuery({
    queryKey: ["manual-lessons", a.id, date],
    queryFn: () =>
      api<AttendanceOptions>(
        academyPath(a.id, "/attendance-options?date=" + date),
      ),
    enabled: validDate,
  });
  const students = useQuery({
    queryKey: ["manual-students", a.id, search],
    queryFn: () =>
      api<Page<Student>>(
        academyPath(
          a.id,
          "/students?search=" + encodeURIComponent(search) + "&status=active",
        ),
      ),
    enabled: !studentId && search.trim().length >= 2,
  });
  const chosen = lessons.data?.options.find(
    (item) => item.schedule_id === selected,
  );
  const save = useMutation({
    mutationFn: () =>
      api<CheckinResult>(academyPath(a.id, "/attendances"), {
        method: "POST",
        body: attempt.current!.body,
        key: attempt.current!.key,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      onRecorded();
    },
  });
  async function submit() {
    if (submitting.current || !chosen?.can_record || !student || !validDate)
      return;
    const body = { student_id: student, schedule_id: chosen.schedule_id, date };
    if (
      !attempt.current ||
      JSON.stringify(attempt.current.body) !== JSON.stringify(body)
    )
      attempt.current = { body, key: Crypto.randomUUID() };
    submitting.current = true;
    try {
      await save.mutateAsync();
    } catch {
      /* Error remains visible with the same retry key. */
    } finally {
      submitting.current = false;
    }
  }
  return (
    <EditorDialog
      title="Lançar presença"
      pending={save.isPending}
      onClose={onClose}
      footer={
        <Row>
          <Button compact secondary disabled={save.isPending} onPress={onClose}>
            Cancelar
          </Button>
          <Button
            compact
            loading={save.isPending}
            disabled={!validDate || !student || !chosen?.can_record}
            onPress={() => void submit()}
          >
            Confirmar presença
          </Button>
        </Row>
      }
    >
      <Badge label="Lançamento pelo gestor" tone="blue" />
      <Label muted>
        Escolha o dia em que o aluno treinou e a aula. O histórico também
        guardará quando este lançamento foi feito.
      </Label>
      {!studentId ? (
        <>
          <Field
            label="Buscar aluno por nome ou CPF"
            value={search}
            onChangeText={(v) => {
              setSearch(v);
              setStudent("");
            }}
            editable={!save.isPending}
          />
          <Notice message={students.error?.message} />
          <View style={{ gap: 8 }}>
            {students.data?.items.map((item) => (
              <Chip
                key={item.id}
                selected={student === item.id}
                onPress={save.isPending ? undefined : () => setStudent(item.id)}
              >
                {item.name}
              </Chip>
            ))}
          </View>
        </>
      ) : null}
      <Field
        label="Dia do treino"
        placeholder="DD/MM/AAAA"
        keyboardType="number-pad"
        value={day}
        maxLength={10}
        editable={!save.isPending}
        onChangeText={(v) => {
          setDay(formatBirth(v));
          setSelected("");
          save.reset();
        }}
      />
      {!validDate ? (
        <Label muted>
          Informe uma data válida até hoje, no formato DD/MM/AAAA.
        </Label>
      ) : lessons.isPending ? (
        <Loading />
      ) : lessons.error ? (
        <>
          <Notice message={lessons.error.message} />
          <Button compact secondary onPress={() => void lessons.refetch()}>
            Atualizar aulas
          </Button>
        </>
      ) : lessons.data?.options.length ? (
        <>
          <Label>Aula que o aluno frequentou</Label>
          <View style={{ gap: 8 }}>
            {lessons.data.options.map((item) => (
              <Chip
                key={item.schedule_id}
                selected={selected === item.schedule_id}
                onPress={
                  !save.isPending && item.can_record
                    ? () => {
                        setSelected(item.schedule_id);
                        save.reset();
                      }
                    : undefined
                }
              >
                {item.class_name} • {displayTime(item.starts_at, a.timezone)}
                {item.can_record ? "" : " • Ainda não começou"}
              </Chip>
            ))}
          </View>
        </>
      ) : (
        <Label muted>
          Não há aulas na grade para esse dia. Confira os horários em Turmas.
        </Label>
      )}
      <Notice message={save.error?.message} />
    </EditorDialog>
  );
}
