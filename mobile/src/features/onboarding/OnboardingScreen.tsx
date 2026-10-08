import { useState } from "react";
import { Redirect, router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Page,
  Card,
  Heading,
  Label,
  Field,
  Button,
  Notice,
  Row,
  Chip,
  Loading,
  Empty,
  Avatar,
} from "../../components/ui";
import { api } from "../../services/api";
import { useSession, queryClient } from "../../services/session";
import { Academy, MembershipRequest, Role } from "../../types";
import { roleLabel } from "../../theme";
export default function OnboardingScreen() {
  const { session, select, logout } = useSession();
  const [kind, setKind] = useState<Role>("student"),
    [name, setName] = useState(""),
    [code, setCode] = useState("");
  const academies = useQuery({
    queryKey: ["academies"],
    queryFn: () => api<Academy[]>("/v1/me/academies"),
    enabled: session?.kind === "user",
    refetchInterval: 15000,
  });
  const requests = useQuery({
    queryKey: ["own-requests"],
    queryFn: () => api<MembershipRequest[]>("/v1/me/membership-requests"),
    enabled: session?.kind === "user",
    refetchInterval: 15000,
  });
  const change = useMutation({
    mutationFn: async () => {
      if (kind === "admin") {
        const a = await api<Academy>("/v1/academies", {
          method: "POST",
          body: { name },
        });
        select(a, "admin");
        router.replace("/academy");
      } else
        await api("/v1/membership-requests", {
          method: "POST",
          body: { academy_code: code, role: kind },
        });
    },
    onSuccess: () => {
      setCode("");
      setName("");
      void queryClient.invalidateQueries();
    },
  });
  if (session?.kind === "device") return <Redirect href="/kiosk" />;
  function enter(a: Academy, r: Role) {
    select(a, r);
    router.push(
      r === "student" ? "/student" : r === "teacher" ? "/teacher" : "/academy",
    );
  }
  return (
    <Page
      title={
        "Olá, " +
        (session?.kind === "user" ? session.user.name.split(" ")[0] : "") +
        "!"
      }
      subtitle="Escolha uma academia ou comece uma nova jornada."
      action={<Chip onPress={() => void logout()}>Sair</Chip>}
    >
      <Heading>Minhas academias</Heading>
      {academies.isPending ? (
        <Loading />
      ) : academies.error ? (
        <Notice message={academies.error.message} />
      ) : academies.data?.length ? (
        academies.data.map((a) => (
          <Card key={a.id}>
            <Row>
              <Avatar name={a.name} />
              <Heading>{a.name}</Heading>
            </Row>
            <Label muted>{a.belt}</Label>
            {a.status === "blocked" ? (
              <Notice message="Seu vínculo está bloqueado. Converse com o gestor." />
            ) : (
              <Row>
                {a.roles.map((r) => (
                  <Chip key={r} onPress={() => enter(a, r)}>
                    {roleLabel[r]} →
                  </Chip>
                ))}
              </Row>
            )}
          </Card>
        ))
      ) : (
        <Empty>
          Sua primeira academia aparecerá aqui após a aprovação do gestor.
        </Empty>
      )}
      <Heading>Como você vai usar o Tatame?</Heading>
      <Row>
        {(["student", "teacher", "admin"] as Role[]).map((r) => (
          <Chip
            key={r}
            selected={kind === r}
            onPress={() => {
              setKind(r);
              change.reset();
            }}
          >
            {r === "admin" ? "Academia" : roleLabel[r]}
          </Chip>
        ))}
      </Row>
      <Card>
        {kind === "admin" ? (
          <>
            <Heading>Crie sua academia</Heading>
            <Label muted>
              Você será o gestor e poderá aprovar a equipe e os alunos.
            </Label>
            <Field
              label="Nome da academia"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </>
        ) : (
          <>
            <Heading>
              {kind === "teacher"
                ? "Ensine na sua academia"
                : "Entre para sua academia"}
            </Heading>
            <Label muted>
              Peça o código ao gestor. Seu vínculo será liberado após aprovação.
            </Label>
            <Field
              label="Código da academia"
              value={code}
              onChangeText={setCode}
              placeholder="Código fornecido pelo gestor"
            />
          </>
        )}
        <Notice message={change.error?.message} />
        {change.isSuccess && kind !== "admin" && (
          <Notice
            success
            message="Solicitação enviada. Aguarde a aprovação do gestor."
          />
        )}
        <Button loading={change.isPending} onPress={() => change.mutate()}>
          {kind === "admin" ? "Criar academia" : "Solicitar vínculo"}
        </Button>
      </Card>
      {(requests.data || [])
        .filter((q) => q.status === "pending")
        .map((q) => (
          <Card key={q.id}>
            <Heading>{q.academy_name}</Heading>
            <Label muted>{roleLabel[q.role]} • Aguardando aprovação</Label>
          </Card>
        ))}
    </Page>
  );
}
