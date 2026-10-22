import { useQuery } from "@tanstack/react-query";
import { EditorDialog } from "../../components/EditorDialog";
import { Button, Loading, Notice } from "../../components/ui";
import { api, academyPath } from "../../services/api";
import { Credential } from "../../types";
import { StudentNumberCard } from "../student/StudentNumberCard";

export function StudentCardDialog({
  academyId,
  academyName,
  studentId,
  onClose,
}: {
  academyId: string;
  academyName: string;
  studentId: string;
  onClose: () => void;
}) {
  const q = useQuery({
    queryKey: ["student-card", academyId, studentId],
    queryFn: () =>
      api<Credential>(
        academyPath(academyId, "/students/" + studentId + "/credential"),
      ),
  });
  return (
    <EditorDialog title="Cartão de presença" onClose={onClose}>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <>
          <Notice message={q.error.message} />
          <Button secondary compact onPress={() => void q.refetch()}>
            Tentar novamente
          </Button>
        </>
      ) : (
        <StudentNumberCard
          name={q.data.student_name}
          academy={academyName}
          code={q.data.student_code}
          qrToken={q.data.qr_token}
        />
      )}
    </EditorDialog>
  );
}
