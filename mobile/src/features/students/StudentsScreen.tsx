import { useState } from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { colors } from "../../theme";
import { Icon } from "../../components/Icon";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { AcademyShell, RoleGate } from "../shared/AcademyShell";
import {
  Button,
  Card,
  Chip,
  Avatar,
  IconButton,
  SearchBar,
  Field,
  Heading,
  Label,
  Loading,
  Notice,
  Row,
} from "../../components/ui";
import { Pagination } from "../../components/Pagination";
import { api, academyPath } from "../../services/api";
import { queryClient, useSession } from "../../services/session";
import { portalLink } from "../../services/links";
import {
  Catalog,
  Student,
  Page,
  parseMoney,
  monthNow,
  money,
} from "../../types/billing";
function ListContent() {
  const { academy } = useSession();
  const a = academy!;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [modality, setModality] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const modalities = useQuery({
    queryKey: ["modalities", a.id],
    queryFn: () => api<Catalog[]>(academyPath(a.id, "/modalities")),
  });
  const list = useQuery({
    queryKey: ["students", a.id, search, status, modality, page],
    queryFn: () =>
      api<Page<Student>>(
        academyPath(
          a.id,
          "/students?search=" +
            encodeURIComponent(search) +
            "&status=" +
            status +
            "&modality_id=" +
            modality +
            "&page=" +
            page,
        ),
      ),
  });
  const selectedModality = modalities.data?.find((m) => m.id === modality);
  return (
    <AcademyShell
      title="Alunos"
      titleAction={
        <Button
          compact
          icon="plus"
          onPress={() =>
            router.push({ pathname: "/students/[id]", params: { id: "new" } })
          }
        >
          Novo aluno
        </Button>
      }
    >
      <View style={{ gap: 12 }}>
        <SearchBar
          label="Buscar aluno pelo nome"
          placeholder="Buscar por nome..."
          value={search}
          onChangeText={(v) => {
            setSearch(v);
            setPage(1);
          }}
          action={
            <IconButton
              icon="sliders"
              label="Filtros de modalidade"
              expanded={showFilters}
              selected={showFilters || !!modality}
              onPress={() => setShowFilters((v) => !v)}
            />
          }
        />
        <View style={listStyles.statusTabs}>
          {[
            ["", "Todos"],
            ["active", "Ativos"],
            ["inactive", "Inativos"],
          ].map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: status === value }}
              onPress={() => {
                setStatus(value);
                setPage(1);
              }}
              style={[
                listStyles.statusTab,
                status === value && listStyles.statusSelected,
              ]}
            >
              <Text
                style={[
                  listStyles.statusText,
                  status === value && { color: colors.text },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {showFilters ? (
        <Card>
          <Heading>Filtrar por modalidade</Heading>
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
            {modalities.data?.map((m) => (
              <Chip
                key={m.id}
                selected={m.id === modality}
                onPress={() => {
                  setModality(m.id);
                  setPage(1);
                }}
              >
                {m.name}
              </Chip>
            ))}
          </Row>
          <Notice message={modalities.error?.message} />
        </Card>
      ) : null}
      {selectedModality && !showFilters ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={"Remover filtro " + selectedModality.name}
          onPress={() => {
            setModality("");
            setPage(1);
          }}
          style={listStyles.filterSummary}
        >
          <Text style={listStyles.filterText}>{selectedModality.name}</Text>
          <Icon name="close" size={14} color={colors.muted} />
        </Pressable>
      ) : null}
      {list.data ? (
        <Text style={listStyles.count}>
          {list.data.total} {list.data.total === 1 ? "aluno" : "alunos"}
          {search || status || modality
            ? list.data.total === 1
              ? " encontrado"
              : " encontrados"
            : list.data.total === 1
              ? " cadastrado"
              : " cadastrados"}
        </Text>
      ) : null}
      {list.isPending ? (
        <Loading />
      ) : list.error ? (
        <Notice message={list.error.message} />
      ) : list.data?.items.length ? (
        <View style={listStyles.list}>
          {list.data.items.map((s, index) => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={"Abrir cadastro de " + s.name}
              onPress={() =>
                router.push({
                  pathname: "/students/[id]",
                  params: { id: s.id },
                })
              }
              style={({ pressed }) => [
                listStyles.studentRow,
                index > 0 && listStyles.rowDivider,
                pressed && { backgroundColor: colors.surfaceRaised },
              ]}
            >
              <Avatar name={s.name} />
              <View style={listStyles.studentInfo}>
                <Text numberOfLines={1} style={listStyles.studentName}>
                  {s.name}
                </Text>
                <Text numberOfLines={1} style={listStyles.studentMeta}>
                  {s.belt}
                </Text>
                <View style={listStyles.situation}>
                  <View
                    style={[
                      listStyles.statusDot,
                      s.status === "inactive" && {
                        backgroundColor: colors.muted,
                      },
                    ]}
                  />
                  <Text style={listStyles.studentMeta}>
                    {s.status === "active" ? "Ativo" : "Inativo"}
                  </Text>
                </View>
              </View>
              <View style={listStyles.amount}>
                <Text style={listStyles.amountText}>
                  {s.billing?.enabled
                    ? money(s.billing.amount_cents)
                    : "Sem cobrança"}
                </Text>
                {s.billing?.enabled ? (
                  <Text style={listStyles.studentMeta}>por mês</Text>
                ) : null}
              </View>
              <Icon name="chevron-right" size={16} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={listStyles.empty}>
          <Icon name="users" size={32} color={colors.muted} />
          <Heading>Nenhum aluno encontrado</Heading>
          <Label muted>
            {search || status || modality
              ? "Ajuste a busca ou os filtros."
              : "Comece pelo botão Novo aluno."}
          </Label>
        </View>
      )}
      {list.data ? (
        <Pagination page={page} total={list.data.total} onChange={setPage} />
      ) : null}
    </AcademyShell>
  );
}
const listStyles = StyleSheet.create({
  statusTabs: {
    flexDirection: "row",
    gap: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#262626",
  },
  statusTab: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 2,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  statusSelected: { borderBottomColor: colors.text },
  statusText: { fontFamily: "Lato_700Bold", fontSize: 14, color: colors.muted },
  count: { fontFamily: "Lato_400Regular", fontSize: 12, color: colors.muted },
  list: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#292929",
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  studentRow: {
    minHeight: 100,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: "#292929" },
  studentInfo: { flex: 1, minWidth: 0, gap: 4 },
  studentName: { color: colors.text, fontFamily: "Lato_700Bold", fontSize: 15 },
  studentMeta: {
    color: colors.muted,
    fontFamily: "Lato_400Regular",
    fontSize: 11,
    lineHeight: 15,
  },
  situation: { flexDirection: "row", alignItems: "center", gap: 5 },
  statusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.success,
  },
  amount: { alignItems: "flex-end", gap: 3, maxWidth: 90 },
  amountText: { fontFamily: "Lato_700Bold", color: colors.text, fontSize: 12 },
  filterSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  filterText: {
    fontFamily: "Lato_400Regular",
    color: colors.muted,
    fontSize: 12,
  },
  empty: { alignItems: "center", gap: 12, paddingVertical: 40 },
});

export default function StudentsScreen() {
  return (
    <RoleGate role="admin">
      <ListContent />
    </RoleGate>
  );
}
function Form({
  initial,
  modalities,
  plans,
}: {
  initial?: Student;
  modalities: Catalog[];
  plans: Catalog[];
}) {
  const { academy } = useSession();
  const a = academy!;
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [belt, setBelt] = useState(initial?.belt ?? "Faixa Branca");
  const [status, setStatus] = useState(initial?.status ?? "active");
  const [plan, setPlan] = useState(initial?.plan_id ?? "");
  const [mods, setMods] = useState(initial?.modality_ids ?? []);
  const [enabled, setEnabled] = useState(initial?.billing?.enabled ?? false);
  const [amount, setAmount] = useState(
    initial?.billing ? (initial.billing.amount_cents / 100).toFixed(2) : "",
  );
  const [day, setDay] = useState(String(initial?.billing?.due_day ?? 10));
  const [month, setMonth] = useState(
    initial?.billing?.first_month ?? monthNow(),
  );
  const [payer, setPayer] = useState(
    initial?.billing?.payer_name ?? initial?.name ?? "",
  );
  const [document, setDocument] = useState(
    initial?.billing?.payer_document ?? "",
  );
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const save = useMutation({
    mutationFn: () => {
      const billing =
        enabled || initial?.billing
          ? {
              enabled,
              amount_cents: parseMoney(amount),
              due_day: Number(day),
              first_month: month,
              payer_name: payer || name,
              payer_document: document.replace(/\D/g, ""),
            }
          : null;
      return api<Student>(
        academyPath(a.id, "/students" + (initial ? "/" + initial.id : "")),
        {
          method: initial ? "PATCH" : "POST",
          body: {
            name,
            email,
            phone,
            belt,
            status,
            plan_id: plan,
            modality_ids: mods,
            billing,
          },
        },
      );
    },
    onSuccess: (s) => {
      void queryClient.invalidateQueries();
      setMessage("Cadastro salvo.");
      if (!initial)
        router.replace({ pathname: "/students/[id]", params: { id: s.id } });
    },
  });
  const invite = useMutation({
    mutationFn: () =>
      api<{ token: string }>(
        academyPath(a.id, "/students/" + initial!.id + "/invitations"),
        { method: "POST" },
      ),
    onSuccess: async (result) => {
      const url = portalLink("/invite/" + result.token);
      setLink(url);
      if (!(await Clipboard.setStringAsync(url)))
        throw new Error(
          "Não foi possível copiar. Selecione e copie o link abaixo.",
        );
      setMessage("Convite copiado. Válido por 7 dias.");
    },
  });
  const revoke = useMutation({
    mutationFn: () =>
      api(academyPath(a.id, "/students/" + initial!.id + "/invitations"), {
        method: "DELETE",
      }),
    onSuccess: () => {
      setLink("");
      setMessage("Convites pendentes revogados.");
    },
  });
  function choose(p: Catalog) {
    setPlan(p.id);
    setMods(p.modality_ids ?? []);
    setAmount(((p.amount_cents ?? 0) / 100).toFixed(2));
  }
  return (
    <AcademyShell title={initial ? "Cadastro do aluno" : "Novo aluno"}>
      <Card>
        <Field
          label="Nome completo"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
        <Field
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />
        <Field
          label="Celular"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <Field label="Faixa" value={belt} onChangeText={setBelt} />
        <Row>
          <Chip
            selected={status === "active"}
            onPress={() => setStatus("active")}
          >
            Ativo
          </Chip>
          <Chip
            selected={status === "inactive"}
            onPress={() => {
              setStatus("inactive");
              setEnabled(false);
            }}
          >
            Inativo
          </Chip>
        </Row>
        <Label muted>
          Inativar interrompe novas mensalidades e presenças. O histórico
          permanece acessível.
        </Label>
      </Card>
      <Card>
        <Heading>Plano opcional</Heading>
        <Row>
          <Chip selected={!plan} onPress={() => setPlan("")}>
            Sem plano
          </Chip>
          {plans
            .filter((p) => p.active || p.id === plan)
            .map((p) => (
              <Chip
                key={p.id}
                selected={plan === p.id}
                onPress={() => choose(p)}
              >
                {p.name} • {money(p.amount_cents ?? 0)}
              </Chip>
            ))}
        </Row>
        <Heading>Modalidades</Heading>
        <Row>
          {modalities
            .filter((m) => m.active || mods.includes(m.id))
            .map((m) => (
              <Chip
                key={m.id}
                selected={mods.includes(m.id)}
                onPress={() =>
                  setMods(
                    mods.includes(m.id)
                      ? mods.filter((id) => id !== m.id)
                      : [...mods, m.id],
                  )
                }
              >
                {m.name}
              </Chip>
            ))}
        </Row>
      </Card>
      <Card>
        <Heading>Mensalidade total</Heading>
        <Row>
          <Chip
            selected={enabled}
            onPress={() => {
              if (status === "active") {
                setEnabled(!enabled);
                if (!enabled && !initial?.billing?.enabled)
                  setMonth(monthNow());
              }
            }}
          >
            {enabled ? "✓ Cobrança mensal ativa" : "Ativar cobrança mensal"}
          </Chip>
        </Row>
        <Field
          label="Valor total (R$)"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="200,00"
        />
        <Field
          label="Dia do vencimento (1 a 31)"
          value={day}
          onChangeText={setDay}
          keyboardType="number-pad"
        />
        <Field
          label={
            initial?.billing?.enabled
              ? "Próxima competência (YYYY-MM)"
              : "Primeira competência (YYYY-MM)"
          }
          value={month}
          onChangeText={setMonth}
          editable={!initial?.billing?.enabled}
        />
        <Field
          label="Nome do pagador ou responsável"
          value={payer}
          onChangeText={setPayer}
          placeholder={name}
        />
        <Field
          label="CPF ou CNPJ do pagador"
          value={document}
          onChangeText={setDocument}
          keyboardType="number-pad"
        />
        <Label muted>
          Alterações de valor e vencimento valem para mensalidades futuras. As
          já emitidas conservam seus dados.
        </Label>
      </Card>
      <Notice
        message={
          save.error?.message || invite.error?.message || revoke.error?.message
        }
      />
      <Notice success message={message} />
      <Button
        loading={save.isPending}
        onPress={() => {
          setMessage("");
          save.mutate();
        }}
      >
        Salvar cadastro
      </Button>
      {initial ? (
        <Card>
          <Heading>Acesso do aluno</Heading>
          <Label>Código: {initial.student_code}</Label>
          {initial.user_id ? (
            <Label muted>Conta já vinculada.</Label>
          ) : (
            <>
              <Label muted>
                O aluno abre o convite, entra na conta e aceita o vínculo.
              </Label>
              <Button
                loading={invite.isPending}
                onPress={() => invite.mutate()}
              >
                Gerar e copiar convite
              </Button>
              {link ? (
                <Field
                  label="Link do convite"
                  value={link}
                  editable={false}
                  selectTextOnFocus
                />
              ) : null}
              <Button
                secondary
                loading={revoke.isPending}
                onPress={() => revoke.mutate()}
              >
                Revogar convites pendentes
              </Button>
            </>
          )}
        </Card>
      ) : null}
    </AcademyShell>
  );
}
function DetailContent({ id }: { id: string }) {
  const { academy } = useSession();
  const a = academy!;
  const student = useQuery({
    queryKey: ["student", a.id, id],
    queryFn: () => api<Student>(academyPath(a.id, "/students/" + id)),
    enabled: id !== "new",
  });
  const mods = useQuery({
    queryKey: ["modalities", a.id],
    queryFn: () => api<Catalog[]>(academyPath(a.id, "/modalities")),
  });
  const plans = useQuery({
    queryKey: ["plans", a.id],
    queryFn: () => api<Catalog[]>(academyPath(a.id, "/plans")),
  });
  if (mods.isPending || plans.isPending || (id !== "new" && student.isPending))
    return (
      <AcademyShell title="Cadastro">
        <Loading />
      </AcademyShell>
    );
  const error = mods.error || plans.error || student.error;
  if (error)
    return (
      <AcademyShell title="Cadastro">
        <Notice message={error.message} />
      </AcademyShell>
    );
  return (
    <Form
      key={id}
      initial={student.data}
      modalities={mods.data ?? []}
      plans={plans.data ?? []}
    />
  );
}
export function StudentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <RoleGate role="admin">
      <DetailContent id={id} />
    </RoleGate>
  );
}
