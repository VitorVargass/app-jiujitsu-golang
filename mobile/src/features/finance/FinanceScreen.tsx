import { MonthPicker } from "../../components/BillingDatePicker";
import { shiftMonth, formatMonth } from "../../types/month";
import { useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AcademyShell, RoleGate } from "../shared/AcademyShell";
import {
  Button,
  Card,
  Chip,
  Empty,
  Field,
  Label,
  Loading,
  Notice,
  Row,
  Badge,
  IconButton,
} from "../../components/ui";
import { Icon } from "../../components/Icon";
import { Pagination } from "../../components/Pagination";
import { api, academyPath } from "../../services/api";
import { useSession } from "../../services/session";
import {
  Invoice,
  Page,
  Student,
  money,
  statusLabel,
  monthNow,
} from "../../types/billing";
import { colors, accents, Accent } from "../../theme";

const statusTone: Record<Invoice["status"], Accent> = {
  paid: "mint",
  open: "blue",
  overdue: "coral",
  cancelled: "lavender",
};
export function InvoiceList({ student = false }: { student?: boolean }) {
  const { academy } = useSession();
  const a = academy!;
  const [status, setStatus] = useState("");
  const [month, setMonth] = useState("");
  const [sid, setSid] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
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
      <View style={styles.toolbar}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.sectionTitle}>Suas cobranças, organizadas</Text>
          <Label muted>
            {invoices.data
              ? invoices.data.total +
                (invoices.data.total === 1 ? " mensalidade" : " mensalidades")
              : "Acompanhe cada pagamento"}
          </Label>
        </View>
        {!student ? (
          <IconButton
            icon="sliders"
            label="Filtros do financeiro"
            expanded={showFilters}
            selected={showFilters || !!sid}
            onPress={() => setShowFilters((v) => !v)}
          />
        ) : null}
      </View>
      <MonthPicker
        label="Mês das mensalidades"
        value={month}
        allowClear
        onChange={(v) => {
          setMonth(v);
          setPage(1);
        }}
      />
      <Row>
        <Chip
          selected={!month}
          onPress={() => {
            setMonth("");
            setPage(1);
          }}
        >
          Todos
        </Chip>
        <Chip
          selected={month === monthNow()}
          onPress={() => {
            setMonth(monthNow());
            setPage(1);
          }}
        >
          Este mês
        </Chip>
        <Chip
          selected={month === shiftMonth(monthNow(), 1)}
          onPress={() => {
            setMonth(shiftMonth(monthNow(), 1));
            setPage(1);
          }}
        >
          Próximo mês
        </Chip>
      </Row>
      <Row>
        {(["", "open", "paid", "overdue", "cancelled"] as const).map((s) => (
          <Chip
            key={s}
            selected={status === s}
            tone={s ? statusTone[s] : "brand"}
            onPress={() => {
              setStatus(s);
              setPage(1);
            }}
          >
            {s ? statusLabel[s] : "Todas"}
          </Chip>
        ))}
      </Row>
      {showFilters ? (
        <Card>
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
                  <Chip
                    onPress={() => {
                      setSid("");
                      setPage(1);
                    }}
                  >
                    Limpar aluno
                  </Chip>
                ) : null}
              </Row>
            </>
          ) : null}
          <Notice message={students.error?.message} />
        </Card>
      ) : sid ? (
        <View style={styles.activeFilters}>
          <Label muted>Aluno selecionado</Label>
          <Chip
            onPress={() => {
              setMonth("");
              setSid("");
              setSearch("");
              setPage(1);
            }}
          >
            Limpar
          </Chip>
        </View>
      ) : null}
      {invoices.isPending ? (
        <Loading />
      ) : invoices.error ? (
        <Notice message={invoices.error.message} />
      ) : invoices.data?.items.length ? (
        invoices.data.items.map((i) => (
          <Card
            key={i.id}
            onPress={() =>
              router.push({ pathname: "/invoice/[id]", params: { id: i.id } })
            }
            accessibilityLabel={
              (student ? "Mensalidade" : i.student_name) +
              ". " +
              money(i.amount_cents) +
              ". " +
              statusLabel[i.status] +
              ". Abrir mensalidade"
            }
            style={styles.invoice}
          >
            <View style={styles.toolbar}>
              <View
                style={[
                  styles.icon,
                  { backgroundColor: accents[statusTone[i.status]].soft },
                ]}
              >
                <Icon
                  name="wallet"
                  size={21}
                  color={accents[statusTone[i.status]].color}
                />
              </View>
              <Badge
                label={statusLabel[i.status]}
                tone={statusTone[i.status]}
              />
            </View>
            <Text
              style={[
                styles.amount,
                i.status === "paid" && { color: colors.success },
              ]}
            >
              {money(i.amount_cents)}
            </Text>
            <Text style={styles.student}>
              {student
                ? "Mensalidade de " + formatMonth(i.competence)
                : i.student_name}
            </Text>
            <Label muted>
              {!student ? formatMonth(i.competence) + " • " : ""}Vence em{" "}
              {i.due_date.split("-").reverse().join("/")}
            </Label>
            <View style={styles.footer}>
              <Text style={styles.link}>
                {i.status === "paid" ? "Ver pagamento" : "Abrir mensalidade"}
              </Text>
              <Icon name="chevron-right" size={18} color={colors.primary} />
            </View>
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
const styles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    lineHeight: 21,
  },
  activeFilters: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  invoice: { borderRadius: 20, gap: 9 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 3,
  },
  amount: {
    color: colors.text,
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    letterSpacing: -0.7,
  },
  student: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Inter_600SemiBold",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderTopColor: colors.borderSubtle,
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 14,
  },
  link: {
    color: colors.primary,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
});
