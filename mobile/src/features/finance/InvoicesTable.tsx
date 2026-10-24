import { Link, router } from "expo-router";
import { View } from "react-native";
import { DataTable } from "../../components/DataTable";
import { Badge, Label } from "../../components/ui";
import { Invoice, money, statusLabel } from "../../types/billing";
import { formatMonth } from "../../types/month";
import { colors } from "../../theme";
export function InvoicesTable({
  items,
  student,
}: {
  items: Invoice[];
  student: boolean;
}) {
  return (
    <DataTable
      label="Mensalidades"
      items={items}
      itemKey={(i) => i.id}
      onRowPress={(item) =>
        router.push({ pathname: "/invoice/[id]", params: { id: item.id } })
      }
      columns={[
        {
          key: "student",
          label: student ? "Mensalidade" : "Aluno",
          flex: 1.7,
          render: (i) => (
            <Link
              href={{ pathname: "/invoice/[id]", params: { id: i.id } }}
              style={{
                color: colors.text,
                fontFamily: "Inter_600SemiBold",
                fontSize: 14,
                paddingVertical: 8,
              }}
            >
              {student ? formatMonth(i.competence) : i.student_name}
            </Link>
          ),
        },
        {
          key: "month",
          label: "Mês da mensalidade",
          flex: 1.2,
          render: (i) => <Label muted>{formatMonth(i.competence)}</Label>,
        },
        {
          key: "due",
          label: "Vencimento",
          render: (i) => (
            <Label muted>{i.due_date.split("-").reverse().join("/")}</Label>
          ),
        },
        {
          key: "amount",
          label: "Valor",
          render: (i) => <Label>{money(i.amount_cents)}</Label>,
        },
        {
          key: "status",
          label: "Situação",
          render: (i) => (
            <View style={{ alignItems: "flex-start" }}>
              <Badge
                label={statusLabel[i.status]}
                tone={
                  i.status === "paid"
                    ? "mint"
                    : i.status === "overdue"
                      ? "coral"
                      : i.status === "cancelled"
                        ? "slate"
                        : "blue"
                }
              />
            </View>
          ),
        },
      ]}
    />
  );
}
