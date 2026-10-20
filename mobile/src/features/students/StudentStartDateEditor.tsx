import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { EditorDialog } from "../../components/EditorDialog";
import { Button, Field, Label, Notice } from "../../components/ui";
import { api, academyPath } from "../../services/api";
import { queryClient } from "../../services/session";
import { Student } from "../../types/billing";
import { ageOn, birthToISO, formatBirth } from "../../types/age";

export function StudentStartDateEditor({
  student,
  academyId,
  timezone,
  onClose,
}: {
  student: Student;
  academyId: string;
  timezone: string;
  onClose: () => void;
}) {
  const [date, setDate] = useState(formatBirth(student.started_on));
  const [expected] = useState(student.started_on);
  const value = birthToISO(date);
  const valid =
    ageOn(value, timezone) !== null &&
    (!student.birth_date || value >= student.birth_date);
  const save = useMutation({
    mutationFn: () =>
      api<Student>(
        academyPath(academyId, "/students/" + student.id + "/start-date"),
        {
          method: "PATCH",
          body: { started_on: value, expected_started_on: expected },
        },
      ),
    onSuccess: (updated) => {
      queryClient.setQueryData(["student", academyId, student.id], updated);
      void queryClient.invalidateQueries();
      onClose();
    },
    onError: () => {
      void queryClient.invalidateQueries({
        queryKey: ["student", academyId, student.id],
      });
    },
  });
  return (
    <EditorDialog
      title="Início na academia"
      onClose={onClose}
      pending={save.isPending}
      footer={
        <>
          <Button compact secondary disabled={save.isPending} onPress={onClose}>
            Cancelar
          </Button>
          <Button
            compact
            icon="check-circle"
            loading={save.isPending}
            disabled={!valid}
            onPress={() => save.mutate()}
          >
            Salvar data de início
          </Button>
        </>
      }
    >
      <Label muted>
        Informe quando o aluno começou a treinar nesta academia, mesmo que tenha
        sido antes do cadastro no aplicativo.
      </Label>
      <Field
        label="Data de início na academia"
        value={date}
        onChangeText={(v) => {
          setDate(formatBirth(v));
          save.reset();
        }}
        placeholder="DD/MM/AAAA"
        keyboardType="number-pad"
        maxLength={10}
        editable={!save.isPending}
      />
      {date && !valid ? (
        <Notice message="Informe uma data válida, entre o nascimento do aluno e hoje." />
      ) : null}
      <Label muted>
        Essa data define o tempo na academia. A mensalidade segue o mês de
        início definido no contrato.
      </Label>
      <Notice message={save.error?.message} />
    </EditorDialog>
  );
}
