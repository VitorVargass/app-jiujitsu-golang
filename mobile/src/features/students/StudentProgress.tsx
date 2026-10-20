import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Card,
  Chip,
  Heading,
  IconButton,
  Label,
  Loading,
  Notice,
  Row,
} from "../../components/ui";
import { formatBirth } from "../../types/age";
import { StudentStartDateEditor } from "./StudentStartDateEditor";
import { Icon } from "../../components/Icon";
import { BeltSwatch } from "../../components/BeltPicker";
import { Pagination } from "../../components/Pagination";
import { api, academyPath } from "../../services/api";
import { Catalog, Page, Student } from "../../types/billing";
import { rankLabel } from "../../types/graduation";
import { colors, accents } from "../../theme";

type GraduationEvent = {
  id: string;
  modality_id: string;
  modality_name: string;
  kind: "baseline" | "initial" | "change";
  previous_belt: string | null;
  previous_degrees: number | null;
  belt: string;
  degrees: number;
  occurred_at: string | null;
  recorded_at: string;
  actor_name: string;
};
type Progress = {
  started_on: string;
  tenure_days: number;
  joined_at: string;
  tracking_started_at: string;
  active_since: string | null;
  active_days: number;
  history: Page<GraduationEvent>;
};
export function StudentProgress({
  student,
  modalities,
  academyId,
  timezone,
  onEdit,
}: {
  student: Student;
  modalities: Catalog[];
  academyId: string;
  timezone: string;
  onEdit: (id: string) => void;
}) {
  const [page, setPage] = useState(1),
    [modality, setModality] = useState("");
  const [startEditor, setStartEditor] = useState(false);
  const q = useQuery({
    queryKey: ["student-progress", academyId, student.id, page, modality],
    queryFn: () =>
      api<Progress>(
        academyPath(
          academyId,
          "/students/" +
            student.id +
            "/progress?page=" +
            page +
            "&page_size=10&modality_id=" +
            modality,
        ),
      ),
  });
  const date = (v: string) =>
    new Date(v).toLocaleDateString("pt-BR", { timeZone: timezone });
  return (
    <>
      {startEditor ? (
        <StudentStartDateEditor
          student={student}
          academyId={academyId}
          timezone={timezone}
          onClose={() => setStartEditor(false)}
        />
      ) : null}
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <Notice message={q.error.message} />
      ) : q.data ? (
        <Card>
          <View style={s.progressHeading}>
            <Heading>Tempo na academia</Heading>
            {!student.archived_at ? (
              <IconButton
                icon="edit"
                label="Editar início na academia"
                onPress={() => setStartEditor(true)}
              />
            ) : null}
          </View>
          <View style={s.metrics}>
            <View style={s.metric}>
              <Text style={s.number}>
                {enrollmentDuration(
                  q.data.started_on,
                  q.dataUpdatedAt,
                  timezone,
                  q.data.tenure_days,
                )}
              </Text>
              <Label muted>desde o início na academia</Label>
            </View>
            <View style={s.metric}>
              <Label>Início: {formatBirth(q.data.started_on)}</Label>
              <Label muted>
                Cadastro no aplicativo em {date(q.data.joined_at)}
              </Label>
            </View>
          </View>
          <View style={s.tracking}>
            <Icon name="check-circle" size={18} color={accents.mint.color} />
            <View style={{ flex: 1, gap: 6 }}>
              <Label>{q.data.active_days} dias de atividade acompanhada</Label>
              <Label muted>
                Acompanhamento desde {date(q.data.tracking_started_at)}. A
                contagem usa os períodos registrados e exclui pausas.
              </Label>
              {!q.data.active_since ? (
                <Label muted>Atualmente inativo ou arquivado</Label>
              ) : null}
            </View>
          </View>
        </Card>
      ) : null}
      <Card>
        <Heading>Graduação atual</Heading>
        <Label muted>
          Faixas e graus por modalidade. Cada alteração entra no histórico.
        </Label>
        {student.modality_details.map((d) => {
          const m = modalities.find((v) => v.id === d.modality_id),
            options = m?.belt_options;
          return (
            <View key={d.modality_id} style={s.rank}>
              <View style={{ flex: 1, gap: 8, minWidth: 0 }}>
                <Label>{m?.name ?? "Modalidade"}</Label>
                {d.belt ? (
                  <BeltSwatch
                    degrees={d.degrees}
                    colors={
                      options?.find((v) => v.label === d.belt)?.colors ?? [
                        "#929292",
                      ]
                    }
                  />
                ) : null}
                <Label muted>{rankLabel(d.belt, d.degrees)}</Label>
              </View>
              {!student.archived_at && (d.belt || options?.length) ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    "Editar faixa de " + (m?.name ?? "modalidade")
                  }
                  onPress={() => onEdit(d.modality_id)}
                  style={s.edit}
                >
                  <Icon name="edit" color={colors.primaryLight} size={18} />
                </Pressable>
              ) : null}
            </View>
          );
        })}
        {!student.modality_details.length ? (
          <Label muted>Nenhuma modalidade vinculada.</Label>
        ) : null}
      </Card>
      <Card>
        <Heading>Evolução do aluno</Heading>
        <Row>
          <Chip
            selected={!modality}
            onPress={() => {
              setModality("");
              setPage(1);
            }}
          >
            Todas
          </Chip>
          {modalities
            .filter(
              (m) =>
                m.belt_options?.length || student.modality_ids.includes(m.id),
            )
            .map((m) => (
              <Chip
                key={m.id}
                selected={modality === m.id}
                onPress={() => {
                  setModality(m.id);
                  setPage(1);
                }}
              >
                {m.name}
              </Chip>
            ))}
        </Row>
        {q.data?.history.items.map((h) => (
          <View key={h.id} style={s.event}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <Badge label={h.modality_name} tone="slate" />
              <Label muted>{date(h.occurred_at ?? h.recorded_at)}</Label>
            </View>
            <Label>{rankLabel(h.belt, h.degrees)}</Label>
            {h.kind === "change" ? (
              <Label muted>
                Antes:{" "}
                {rankLabel(h.previous_belt ?? "", h.previous_degrees ?? 0)}
              </Label>
            ) : (
              <Label muted>
                {h.kind === "baseline"
                  ? "Graduação anterior ao histórico; data da conquista não informada."
                  : "Graduação informada no cadastro."}
              </Label>
            )}
            {h.actor_name ? (
              <Label muted>Registrado por {h.actor_name}</Label>
            ) : null}
          </View>
        ))}
        {q.data && !q.data.history.total ? (
          <Label muted>Nenhuma graduação registrada.</Label>
        ) : null}
        {q.data ? (
          <Pagination
            page={page}
            size={q.data.history.page_size}
            total={q.data.history.total}
            onChange={setPage}
          />
        ) : null}
      </Card>
    </>
  );
}
function enrollmentDuration(
  start: string,
  at: number,
  timezone: string,
  days: number,
) {
  if (days === 0) return "Hoje";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(at));
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  let months =
    (get("year") - Number(start.slice(0, 4))) * 12 +
    get("month") -
    Number(start.slice(5, 7));
  if (get("day") < Number(start.slice(8, 10))) months--;
  if (months < 1) return days + (days === 1 ? " dia" : " dias");
  const years = Math.floor(months / 12),
    remaining = months % 12;
  return [
    years ? years + (years === 1 ? " ano" : " anos") : "",
    remaining ? remaining + (remaining === 1 ? " mês" : " meses") : "",
  ]
    .filter(Boolean)
    .join(" e ");
}
const s = StyleSheet.create({
  progressHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  tracking: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 18 },
  metric: { flex: 1, minWidth: 130, gap: 6 },
  number: { color: colors.text, fontSize: 24, fontFamily: "Inter_700Bold" },
  rank: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  edit: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: accents.brand.soft,
    justifyContent: "center",
    alignItems: "center",
  },
  event: {
    gap: 8,
    borderLeftWidth: 2,
    borderLeftColor: accents.brand.border,
    paddingLeft: 14,
    paddingVertical: 8,
  },
});
