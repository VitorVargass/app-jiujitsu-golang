import { InvoicesTable } from "./InvoicesTable";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { formatMonth } from "../../types/month";
import { FinanceFilters, defaultFinanceFilters } from "./FinanceFilters";
import { useState } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AcademyShell, RoleGate } from "../shared/AcademyShell";
import {
  Button,
  Card,
  Empty,
  Label,
  Loading,
  Notice,
  Badge,
} from "../../components/ui";
import { Icon } from "../../components/Icon";
import { Pagination } from "../../components/Pagination";
import { api, academyPath } from "../../services/api";
import { useSession } from "../../services/session";
import { Invoice, Page, money, statusLabel } from "../../types/billing";
import { colors, accents, Accent } from "../../theme";

const statusTone: Record<Invoice["status"], Accent> = {
  paid: "mint",
  open: "blue",
  overdue: "coral",
  cancelled: "lavender",
};
export function InvoiceList({ student = false }: { student?: boolean }) {
  const { academy } = useSession();
  return <InvoiceResults key={academy!.id + student} student={student} />;
}
function InvoiceResults({ student }: { student: boolean }) {
  const { isWide } = useResponsiveLayout();
  const { academy } = useSession();
  const a = academy!;
  const [filters, setFilters] = useState(() =>
    defaultFinanceFilters(a.timezone),
  );
  const { month, status } = filters;
  const sid = filters.student?.id ?? "";
  const currentMonth = defaultFinanceFilters(a.timezone).month;
  const filterCount =
    Number(month !== currentMonth) + Number(!!status) + Number(!!sid);
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
  return (
    <AcademyShell title={student ? "Minhas mensalidades" : "Financeiro"}>
      <Card style={styles.filterCard}>
        <View style={[styles.toolbar, { flexWrap: "wrap" }]}>
          <View style={styles.period}>
            <Icon name="calendar" size={22} color={colors.primaryLight} />
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Text style={styles.sectionTitle}>
                {month === currentMonth ? "Este mês" : formatMonth(month)}
              </Text>
              <Text style={styles.caption}>
                {month === currentMonth
                  ? formatMonth(month)
                  : "Mês das mensalidades"}
              </Text>
            </View>
          </View>
          <Button
            secondary
            compact
            icon="sliders"
            onPress={() => setShowFilters(true)}
          >
            {filterCount ? "Filtros (" + filterCount + ")" : "Filtros"}
          </Button>
        </View>
        <Text style={styles.caption}>
          {status ? statusLabel[status] : "Todas as situações"}
          {!student ? " · " + (filters.student?.name ?? "Todos os alunos") : ""}
        </Text>
      </Card>
      <View style={styles.toolbar}>
        <Label muted>
          {invoices.data
            ? invoices.data.total +
              (invoices.data.total === 1 ? " mensalidade" : " mensalidades")
            : "Carregando mensalidades"}
        </Label>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Atualizar mensalidades"
          accessibilityState={{
            disabled: invoices.isFetching,
            busy: invoices.isFetching,
          }}
          disabled={invoices.isFetching}
          onPress={() => void invoices.refetch()}
          style={styles.refresh}
        >
          <Text
            style={[
              styles.link,
              invoices.isFetching && { color: colors.muted },
            ]}
          >
            {invoices.isFetching ? "Atualizando…" : "Atualizar"}
          </Text>
        </Pressable>
      </View>
      {showFilters ? (
        <FinanceFilters
          academyId={a.id}
          timezone={a.timezone}
          value={filters}
          student={student}
          onClose={() => setShowFilters(false)}
          onApply={(value) => {
            setFilters(value);
            setPage(1);
            setShowFilters(false);
          }}
        />
      ) : null}
      {invoices.isPending ? (
        <Loading />
      ) : invoices.error ? (
        <Notice message={invoices.error.message} />
      ) : invoices.data?.items.length ? (
        isWide ? (
          <InvoicesTable items={invoices.data.items} student={student} />
        ) : (
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
        )
      ) : (
        <Empty>
          Nenhuma mensalidade encontrada para{" "}
          {month ? formatMonth(month).toLowerCase() : "o período selecionado"}.
          {filterCount
            ? " Abra os filtros para ajustar a consulta."
            : " Você pode consultar outros meses em Filtros."}
        </Empty>
      )}
      {invoices.data ? (
        <Pagination
          page={page}
          total={invoices.data.total}
          onChange={setPage}
        />
      ) : null}
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
  filterCard: { padding: 16, gap: 12 },
  period: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 160,
  },
  caption: {
    color: colors.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 19,
  },
  refresh: { minHeight: 44, paddingHorizontal: 10, justifyContent: "center" },
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
