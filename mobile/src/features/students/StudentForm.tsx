import { validDocument } from "../../types/documents";
import { ageOn, birthToISO, formatBirth } from "../../types/age";
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
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { cpfDigits, formatCPF, validCPF } from "../../types/cpf";
import { FormWizard } from "../../components/FormWizard";
import {
  BeltPicker,
  BeltSwatch,
  DegreePicker,
} from "../../components/BeltPicker";
import { rankLabel } from "../../types/graduation";
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

const allSteps = [
  "Identificação",
  "Modalidades",
  "Mensalidade",
  "Responsável",
  "Revisão",
];
type EnrollmentDraft = { belt: string; degrees: number; amount: string };
export default function StudentForm({
  initial,
  modalities,
  plans,
  startStep = 0,
  onExit,
}: {
  initial?: Student;
  modalities: Catalog[];
  plans: Catalog[];
  startStep?: number;
  onExit?: () => void;
}) {
  const { academy } = useSession();
  const a = academy!;
  const [editing, setEditing] = useState(!initial || !!onExit);
  const [name, setName] = useState(initial?.name ?? "");
  const [cpf, setCPF] = useState(formatCPF(initial?.cpf ?? ""));
  const [birth, setBirth] = useState(formatBirth(initial?.birth_date ?? ""));
  const birthISO = birthToISO(birth);
  const age = ageOn(birthISO, a.timezone),
    minor = age !== null && age < 18;
  const steps = minor ? allSteps : allSteps.filter((_, i) => i !== 3);
  const [confirmArchive, setConfirmArchive] = useState(false);
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
        {
          belt: d.belt,
          degrees: d.degrees ?? 0,
          amount: (d.amount_cents / 100).toFixed(2),
        },
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
        degrees: 0,
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
              degrees: old[m.id]?.degrees ?? 0,
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
            {
              belt: d.belt,
              degrees: d.degrees ?? 0,
              amount: (d.amount_cents / 100).toFixed(2),
            },
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
    setCPF(formatCPF(s.cpf ?? ""));
    setBirth(formatBirth(s.birth_date ?? ""));
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
          {
            belt: d.belt,
            degrees: d.degrees ?? 0,
            amount: (d.amount_cents / 100).toFixed(2),
          },
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
    if (onExit) {
      onExit();
      return;
    }
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
            cpf: cpfDigits(cpf),
            birth_date: birthISO,
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
              degrees: draft(m).degrees,
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
              payer_name: minor ? payer : name,
              payer_document: minor
                ? document.replace(/\D/g, "")
                : cpfDigits(cpf),
            },
          },
        },
      ),
    onSuccess: (s) => {
      if (initial) queryClient.setQueryData(["student", a.id, s.id], s);
      void queryClient.invalidateQueries();
      if (onExit) {
        onExit();
        return;
      }
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
  const lifecycle = useMutation({
    mutationFn: (action: "archive" | "restore") =>
      api<Student>(
        academyPath(a.id, "/students/" + initial!.id + "/" + action),
        { method: "POST" },
      ),
    onSuccess: (student, action) => {
      queryClient.setQueryData(["student", a.id, student.id], student);
      applyStudent(student);
      void queryClient.invalidateQueries();
      setConfirmArchive(false);
      setMessage(
        action === "archive"
          ? "Aluno arquivado. Histórico e débitos preservados."
          : "Aluno restaurado. Revise a competência antes de reativar a cobrança.",
      );
    },
  });
  function validate(index: number): string | undefined {
    const step = !minor && index === 3 ? 4 : index;
    if (step === 0) {
      if ((!initial || cpf.trim() || initial.cpf) && !validCPF(cpf))
        return "Informe um CPF válido do próprio aluno.";
      if (age === null)
        return "Informe uma data de nascimento válida (DD/MM/AAAA), sem datas futuras.";
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
      for (const m of selected) {
        if (
          !Number.isInteger(draft(m).degrees) ||
          draft(m).degrees < 0 ||
          draft(m).degrees > 4
        )
          return "Selecione de zero a quatro graus em " + m.name + ".";
        if ((m.belt_options ?? []).length && !draft(m).belt)
          return "Selecione a faixa em " + m.name + ".";
      }
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
      if (
        (enabled || document.trim()) &&
        (payer.trim().length < 2 ||
          !validDocument(document) ||
          document.replace(/\D/g, "") === cpfDigits(cpf))
      )
        return "Informe nome e CPF/CNPJ de um responsável diferente do menor.";
    }
  }
  function summary() {
    const currentPlan = plans.find((p) => p.id === plan);
    return (
      <>
        <Card>
          <Heading>{name}</Heading>
          <Label muted>
            {initial?.archived_at
              ? "Aluno arquivado"
              : status === "active"
                ? "Aluno ativo"
                : "Aluno inativo"}
          </Label>
          <Label>CPF: {cpf || "Pendente de atualização"}</Label>
          <Label>
            Nascimento: {birth}
            {age !== null ? " · " + age + " anos" : ""}
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
                    degrees={draft(m).degrees}
                    colors={
                      m.belt_options?.find((o) => o.label === draft(m).belt)
                        ?.colors ?? ["#929292"]
                    }
                  />
                ) : null}
              </Row>
              <Label muted>
                {rankLabel(draft(m).belt, draft(m).degrees)}
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
        {minor ? (
          <Card>
            <Heading>Responsável financeiro</Heading>
            <Label>{payer || "A definir"}</Label>
            <Label>{document}</Label>
          </Card>
        ) : null}
      </>
    );
  }
  return (
    <AcademyShell
      title={initial ? "Editar cadastro" : "Novo aluno"}
      swipeEnabled={false}
      titleAction={
        onExit ? (
          <Button compact secondary disabled={save.isPending} onPress={cancel}>
            Cancelar
          </Button>
        ) : undefined
      }
    >
      <Notice success message={message} />
      {editing ? (
        <FormWizard
          steps={steps}
          initialStep={minor ? startStep : Math.min(startStep, 3)}
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
          {(index) => {
            const step = !minor && index === 3 ? 4 : index;
            return (
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
                      label={
                        initial && !initial.cpf
                          ? "CPF do aluno (cadastro antigo: opcional)"
                          : "CPF do aluno"
                      }
                      value={cpf}
                      onChangeText={(value) => setCPF(formatCPF(value))}
                      keyboardType="number-pad"
                      maxLength={14}
                      placeholder="000.000.000-00"
                    />
                    <Label muted>
                      Use o CPF do próprio aluno para identificar a presença.
                    </Label>
                    <Field
                      label="Data de nascimento"
                      value={birth}
                      onChangeText={(v) => setBirth(formatBirth(v))}
                      keyboardType="number-pad"
                      placeholder="DD/MM/AAAA"
                      maxLength={10}
                    />
                    <Label muted>
                      {age === null
                        ? "A data define se precisa de responsável financeiro."
                        : minor
                          ? "Menor de idade: informe o responsável financeiro na etapa correspondente."
                          : "Maior de idade: o próprio aluno será o pagador."}
                    </Label>
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
                          degrees={draft(m).degrees}
                          onChange={(belt) =>
                            update(m, {
                              belt,
                              degrees:
                                belt === draft(m).belt ? draft(m).degrees : 0,
                            })
                          }
                        />
                        {draft(m).belt ? (
                          <DegreePicker
                            modality={m.name}
                            value={draft(m).degrees}
                            onChange={(degrees) => update(m, { degrees })}
                          />
                        ) : null}
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
                            onChangeText={(value) =>
                              update(m, { amount: value })
                            }
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
                      O aluno é menor de 18 anos. Informe o responsável
                      financeiro antes de ativar a cobrança.
                    </Label>
                    <Field
                      label="Nome do responsável financeiro"
                      value={payer}
                      onChangeText={setPayer}
                      placeholder="Nome completo do responsável"
                      autoCapitalize="words"
                    />
                    <Field
                      label="CPF ou CNPJ do responsável"
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
            );
          }}
        </FormWizard>
      ) : (
        <>
          {summary()}
          {!initial?.archived_at ? (
            <Button
              onPress={() => {
                save.reset();
                setEditing(true);
              }}
            >
              Editar cadastro
            </Button>
          ) : null}
          {initial ? (
            <Card>
              <Heading>
                {initial.archived_at
                  ? "Voltar aos treinos"
                  : "Arquivar cadastro"}
              </Heading>
              <Label muted>
                {initial.archived_at
                  ? "Restaure este mesmo cadastro, com CPF, QR e histórico. A cobrança automática permanece desativada."
                  : "O aluno sai da lista principal e deixa de registrar presenças e gerar novas mensalidades. Histórico e débitos permanecem."}
              </Label>
              <Button
                secondary
                loading={lifecycle.isPending}
                onPress={() => {
                  lifecycle.reset();
                  setConfirmArchive(true);
                }}
              >
                {initial.archived_at ? "Restaurar aluno" : "Arquivar aluno"}
              </Button>
            </Card>
          ) : null}
        </>
      )}
      {initial && !initial.archived_at && !editing ? (
        <Card>
          <Heading>Acesso do aluno</Heading>
          <Label>
            {cpf
              ? "Presença por CPF ou QR Code"
              : "CPF pendente • QR e código anterior continuam válidos"}
          </Label>
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
      <ConfirmDialog
        visible={confirmArchive}
        title={initial?.archived_at ? "Restaurar aluno?" : "Arquivar aluno?"}
        message={
          initial?.archived_at
            ? "O aluno poderá registrar presença novamente. Nenhuma mensalidade será criada por esta restauração; revise a cobrança no cadastro."
            : "Novas cobranças e presenças serão interrompidas. O CPF, o QR, o histórico e os débitos serão preservados. Você poderá restaurar o cadastro em Arquivados."
        }
        confirmLabel={
          initial?.archived_at
            ? "Confirmar restauração"
            : "Confirmar arquivamento"
        }
        pending={lifecycle.isPending}
        error={lifecycle.error?.message}
        onCancel={() => setConfirmArchive(false)}
        onConfirm={() =>
          lifecycle.mutate(initial?.archived_at ? "restore" : "archive")
        }
      />
    </AcademyShell>
  );
}
