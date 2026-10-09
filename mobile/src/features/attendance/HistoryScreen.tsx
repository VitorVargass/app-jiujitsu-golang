import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AcademyShell, RoleGate } from "../shared/AcademyShell";
import {
  Card,
  Heading,
  Label,
  Field,
  Empty,
  Loading,
  Notice,
  Chip,
  Row,
} from "../../components/ui";
import { Pagination } from "../../components/Pagination";
import { api, academyPath } from "../../services/api";
import { useSession } from "../../services/session";
import { Attendance, Class } from "../../types";
import { Page, Student } from "../../types/billing";
import { displayDate, displayTime } from "../../theme";
function Content({ admin }: { admin: boolean }) {
  const { academy } = useSession();
  const a = academy!;
  const [page, setPage] = useState(1);
  const [month, setMonth] = useState("");
  const [cid, setCid] = useState("");
  const [search, setSearch] = useState("");
  const [sid, setSid] = useState("");
  const history = useQuery({
    queryKey: ["history", a.id, admin, page, month, cid, sid],
    queryFn: () =>
      api<Page<Attendance>>(
        academyPath(
          a.id,
          (admin ? "/attendances" : "/me/attendances") +
            "?page=" +
            page +
            "&month=" +
            encodeURIComponent(month) +
            "&class_id=" +
            cid +
            "&student_id=" +
            sid,
        ),
      ),
    refetchInterval: 10000,
  });
  const classes = useQuery({
    queryKey: ["classes", a.id],
    queryFn: () => api<Class[]>(academyPath(a.id, "/classes")),
    enabled: admin,
  });
  const students = useQuery({
    queryKey: ["history-students", a.id, search],
    queryFn: () =>
      api<Page<Student>>(
        academyPath(a.id, "/students?search=" + encodeURIComponent(search)),
      ),
    enabled: admin && search.length >= 2,
  });
  return (
    <AcademyShell title={admin ? "Presenças da academia" : "Minhas presenças"}>
      <Field
        label="Filtrar mês (YYYY-MM)"
        value={month}
        onChangeText={(v) => {
          setMonth(v);
          setPage(1);
        }}
        placeholder="Todos os meses"
      />
      {admin ? (
        <>
          <Row>
            <Chip
              selected={!cid}
              onPress={() => {
                setCid("");
                setPage(1);
              }}
            >
              Todas as turmas
            </Chip>
            {classes.data?.map((c) => (
              <Chip
                key={c.id}
                selected={cid === c.id}
                onPress={() => {
                  setCid(c.id);
                  setPage(1);
                }}
              >
                {c.name}
              </Chip>
            ))}
          </Row>
          <Field
            label="Buscar aluno"
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
          </Row>
        </>
      ) : null}
      {history.isPending ? (
        <Loading />
      ) : history.error ? (
        <Notice message={history.error.message} />
      ) : history.data?.items.length ? (
        history.data.items.map((p) => (
          <Card key={p.id}>
            <Heading>{p.class_name}</Heading>
            {admin ? (
              <Label>
                {p.student_name} • {p.belt}
              </Label>
            ) : null}
            <Label muted>
              {displayDate(p.checked_in_at, a.timezone)} •{" "}
              {displayTime(p.checked_in_at, a.timezone)} • ✓ Presente
            </Label>
          </Card>
        ))
      ) : (
        <Empty>Nenhuma presença neste filtro.</Empty>
      )}
      {history.data ? (
        <Pagination page={page} total={history.data.total} onChange={setPage} />
      ) : null}
    </AcademyShell>
  );
}
export default function HistoryScreen({ admin = false }: { admin?: boolean }) {
  return (
    <RoleGate role={admin ? "admin" : "student"}>
      <Content admin={admin} />
    </RoleGate>
  );
}
