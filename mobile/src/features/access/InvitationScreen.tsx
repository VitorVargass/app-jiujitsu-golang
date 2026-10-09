import { router, useLocalSearchParams, Redirect } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import {
  Page,
  Button,
  Card,
  Heading,
  Label,
  Loading,
  Notice,
} from "../../components/ui";
import { api } from "../../services/api";
import { useSession } from "../../services/session";
import { Academy } from "../../types";
import { Student } from "../../types/billing";
export default function InvitationScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { ready, session, select, logout } = useSession();
  const accept = useMutation({
    mutationFn: async () => {
      const st = await api<Student>("/v1/invitations/" + token + "/accept", {
        method: "POST",
      });
      const academies = await api<Academy[]>("/v1/me/academies");
      const a = academies.find((a) => a.id === st.academy_id);
      if (!a) throw new Error("Atualize suas academias para continuar.");
      select(a, "student");
      router.replace("/student");
    },
  });
  if (!ready)
    return (
      <Page>
        <Loading />
      </Page>
    );
  if (!session)
    return (
      <Redirect
        href={{ pathname: "/login", params: { next: "/invite/" + token } }}
      />
    );
  return (
    <Page title="Convite da academia">
      <Card>
        <Heading>Vincule seu cadastro</Heading>
        <Label>
          Ao aceitar, esta conta poderá consultar suas mensalidades e presenças
          na academia.
        </Label>
        <Label>
          Conta atual: {session.kind === "user" ? session.user.email : "Tablet"}
        </Label>
      </Card>
      <Notice message={accept.error?.message} />
      <Button
        disabled={session.kind !== "user"}
        loading={accept.isPending}
        onPress={() => accept.mutate()}
      >
        Aceitar convite
      </Button>
      <Button secondary onPress={() => void logout()}>
        Entrar com outra conta
      </Button>
    </Page>
  );
}
