import { useQuery } from "@tanstack/react-query";
import { View, Text } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { AcademyShell, RoleGate } from "../shared/AcademyShell";
import { Card, Heading, Label, Notice, Loading } from "../../components/ui";
import { api, academyPath } from "../../services/api";
import { useSession } from "../../services/session";
import { formatCPF } from "../../types/cpf";
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
    <AcademyShell title="Meu CPF e QR">
      {credential.isPending ? (
        <Loading />
      ) : credential.error ? (
        <Notice message={credential.error.message} />
      ) : credential.data ? (
        <Card style={{ alignItems: "center", paddingVertical: 32 }}>
          <View style={{ backgroundColor: "white", padding: 20 }}>
            <QRCode
              value={credential.data.qr_token}
              size={220}
              color="black"
              backgroundColor="white"
            />
          </View>
          <Text
            selectable
            style={{
              color: "white",
              fontSize: credential.data.cpf ? 22 : 30,
              fontFamily: "Inter_700Bold",
              letterSpacing: 1,
            }}
          >
            {credential.data.cpf
              ? formatCPF(credential.data.cpf)
              : credential.data.student_code}
          </Text>
          <Heading>{credential.data.student_name}</Heading>
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
        Apresente o QR Code no tablet ou digite seu CPF. Se seu cadastro ainda
        não tiver CPF, peça ao gestor para atualizá-lo.
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
