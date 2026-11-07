import { Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Card, Heading, Label, Loading, Badge } from "../../components/ui";
import { QueryError } from "../../components/QueryError";
import { api, academyPath } from "../../services/api";
import { money } from "../../types/billing";
import { formatMonth } from "../../types/month";
import { useTheme } from "../../theme/ThemeProvider";
import { useSectionPreview } from "../shared/SectionPagesContext";

type ForecastMonth = {
  competence: string;
  due_date: string;
  amount_cents: number;
};

export function BillingForecast({
  academyId,
  studentId,
  personal = false,
}: {
  academyId: string;
  studentId: string;
  personal?: boolean;
}) {
  const { colors } = useTheme();
  const preview = useSectionPreview();
  const query = useQuery({
    queryKey: ["billing-forecast", academyId, studentId, personal],
    enabled: !preview && !!studentId,
    queryFn: () =>
      api<ForecastMonth[]>(
        academyPath(
          academyId,
          personal
            ? "/me/billing-forecast?student_id=" + studentId
            : "/students/" + studentId + "/billing-forecast",
        ),
      ),
  });
  return (
    <Card style={{ padding: 14, gap: 10 }}>
      <Heading>Próximas mensalidades</Heading>
      <Label muted>
        Previsão dos próximos seis meses, conforme a matrícula atual. Os valores
        podem mudar.
      </Label>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <QueryError query={query} />
      ) : query.data.length ? (
        query.data.map((month, index) => (
          <View
            key={month.competence}
            style={{
              gap: 5,
              paddingVertical: 10,
              borderTopWidth: index ? 1 : 0,
              borderTopColor: colors.borderSubtle,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View style={{ flex: 1 }}>
                <Label>{formatMonth(month.competence)}</Label>
              </View>
              <Badge label="Previsão" tone="slate" />
            </View>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <Label muted>
                Vencimento previsto em{" "}
                {month.due_date.split("-").reverse().join("/")}
              </Label>
              <Text
                style={{
                  color: colors.text,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 15,
                }}
              >
                {money(month.amount_cents)}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <Label muted>Nenhuma mensalidade prevista para este período.</Label>
      )}
    </Card>
  );
}
