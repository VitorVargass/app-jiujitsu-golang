import { Link, router } from "expo-router";
import { Text, View } from "react-native";
import { DataTable } from "../../components/DataTable";
import { Badge, Label } from "../../components/ui";
import { Catalog, Student, money } from "../../types/billing";
import { rankLabel } from "../../types/graduation";
import { colors } from "../../theme";
export function StudentsTable({
  items,
  modalities,
}: {
  items: Student[];
  modalities: Catalog[];
}) {
  return (
    <DataTable
      label="Alunos da academia"
      items={items}
      itemKey={(s) => s.id}
      onRowPress={(item) =>
        router.push({ pathname: "/students/[id]", params: { id: item.id } })
      }
      columns={[
        {
          key: "name",
          label: "Aluno / identificação",
          flex: 1.65,
          render: (s) => (
            <View style={{ gap: 4 }}>
              <Link
                href={{ pathname: "/students/[id]", params: { id: s.id } }}
                style={{
                  color: colors.text,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 14,
                  paddingVertical: 6,
                }}
              >
                {s.name}
              </Link>
              <Label muted>Nº {s.student_code}</Label>
            </View>
          ),
        },
        {
          key: "modalities",
          label: "Modalidades e graduação",
          flex: 1.7,
          render: (s) => (
            <Label muted>
              {s.modality_details?.length
                ? s.modality_details
                    .map(
                      (d) =>
                        (modalities.find((m) => m.id === d.modality_id)?.name ??
                          "Modalidade") +
                        (d.belt
                          ? " · " + rankLabel(d.belt, d.degrees ?? 0)
                          : ""),
                    )
                    .join(" / ")
                : s.belt || "Não informado"}
            </Label>
          ),
        },
        {
          key: "status",
          label: "Situação",
          render: (s) => (
            <View style={{ alignItems: "flex-start" }}>
              <Badge
                label={
                  s.archived_at
                    ? "Arquivado"
                    : s.status === "active"
                      ? "Ativo"
                      : "Inativo"
                }
                tone={
                  s.archived_at
                    ? "amber"
                    : s.status === "active"
                      ? "mint"
                      : "slate"
                }
              />
            </View>
          ),
        },
        {
          key: "amount",
          label: "Mensalidade",
          render: (s) => (
            <Text
              style={{
                color: colors.text,
                fontFamily: "Inter_600SemiBold",
                fontSize: 13,
              }}
            >
              {s.billing?.enabled
                ? money(s.billing.amount_cents)
                : "Sem cobrança"}
            </Text>
          ),
        },
      ]}
    />
  );
}
