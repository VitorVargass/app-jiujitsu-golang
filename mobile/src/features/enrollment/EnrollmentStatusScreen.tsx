import { useState } from "react";
import { Redirect, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  Page,
  Card,
  Heading,
  Label,
  Button,
  Loading,
  Notice,
} from "../../components/ui";
import { Pagination } from "../../components/Pagination";
import { api } from "../../services/api";
import { useSession } from "../../services/session";
import type { Page as ResultPage } from "../../types/billing";
import type { EnrollmentRequest } from "./types";
const labels = {
  pending: "Aguardando confirmação da academia",
  active: "Matrícula ativa",
  approved: "Acesso aprovado",
  rejected: "Pedido não aprovado",
};
export default function EnrollmentStatusScreen() {
  const { ready, session, reloadAcademies } = useSession();
  const [page, setPage] = useState(1);
  const list = useQuery({
    queryKey: [
      "my-enrollment-requests",
      session?.kind === "user" ? session.user.id : "",
      page,
    ],
    queryFn: () =>
      api<ResultPage<EnrollmentRequest>>(
        "/v1/me/enrollment-requests?page=" + page,
      ),
    enabled: ready && session?.kind === "user",
    refetchInterval: 15000,
  });
  if (!ready)
    return (
      <Page>
        <Loading />
      </Page>
    );
  if (!session) return <Redirect href="/login" />;
  if (session.kind === "device") return <Redirect href="/kiosk" />;
  return (
    <Page title="Minhas matrículas">
      <Label muted>
        Pedidos para cadastros existentes aguardam a confirmação da academia.
        Você não precisa repetir o cadastro.
      </Label>
      {list.isPending ? (
        <Loading />
      ) : list.error ? (
        <Notice message={list.error.message} />
      ) : (
        list.data?.items.map((x) => (
          <Card key={x.id}>
            <Heading>{x.academy_name}</Heading>
            <Label>{x.student_name}</Label>
            <Label>{labels[x.status]}</Label>
          </Card>
        ))
      )}
      {list.data && !list.data.items.length ? (
        <Label>Nenhuma matrícula enviada por esta conta.</Label>
      ) : null}
      {list.data ? (
        <Pagination page={page} total={list.data.total} onChange={setPage} />
      ) : null}
      <Button
        onPress={() => {
          reloadAcademies();
          router.replace("/entry");
        }}
      >
        Acessar academia
      </Button>
      <Button secondary onPress={() => list.refetch()}>
        Atualizar pedidos
      </Button>
    </Page>
  );
}
