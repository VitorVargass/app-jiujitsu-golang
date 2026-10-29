import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  Chip,
  Heading,
  Label,
  Loading,
  Notice,
  Row,
} from "../../components/ui";
import { Pagination } from "../../components/Pagination";
import { api, academyPath } from "../../services/api";
import {
  Invoice,
  Page,
  Student,
  money,
  statusLabel,
} from "../../types/billing";
import { dueDateLabel, formatMonth, shiftMonth } from "../../types/month";
import { colors } from "../../theme";

export function StudentInvoices({
  academyId,
  student,
}: {
  academyId: string;
  student: Student;
}) {
  const [filter, setFilter] = useState<"" | "paid" | "open" | "overdue">("");
  const [page, setPage] = useState(1);
  const invoices = useQuery({
    queryKey: ["student-invoices", academyId, student.id, filter, page],
    queryFn: () =>
      api<Page<Invoice>>(
        academyPath(
          academyId,
          "/invoices?student_id=" +
            student.id +
            "&status=" +
            filter +
            "&page=" +
            page +
            "&page_size=12",
        ),
      ),
  });
  const b = student.billing;
  return (
    <View style={{ gap: 16 }}>
      <Card>
        <Heading>Mensalidades do aluno</Heading>
        <Label muted>
          Todos os meses, incluindo pagamentos anteriores e cobranças já
          emitidas para o futuro.
        </Label>
        <Row>
          {(
            [
              { value: "", label: "Todas" },
              { value: "paid", label: "Pagas" },
              { value: "open", label: "A vencer" },
              { value: "overdue", label: "Vencidas" },
            ] as const
          ).map((item) => (
            <Chip
              key={item.value}
              selected={filter === item.value}
              onPress={() => {
                setFilter(item.value);
                setPage(1);
              }}
            >
              {item.label}
            </Chip>
          ))}
        </Row>
        {invoices.isPending ? (
          <Loading />
        ) : invoices.error ? (
          <>
            <Notice message={invoices.error.message} />
            <Button secondary compact onPress={() => void invoices.refetch()}>
              Tentar novamente
            </Button>
          </>
        ) : (
          <>
            <Label muted>
              {invoices.data.total} mensalidade(s) encontrada(s)
            </Label>
            {invoices.data.items.length ? (
              invoices.data.items.map((i) => (
                <Pressable
                  key={i.id}
                  accessibilityRole="button"
                  accessibilityLabel={
                    "Abrir mensalidade de " + formatMonth(i.competence)
                  }
                  onPress={() =>
                    router.push({
                      pathname: "/invoice/[id]",
                      params: { id: i.id },
                    })
                  }
                  style={({ pressed }) => ({
                    gap: 8,
                    paddingVertical: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Row>
                    <View style={{ flex: 1 }}>
                      <Label>{formatMonth(i.competence)}</Label>
                    </View>
                    <Badge
                      label={statusLabel[i.status]}
                      tone={
                        i.status === "paid"
                          ? "mint"
                          : i.status === "overdue"
                            ? "coral"
                            : "blue"
                      }
                    />
                  </Row>
                  <Row>
                    <View style={{ flex: 1 }}>
                      <Label muted>
                        Vencimento: {i.due_date.split("-").reverse().join("/")}
                      </Label>
                    </View>
                    <Label>{money(i.amount_cents)}</Label>
                  </Row>
                  {i.paid_at ? (
                    <Label muted>
                      Pago em {new Date(i.paid_at).toLocaleDateString("pt-BR")}
                    </Label>
                  ) : null}
                </Pressable>
              ))
            ) : (
              <Label muted>Nenhuma mensalidade neste filtro.</Label>
            )}
            <Pagination
              page={page}
              total={invoices.data.total}
              size={12}
              onChange={setPage}
            />
          </>
        )}
      </Card>
      {b?.enabled && student.status === "active" && !student.archived_at ? (
        <Card>
          <Heading>Próximos meses previstos</Heading>
          <Label muted>
            Previsão dos próximos seis meses pelo contrato atual. Estes valores
            ainda não são cobranças emitidas e podem mudar.
          </Label>
          {Array.from({ length: 6 }, (_, index) =>
            shiftMonth(b.first_month, index),
          ).map((month) => (
            <View
              key={month}
              style={{
                gap: 6,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Row>
                <View style={{ flex: 1 }}>
                  <Label>{formatMonth(month)}</Label>
                </View>
                <Label>{money(b.amount_cents)}</Label>
              </Row>
              <Label muted>
                Previsto para {dueDateLabel(month, b.due_day)}
              </Label>
            </View>
          ))}
        </Card>
      ) : (
        <Card>
          <Label muted>
            A cobrança automática está desativada. As mensalidades já emitidas
            continuam no histórico acima.
          </Label>
        </Card>
      )}
    </View>
  );
}
