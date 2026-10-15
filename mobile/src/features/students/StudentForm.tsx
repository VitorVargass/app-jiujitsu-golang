import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { AcademyShell } from "../shared/AcademyShell";
import {
  Button,
  Card,
  Chip,
  Field,
  Heading,
  Label,
  Notice,
  Row,
} from "../../components/ui";
import { FormWizard } from "../../components/FormWizard";
import { BeltPicker, BeltSwatch } from "../../components/BeltPicker";
import { api, academyPath } from "../../services/api";
import { queryClient, useSession } from "../../services/session";
import { portalLink } from "../../services/links";
import {
  Catalog,
  ChargeMode,
  Student,
  monthNow,
  money,
  parseMoney,
} from "../../types/billing";

const steps = [
  "Identificação",
  "Modalidades",
  "Mensalidade",
  "Pagador",
  "Revisão",
];
type EnrollmentDraft = { belt: string; amount: string };
function validDocument(value: string) {
  const n = value.replace(/\D/g, "");
  if (![11, 14].includes(n.length) || /^(\d)\1+$/.test(n)) return false;
  const digits = n.split("").map(Number);
  const check = (length: number, weights: number[]) => {
    const sum = digits
      .slice(0, length)
      .reduce((s, d, i) => s + d * weights[i], 0);
    const result = 11 - (sum % 11);
    return result > 9 ? 0 : result;
  };
  if (n.length === 11)
    return (
      check(9, [10, 9, 8, 7, 6, 5, 4, 3, 2]) === digits[9] &&
      check(10, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) === digits[10]
    );
  return (
    check(12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === digits[12] &&
    check(13, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === digits[13]
  );
}

export default function StudentForm({
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
  const [editing, setEditing] = useState(!initial);
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [alternate, setAlternate] = useState(initial?.alternate_phone ?? "");
  const [status, setStatus] = useState(initial?.status ?? "active");
  const [mode, setMode] = useState<ChargeMode>(
    initial?.charge_mode ?? (initial ? "custom" : "modalities"),
  );
  const [plan, setPlan] = useState(initial?.plan_id ?? "");
  const [mods, setMods] = useState<string[]>(initial?.modality_ids ?? []);
  const [drafts, setDrafts] = useState<Record<string, EnrollmentDraft>>(() =>
    Object.fromEntries(
      (initial?.modality_details ?? []).map((d) => [
        d.modality_id,
        { belt: d.belt, amount: (d.amount_cents / 100).toFixed(2) },
      ]),
    ),
  );
  const [enabled, setEnabled] = useState(initial?.billing?.enabled ?? false);
  const [amount, setAmount] = useState(
    initial?.billing ? (initial.billing.amount_cents / 100).toFixed(2) : "0",
  );
  const [day, setDay] = useState(String(initial?.billing?.due_day ?? 10));
  const [month, setMonth] = useState(
    initial?.billing?.first_month ?? monthNow(),
  );
  const [payer, setPayer] = useState(initial?.billing?.payer_name ?? "");
  const [document, setDocument] = useState(
    initial?.billing?.payer_document ?? "",
  );
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const selected = mods
    .map((id) => modalities.find((m) => m.id === id))
    .filter((m): m is Catalog => !!m);
  function draft(m: Catalog): EnrollmentDraft {
    return (
      drafts[m.id] ?? {
        belt: "",
        amount: ((m.amount_cents ?? 0) / 100).toFixed(2),
      }
    );
  }
  function update(m: Catalog, change: Partial<EnrollmentDraft>) {
    setDrafts((old) => ({ ...old, [m.id]: { ...draft(m), ...change } }));
  }
  function cents() {
    return mode === "modalities"
      ? selected.reduce((sum, m) => sum + parseMoney(draft(m).amount || "0"), 0)
      : parseMoney(amount || "0");
  }
  function totalLabel() {
    try {
      return money(cents());
    } catch {
      return "Confira os valores";
    }
  }
  function choosePlan(p: Catalog) {
    if (plan === p.id) return;
    setPlan(p.id);
    setMods(p.modality_ids ?? []);
    setAmount(((p.amount_cents ?? 0) / 100).toFixed(2));
  }
  function changeMode(value: ChargeMode) {
    if (value === mode) return;
    setMode(value);
    if (value === "modalities")
      setDrafts((old) =>
        Object.fromEntries(
          selected.map((m) => [
            m.id,
            {
              belt: old[m.id]?.belt ?? "",
              amount: ((m.amount_cents ?? 0) / 100).toFixed(2),
            },
          ]),
        ),
      );
    if (value === "custom" && initial) {
      setPlan(initial.plan_id);
      setMods(initial.modality_ids);
      setAmount(((initial.billing?.amount_cents ?? 0) / 100).toFixed(2));
      setDrafts(
        Object.fromEntries(
          initial.modality_details.map((d) => [
            d.modality_id,
            { belt: d.belt, amount: (d.amount_cents / 100).toFixed(2) },
          ]),
        ),
      );
      return;
    }
    if (value !== "plan") setPlan("");
    if (value === "plan") {
      setPlan("");
      setMods([]);
    }
  }
  function applyStudent(s: Student) {
    setName(s.name);
    setEmail(s.email);
    setPhone(s.phone);
    setAlternate(s.alternate_phone);
    setStatus(s.status);
    setMode(s.charge_mode);
    setPlan(s.plan_id);
    setMods(s.modality_ids);
    setDrafts(
      Object.fromEntries(
        s.modality_details.map((d) => [
          d.modality_id,
          { belt: d.belt, amount: (d.amount_cents / 100).toFixed(2) },
        ]),
      ),
    );
    setEnabled(s.billing?.enabled ?? false);
    setAmount(((s.billing?.amount_cents ?? 0) / 100).toFixed(2));
    setDay(String(s.billing?.due_day ?? 10));
    setMonth(s.billing?.first_month ?? monthNow());
    setPayer(s.billing?.payer_name ?? "");
    setDocument(s.billing?.payer_document ?? "");
  }
  function cancel() {
    if (initial) {
      applyStudent(initial);
      setEditing(false);
      setMessage("");
      save.reset();
    } else router.replace("/students");
  }
  const save = useMutation({
    mutationFn: () =>
      api<Student>(
        academyPath(a.id, "/students" + (initial ? "/" + initial.id : "")),
        {
          method: initial ? "PATCH" : "POST",
          body: {
            name,
            email,
            phone,
            alternate_phone: alternate,
            status,
            charge_mode: mode,
            plan_id: plan,
            modality_ids: mods,
            belt: mode === "custom" ? initial?.belt : undefined,
            modality_details: selected.map((m) => ({
              modality_id: m.id,
              belt: draft(m).belt,
              amount_cents:
                mode === "modalities"
                  ? parseMoney(draft(m).amount || "0")
                  : mode === "custom"
                    ? (initial?.modality_details.find(
                        (d) => d.modality_id === m.id,
                      )?.amount_cents ?? 0)
                    : 0,
            })),
            billing: {
              enabled,
              amount_cents: cents(),
              due_day: Number(day),
              first_month: month,
              payer_name: payer || name,
              payer_document: document.replace(/\D/g, ""),
            },
          },
        },
      ),
    onSuccess: (s) => {
      void queryClient.invalidateQueries();
      setMessage("Cadastro salvo.");
      if (!initial)
        router.replace({ pathname: "/students/[id]", params: { id: s.id } });
      else {
        applyStudent(s);
        setEditing(false);
      }
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
      if (await Clipboard.setStringAsync(url))
        setMessage("Convite copiado. Válido por 7 dias.");
      else setMessage("Convite gerado. Copie o link abaixo.");
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
  function validate(step: number): string | undefined {
    if (step === 0) {
      if (name.trim().length < 2 || name.trim().length > 100)
        return "Informe o nome completo, com 2 a 100 caracteres.";
      if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        return "Confira o e-mail.";
      if (phone.length > 30 || alternate.length > 30)
        return "Confira os telefones.";
    }
    if (step === 1) {
      if (mode !== "custom" && !selected.length)
        return "Selecione pelo menos uma modalidade.";
      if (mode === "plan" && !plan) return "Selecione um plano.";
      for (const m of selected)
        if ((m.belt_options ?? []).length && !draft(m).belt)
          return "Selecione a faixa em " + m.name + ".";
    }
    if (step === 2) {
      const value = cents();
      if (value < 0 || value > 100000000 || (enabled && value === 0))
        return "Informe um valor mensal positivo para ativar a cobrança.";
      if (!/^\d+$/.test(day) || Number(day) < 1 || Number(day) > 31)
        return "O vencimento deve ser um dia entre 1 e 31.";
      if (!/^(20[2-9]\d|2100)-(0[1-9]|1[0-2])$/.test(month))
        return "Informe a competência no formato YYYY-MM.";
      if (enabled && !initial?.billing?.enabled && month < monthNow())
        return "A cobrança deve começar no mês atual ou em um mês futuro.";
    }
    if (step === 3) {
      if ((payer || name).trim().length < 2)
        return "Informe o nome do pagador.";
      if ((enabled || document.trim()) && !validDocument(document))
        return "Informe um CPF ou CNPJ válido do pagador.";
    }
  }
  function summary() {
    const currentPlan = plans.find((p) => p.id === plan);
    return (
      <>
        <Card>
          <Heading>{name}</Heading>
          <Label muted>
            {status === "active" ? "Aluno ativo" : "Aluno inativo"}
          </Label>
          <Label>{email || "E-mail não informado"}</Label>
          <Label>{phone || "Celular não informado"}</Label>
          {alternate ? <Label>Telefone alternativo: {alternate}</Label> : null}
        </Card>
        <Card>
          <Heading>
            {mode === "plan"
              ? (currentPlan?.name ?? "Plano")
              : mode === "modalities"
                ? "Por modalidades"
                : "Valor atual"}
          </Heading>
          {selected.map((m) => (
            <View key={m.id} style={{ gap: 8, paddingVertical: 8 }}>
              <Row>
                <View style={{ flex: 1 }}>
                  <Label>{m.name}</Label>
                </View>
                {draft(m).belt ? (
                  <BeltSwatch
                    colors={
                      m.belt_options?.find((o) => o.label === draft(m).belt)
                        ?.colors ?? ["#929292"]
                    }
                  />
                ) : null}
              </Row>
              <Label muted>
                {draft(m).belt || "Sem graduação"}
                {mode === "modalities"
                  ? " • " + money(parseMoney(draft(m).amount || "0")) + "/mês"
                  : ""}
              </Label>
            </View>
          ))}
          <Heading>{totalLabel()} por mês</Heading>
          <Label muted>
            {enabled
              ? "Cobrança mensal ativa"
              : "Cobrança automática desativada"}
          </Label>
          <Label>
            Vencimento: dia {day} • Competência: {month}
          </Label>
        </Card>
        {enabled ? (
          <Card>
            <Heading>Pagador</Heading>
            <Label>{payer || name}</Label>
            <Label>{document}</Label>
          </Card>
        ) : null}
      </>
    );
  }
  return (
    <AcademyShell title={initial ? "Cadastro do aluno" : "Novo aluno"}>
      <Notice success message={message} />
      {editing ? (
        <FormWizard
          steps={steps}
          validate={validate}
          pending={save.isPending}
          error={save.error?.message}
          submitLabel={initial ? "Salvar alterações" : "Cadastrar aluno"}
          onSubmit={() => {
            setMessage("");
            save.mutate();
          }}
          onCancel={cancel}
        >
          {(step) => (
            <>
              {step === 0 ? (
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
                  <Field
                    label="Telefone alternativo (opcional)"
                    value={alternate}
                    onChangeText={setAlternate}
                    keyboardType="phone-pad"
                  />
                  {initial ? (
                    <>
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
                        Inativar interrompe novas cobranças e presenças,
                        preservando o histórico.
                      </Label>
                    </>
                  ) : null}
                </Card>
              ) : null}
              {step === 1 ? (
                <>
                  <Card>
                    <Heading>Como o aluno vai contratar?</Heading>
                    <Row>
                      <Chip
                        selected={mode === "modalities"}
                        onPress={() => changeMode("modalities")}
                      >
                        Por modalidades
                      </Chip>
                      <Chip
                        selected={mode === "plan"}
                        onPress={() => changeMode("plan")}
                      >
                        Por plano
                      </Chip>
                      {initial?.charge_mode === "custom" ? (
                        <Chip
                          selected={mode === "custom"}
                          onPress={() => changeMode("custom")}
                        >
                          Manter valor atual
                        </Chip>
                      ) : null}
                    </Row>
                  </Card>
                  {mode === "plan" ? (
                    <Card>
                      <Heading>Escolha o plano</Heading>
                      {plans
                        .filter((p) => p.active || p.id === initial?.plan_id)
                        .map((p) => (
                          <Chip
                            key={p.id}
                            selected={plan === p.id}
                            onPress={() => choosePlan(p)}
                          >
                            {p.name} • {money(p.amount_cents ?? 0)}
                          </Chip>
                        ))}
                      {!plans.some((p) => p.active) ? (
                        <Label muted>
                          Cadastre um plano em Mais → Modalidades e planos.
                        </Label>
                      ) : null}
                    </Card>
                  ) : (
                    <Card>
                      <Heading>Selecione as modalidades</Heading>
                      <Row>
                        {modalities
                          .filter((m) => m.active || mods.includes(m.id))
                          .map((m) => (
                            <Chip
                              key={m.id}
                              selected={mods.includes(m.id)}
                              onPress={() =>
                                setMods((old) =>
                                  old.includes(m.id)
                                    ? old.filter((id) => id !== m.id)
                                    : [...old, m.id],
                                )
                              }
                            >
                              {m.name}
                              {mode === "modalities"
                                ? " • " + money(m.amount_cents ?? 0)
                                : ""}
                            </Chip>
                          ))}
                      </Row>
                      {!modalities.length ? (
                        <Label muted>
                          Cadastre uma modalidade em Mais → Modalidades e
                          planos.
                        </Label>
                      ) : null}
                    </Card>
                  )}
                  {selected.map((m) => (
                    <Card key={m.id}>
                      <Heading>{m.name}</Heading>
                      <BeltPicker
                        modality={m.name}
                        options={m.belt_options ?? []}
                        value={draft(m).belt}
                        onChange={(belt) => update(m, { belt })}
                      />
                    </Card>
                  ))}
                </>
              ) : null}
              {step === 2 ? (
                <>
                  <Card>
                    <Heading>
                      {mode === "modalities"
                        ? "Valores por modalidade"
                        : mode === "plan"
                          ? "Valor do plano"
                          : "Mensalidade atual"}
                    </Heading>
                    {mode === "modalities" ? (
                      selected.map((m) => (
                        <Field
                          key={m.id}
                          label={"Mensalidade de " + m.name + " (R$)"}
                          value={draft(m).amount}
                          onChangeText={(value) => update(m, { amount: value })}
                          keyboardType="decimal-pad"
                        />
                      ))
                    ) : (
                      <Field
                        label="Valor mensal combinado (R$)"
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="decimal-pad"
                      />
                    )}
                    <Heading>Total: {totalLabel()}/mês</Heading>
                    <Label muted>
                      {mode === "modalities"
                        ? "Os valores serão somados em uma única mensalidade."
                        : "Você pode ajustar o valor individual combinado com o aluno."}
                    </Label>
                  </Card>
                  <Card>
                    <Chip
                      selected={enabled}
                      onPress={() => {
                        if (status === "active") {
                          setEnabled(!enabled);
                          if (
                            !enabled &&
                            !initial?.billing?.enabled &&
                            month < monthNow()
                          )
                            setMonth(monthNow());
                        }
                      }}
                    >
                      {enabled
                        ? "✓ Cobrança mensal ativa"
                        : "Ativar cobrança mensal"}
                    </Chip>
                    {status === "inactive" ? (
                      <Label muted>
                        Reative o aluno para habilitar a cobrança.
                      </Label>
                    ) : null}
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
                    <Label muted>
                      Mensalidades já emitidas mantêm seus valores. As
                      alterações serão usadas nas próximas emissões.
                    </Label>
                  </Card>
                </>
              ) : null}
              {step === 3 ? (
                <Card>
                  <Label muted>
                    {enabled
                      ? "Informe quem vai pagar a mensalidade. Pode ser o próprio aluno ou um responsável."
                      : "Você pode preencher os dados agora ou antes de ativar a cobrança."}
                  </Label>
                  <Field
                    label="Nome do pagador ou responsável"
                    value={payer}
                    onChangeText={setPayer}
                    placeholder={name}
                    autoCapitalize="words"
                  />
                  <Field
                    label="CPF ou CNPJ do pagador"
                    value={document}
                    onChangeText={setDocument}
                    keyboardType="number-pad"
                  />
                </Card>
              ) : null}
              {step === 4 ? (
                <>
                  <Label muted>Confira os dados antes de concluir.</Label>
                  {summary()}
                </>
              ) : null}
            </>
          )}
        </FormWizard>
      ) : (
        <>
          {summary()}
          <Button
            onPress={() => {
              save.reset();
              setEditing(true);
            }}
          >
            Editar cadastro
          </Button>
        </>
      )}
      {initial && !editing ? (
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
          <Notice message={invite.error?.message || revoke.error?.message} />
        </Card>
      ) : null}
    </AcademyShell>
  );
}
