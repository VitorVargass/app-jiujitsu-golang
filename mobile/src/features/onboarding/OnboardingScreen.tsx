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
} from "../../components/ui";
import { api } from "../../services/api";
import { useSession } from "../../services/session";
import { Academy } from "../../types";
export default function OnboardingScreen() {
  const { session, select, logout } = useSession();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const academies = useQuery({
    queryKey: ["academies"],
    queryFn: () => api<Academy[]>("/v1/me/academies"),
    enabled: session?.kind === "user",
  });
  const create = useMutation({
    mutationFn: () =>
      api<Academy>("/v1/academies", { method: "POST", body: { name } }),
    onSuccess: (a) => {
      select(a, "admin");
      router.replace("/academy");
    },
  });
  if (session?.kind === "device") return <Redirect href="/kiosk" />;
  return (
    <Page
      title="Seu tatame."
      subtitle="Escolha a academia para continuar."
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
            <Heading>{a.name}</Heading>
            <Row>
              {a.roles.includes("admin") && a.status === "active" ? (
                <Button
                  onPress={() => {
                    select(a, "admin");
                    router.replace("/academy");
                  }}
                >
                  Gerenciar academia
                </Button>
              ) : null}
              {a.roles.includes("student") ? (
                <Button
                  secondary
                  onPress={() => {
                    select(a, "student");
                    router.replace("/student");
                  }}
                >
                  Área do aluno
                </Button>
              ) : null}
              {!a.roles.some((r) => r === "admin" || r === "student") ? (
                <Label muted>
                  Peça um convite de aluno ao gestor para acessar o portal.
                </Label>
              ) : null}
            </Row>
          </Card>
        ))
      ) : (
        <Empty>
          Abra o convite enviado pela academia para vincular seu cadastro.
        </Empty>
      )}
      <Button secondary onPress={() => void academies.refetch()}>
        Atualizar academias
      </Button>
      <Button secondary onPress={() => setCreating(!creating)}>
        {creating ? "Fechar cadastro" : "Sou gestor • Criar academia"}
      </Button>
      {creating ? (
        <Card>
          <Heading>Nova academia</Heading>
          <Field
            label="Nome da academia"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          <Notice message={create.error?.message} />
          <Button
            disabled={name.trim().length < 2}
            loading={create.isPending}
            onPress={() => create.mutate()}
          >
            Criar academia
          </Button>
        </Card>
      ) : null}
    </Page>
  );
}
