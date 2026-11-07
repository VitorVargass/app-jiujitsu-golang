import { QueryError } from "../../components/QueryError";
import { useStudentScope, StudentSelector } from "../student/useStudentScope";
import { InvoicesTable } from "./InvoicesTable";
import { BillingForecast } from "./BillingForecast";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { formatMonth } from "../../types/month";
import { FinanceFilters, defaultFinanceFilters } from "./FinanceFilters";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AcademyShell, RoleGate } from "../shared/AcademyShell";
import {
  Button,
  Card,
  Empty,
  Label,
  Loading,
  Badge,
} from "../../components/ui";
import { Icon } from "../../components/Icon";
import { Pagination } from "../../components/Pagination";
import { api, academyPath } from "../../services/api";
import { queryClient, useSession } from "../../services/session";
import { Invoice, Page, money, statusLabel } from "../../types/billing";
import { useTheme, useThemedStyles } from "../../theme/ThemeProvider";
import { Accent, createThemedStyles } from "../../theme";

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
  const { colors } = useTheme();
  const styles = useThemedStyles(themedStyles);
  const { isWide } = useResponsiveLayout();
  const { academy } = useSession();
  const a = academy!;
  const [filters, setFilters] = useState(() => ({
    ...defaultFinanceFilters(a.timezone),
    ...(student ? { month: "" } : {}),
  }));
  const { month, status } = filters;
  const scope = useStudentScope(student);
  const sid = student ? scope.id : (filters.student?.id ?? "");
  const currentMonth = defaultFinanceFilters(a.timezone).month;
  const filterCount =
    Number(month !== (student ? "" : currentMonth)) +
    Number(!!status) +
    Number(!student && !!sid);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const invoices = useQuery({
    enabled: !student || !!scope.id,
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
  if (student && !scope.id)
    return (
      <AcademyShell title="Mensalidades">
        <StudentSelector scope={scope} />
      </AcademyShell>
    );
  return (
    <AcademyShell title={student ? "Minhas mensalidades" : "Financeiro"}>
      {student ? (
        <StudentSelector scope={scope} onChange={() => setPage(1)} />
      ) : null}
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
          onPress={() => {
            void invoices.refetch();
            if (student && sid) {
              void queryClient.invalidateQueries({
                queryKey: ["billing-forecast", a.id, sid],
              });
            }
          }}
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
        <QueryError query={invoices} />
      ) : invoices.data?.items.length ? (
        isWide ? (
          <InvoicesTable
            items={invoices.data.items}
            student={student}
            currentMonth={currentMonth}
          />
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
              style={[
                styles.invoice,
                student &&
                  i.competence === currentMonth &&
                  styles.currentInvoice,
              ]}
            >
              <View style={styles.invoiceHeader}>
                <View style={styles.invoiceTitle}>
                  <Text style={styles.invoiceMonth}>
                    {student
                      ? formatMonth(i.competence) +
                        (i.competence === currentMonth ? " · Mês atual" : "")
                      : i.student_name}
                  </Text>
                  {!student ? (
                    <Text style={styles.caption}>
                      {formatMonth(i.competence)}
                    </Text>
                  ) : null}
                </View>
                <Badge
                  label={statusLabel[i.status]}
                  tone={statusTone[i.status]}
                />
              </View>
              <View style={styles.invoiceFooter}>
                <Text
                  style={[
                    styles.compactAmount,
                    i.status === "paid" && { color: colors.success },
                  ]}
                >
                  {money(i.amount_cents)}
                </Text>
                <View style={styles.due}>
                  <Text style={styles.caption}>
                    Vence em {i.due_date.split("-").reverse().join("/")}
                  </Text>
                  <Icon name="chevron-right" size={16} color={colors.muted} />
                </View>
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
      {student && scope.id ? (
        <BillingForecast
          key={scope.id}
          academyId={a.id}
          studentId={scope.id}
          personal
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
const themedStyles = createThemedStyles(({ colors }) => ({
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
  invoice: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    gap: 6,
  },
  currentInvoice: { borderColor: colors.primaryLight },
  invoiceHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  invoiceTitle: { flex: 1, minWidth: 0, gap: 2 },
  invoiceFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  invoiceMonth: {
    color: colors.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  compactAmount: {
    color: colors.text,
    fontFamily: "Inter_700Bold",
    fontSize: 19,
  },
  due: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    flexShrink: 1,
  },
  link: {
    color: colors.primary,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
}));
