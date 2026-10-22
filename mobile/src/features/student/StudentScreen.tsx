import { useQuery } from "@tanstack/react-query";
import { StudentNumberCard } from "./StudentNumberCard";
import { AcademyShell, RoleGate } from "../shared/AcademyShell";
import { Card, Label, Notice, Loading } from "../../components/ui";
import { api, academyPath } from "../../services/api";
import { useSession } from "../../services/session";
import { Credential } from "../../types";
import { InvoiceList } from "../finance/FinanceScreen";
export function QRScreen() {
  const { academy } = useSession();
  const a = academy!;
  const credential = useQuery({
    queryKey: ["credential", a.id],
    queryFn: () =>
      api<Credential & { status: string }>(
        academyPath(a.id, "/me/student-credential"),
      ),
  });
  return (
    <AcademyShell title="Meu número e QR">
      {credential.isPending ? (
        <Loading />
      ) : credential.error ? (
        <Notice message={credential.error.message} />
      ) : credential.data ? (
        <Card style={{ alignItems: "center", paddingVertical: 32 }}>
          <StudentNumberCard
            name={credential.data.student_name}
            academy={a.name}
            code={credential.data.student_code}
            qrToken={credential.data.qr_token}
          />
          <Label muted>
            {credential.data.belt} • {a.name}
          </Label>
          {credential.data.status === "inactive" ? (
            <Notice
              message={
                credential.data.archived_at
                  ? "Seu cadastro está arquivado. Peça ao gestor para restaurá-lo antes de voltar aos treinos."
                  : "Seu cadastro está inativo. Converse com a academia para voltar aos treinos."
              }
            />
          ) : null}
        </Card>
      ) : null}
      <Label muted>
        O número é permanente nesta academia e continua o mesmo ao restaurar seu
        cadastro.
      </Label>
    </AcademyShell>
  );
}
export default function StudentScreen() {
  return (
    <RoleGate role="student">
      <InvoiceList student />
    </RoleGate>
  );
}
