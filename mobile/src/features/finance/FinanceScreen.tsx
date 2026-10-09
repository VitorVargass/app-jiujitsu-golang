import { useState } from "react";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
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
import { api, academyPath } from "../../services/api";
import { useSession } from "../../services/session";
import {
  Invoice,
  Page,
  Student,
  money,
  statusLabel,
} from "../../types/billing";
export function InvoiceList({ student = false }: { student?: boolean }) {
  const { academy } = useSession();
  const a = academy!;
  const [status, setStatus] = useState("");
  const [month, setMonth] = useState("");
  const [sid, setSid] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const invoices = useQuery({
    queryKey: ["invoices", a.id, student, status, month, sid, page],
    queryFn: () =>
      api<Page<Invoice>>(
        academyPath(
          a.id,
          (student ? "/me/invoices" : "/invoices") +
            "?page=" +
            page +
            "&status=" +
            status +
            "&month=" +
            encodeURIComponent(month) +
            "&student_id=" +
            sid,
        ),
      ),
  });
  const students = useQuery({
    queryKey: ["students-filter", a.id, search],
    queryFn: () =>
      api<Page<Student>>(
        academyPath(a.id, "/students?search=" + encodeURIComponent(search)),
      ),
    enabled: !student && search.length >= 2,
  });
  return (
    <AcademyShell title={student ? "Minhas mensalidades" : "Financeiro"}>
      <Card>
        <Row>
          {(["", "open", "paid", "overdue", "cancelled"] as const).map((s) => (
            <Chip
              key={s}
              selected={status === s}
              onPress={() => {
                setStatus(s);
                setPage(1);
              }}
            >
              {s ? statusLabel[s] : "Todas"}
            </Chip>
          ))}
        </Row>
        <Field
          label="Competência (YYYY-MM)"
          placeholder="Todas as competências"
          value={month}
          onChangeText={(v) => {
            setMonth(v);
            setPage(1);
          }}
        />
        {!student ? (
          <>
            <Field
              label="Filtrar aluno pelo nome"
              value={search}
              onChangeText={(v) => {
                setSearch(v);
                setSid("");
                setPage(1);
              }}
            />
            <Row>
              {students.data?.items.map((s) => (
                <Chip
                  key={s.id}
                  selected={sid === s.id}
                  onPress={() => {
                    setSid(s.id);
                    setPage(1);
                  }}
                >
                  {s.name}
                </Chip>
              ))}
              {sid ? (
                <Chip onPress={() => setSid("")}>Limpar aluno</Chip>
              ) : null}
            </Row>
          </>
        ) : null}
      </Card>
      {invoices.isPending ? (
        <Loading />
      ) : invoices.error ? (
        <Notice message={invoices.error.message} />
      ) : invoices.data?.items.length ? (
        invoices.data.items.map((i) => (
          <Card key={i.id}>
            <Heading>{money(i.amount_cents)}</Heading>
            <Label>
              {student ? i.competence : i.student_name + " • " + i.competence}
            </Label>
            <Label muted>
              Vencimento: {i.due_date.split("-").reverse().join("/")} •{" "}
              {statusLabel[i.status]}
            </Label>
            <Button
              secondary
              onPress={() =>
                router.push({ pathname: "/invoice/[id]", params: { id: i.id } })
              }
            >
              {i.status === "paid" ? "Ver pagamento" : "Abrir mensalidade"}
            </Button>
          </Card>
        ))
      ) : (
        <Empty>
          {student
            ? "Nenhuma mensalidade emitida pela academia."
            : "As mensalidades aparecem após ativar a cobrança no cadastro do aluno."}
        </Empty>
      )}
      {invoices.data ? (
        <Pagination
          page={page}
          total={invoices.data.total}
          onChange={setPage}
        />
      ) : null}
      <Button secondary onPress={() => void invoices.refetch()}>
        Atualizar
      </Button>
    </AcademyShell>
  );
}
export default function FinanceScreen() {
  return (
    <RoleGate role="admin">
      <InvoiceList />
    </RoleGate>
  );
}
