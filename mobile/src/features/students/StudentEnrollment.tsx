import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "../../components/Icon";
import { Badge, Button, Card, Heading, Label } from "../../components/ui";
import { Catalog, Student, money } from "../../types/billing";
import { ageOn } from "../../types/age";
import { colors, accents } from "../../theme";
import { StudentSection } from "./StudentSectionEditor";

export function StudentEnrollment({
  student,
  modalities,
  plans,
  timezone,
  onEdit,
  onContract,
}: {
  student: Student;
  modalities: Catalog[];
  plans: Catalog[];
  timezone: string;
  onEdit: (section: StudentSection) => void;
  onContract: () => void;
}) {
  const archived = !!student.archived_at,
    b = student.billing;
  const age = ageOn(student.birth_date, timezone),
    minor = age !== null && age < 18;
  const plan = plans.find((p) => p.id === student.plan_id);
  const mode = student.charge_mode;
  return (
    <>
      <Card>
        <View style={s.heading}>
          <View style={s.title}>
            <Icon name="wallet" size={20} color={accents.brand.color} />
            <Heading>Matrícula e mensalidade</Heading>
          </View>
        </View>
        <Label muted>
          {mode === "plan"
            ? "Um plano reúne as modalidades abaixo em um único valor."
            : mode === "modalities"
              ? "Os valores contratados de cada modalidade formam uma única mensalidade."
              : "As modalidades abaixo estão incluídas no valor combinado."}
        </Label>
        <View style={s.package}>
          <Text style={s.caption}>
            {mode === "plan"
              ? "PLANO CONTRATADO"
              : mode === "modalities"
                ? "COBRANÇA POR MODALIDADES"
                : "VALOR COMBINADO"}
          </Text>
          {mode === "plan" ? (
            <Text style={s.value}>{plan?.name ?? "Plano"}</Text>
          ) : null}
          {student.modality_details.map((d) => (
            <View key={d.modality_id} style={s.line}>
              <Text style={[s.value, { flex: 1 }]}>
                {modalities.find((m) => m.id === d.modality_id)?.name ??
                  "Modalidade"}
              </Text>
              <Text style={mode === "modalities" ? s.value : s.caption}>
                {mode === "modalities" ? money(d.amount_cents) : "Incluída"}
              </Text>
            </View>
          ))}
          {!student.modality_details.length ? (
            <Label muted>Nenhuma modalidade vinculada.</Label>
          ) : null}
          <View style={s.total}>
            <Text style={s.caption}>Total mensal</Text>
            <Text style={s.amount}>
              {b ? money(b.amount_cents) : "A definir"}
              {b ? <Text style={s.suffix}> /mês</Text> : null}
            </Text>
          </View>
        </View>
        <View style={s.line}>
          <Badge
            label={
              b?.enabled ? "Emissão mensal ativa" : "Emissão mensal desativada"
            }
            tone={b?.enabled ? "mint" : "amber"}
          />
        </View>
        <View style={s.terms}>
          <View style={s.term}>
            <Text style={s.caption}>Vencimento</Text>
            <Text style={s.value}>{b ? "Dia " + b.due_day : "A definir"}</Text>
          </View>
          <View style={s.term}>
            <Text style={s.caption}>
              {b?.enabled ? "Próxima mensalidade" : "Mês de início da cobrança"}
            </Text>
            <Text style={s.value}>
              {b?.first_month?.split("-").reverse().join("/") ?? "A definir"}
            </Text>
          </View>
        </View>
        <View style={s.payer}>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={s.caption}>
              {minor
                ? "Responsável financeiro"
                : age === null
                  ? "Data de nascimento pendente"
                  : "Pagamento pelo próprio aluno"}
            </Text>
            <Text style={s.value}>
              {minor
                ? b?.payer_name || "A definir"
                : age === null
                  ? "Informe a data nos dados pessoais"
                  : student.name}
            </Text>
          </View>
          {!archived && minor ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Editar responsável financeiro"
              onPress={() => onEdit("payer")}
              style={s.edit}
            >
              <Icon name="edit" size={16} color={accents.blue.color} />
            </Pressable>
          ) : null}
        </View>
        {!archived ? (
          <View style={s.actions}>
            <Button compact secondary icon="edit" onPress={onContract}>
              Alterar contratação
            </Button>
            <Button
              compact
              secondary
              icon="wallet"
              onPress={() => onEdit("billing")}
            >
              Valor e vencimento
            </Button>
          </View>
        ) : null}
        <Label muted>
          Alterações valem para novas emissões. Mensalidades emitidas permanecem
          no Financeiro.
        </Label>
      </Card>
    </>
  );
}
const s = StyleSheet.create({
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  title: { flexDirection: "row", gap: 10, alignItems: "center", flexShrink: 1 },
  package: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  line: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  caption: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: colors.muted,
    lineHeight: 19,
  },
  value: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  total: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
    gap: 6,
  },
  amount: {
    fontFamily: "Inter_700Bold",
    fontSize: 27,
    color: colors.text,
  },
  suffix: { fontFamily: "Inter_400Regular", fontSize: 14, color: colors.muted },
  terms: { flexDirection: "row", gap: 20, flexWrap: "wrap" },
  term: { flex: 1, minWidth: 120, gap: 5 },
  payer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  edit: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: accents.blue.soft,
  },
  rank: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
