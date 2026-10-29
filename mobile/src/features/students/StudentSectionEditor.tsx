import { academyDate } from "../../types/attendance";
import { firstBillingMonth } from "./billing-dates";
import { useIdentityCheck } from "./useIdentityCheck";
import { MonthPicker, DueDayPicker } from "../../components/BillingDatePicker";
import { dueDateLabel } from "../../types/month";
import { useState } from "react";
import { BillingToggle } from "./BillingToggle";
import { View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { EditorDialog } from "../../components/EditorDialog";
import { BeltPicker, DegreePicker } from "../../components/BeltPicker";
import {
  Button,
  Chip,
  Field,
  Heading,
  Label,
  Notice,
  Row,
} from "../../components/ui";
import { api, academyPath } from "../../services/api";
import { queryClient } from "../../services/session";
import {
  Billing,
  Catalog,
  Student,
  monthNow,
  money,
  parseMoney,
} from "../../types/billing";
import { cpfDigits, formatCPF, validCPF } from "../../types/cpf";
import { validDocument } from "../../types/documents";
import { ageOn, birthToISO, formatBirth } from "../../types/age";

export type StudentSection =
  "personal" | "billing" | "payer" | { rank: string };
function payload(s: Student) {
  return {
    name: s.name,
    cpf: s.cpf,
    birth_date: s.birth_date,
    email: s.email,
    phone: s.phone,
    alternate_phone: s.alternate_phone,
    status: s.status,
    charge_mode: s.charge_mode,
    plan_id: s.plan_id,
    belt: s.belt,
    modality_ids: s.modality_ids,
    modality_details: s.modality_details,
    billing: s.billing,
  };
}
export function StudentSectionEditor({
  academyId,
  timezone,
  student,
  modalities,
  section,
  onClose,
}: {
  academyId: string;
  timezone: string;
  student: Student;
  modalities: Catalog[];
  section: StudentSection;
  onClose: () => void;
}) {
  const rankId = typeof section === "object" ? section.rank : "";
  const modality = modalities.find((m) => m.id === rankId);
  const oldRank = student.modality_details.find(
    (d) => d.modality_id === rankId,
  );
  const [belt, setBelt] = useState(oldRank?.belt ?? ""),
    [degrees, setDegrees] = useState(oldRank?.degrees ?? 0);
  const [name, setName] = useState(student.name),
    [cpf, setCPF] = useState(formatCPF(student.cpf)),
    [email, setEmail] = useState(student.email),
    [phone, setPhone] = useState(student.phone),
    [alternate, setAlternate] = useState(student.alternate_phone);
  const [status, setStatus] = useState(student.status);
  const identity = useIdentityCheck(
    academyId,
    { student_id: student.id, email, cpf, phone, alternate_phone: alternate },
    section === "personal",
  );
  const [birth, setBirth] = useState(formatBirth(student.birth_date));
  const birthISO = birthToISO(birth),
    age = ageOn(birthISO, timezone),
    minor = age !== null && age < 18;
  const [amount, setAmount] = useState(
    ((student.billing?.amount_cents ?? 0) / 100).toFixed(2),
  );
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      student.modality_details.map((d) => [
        d.modality_id,
        (d.amount_cents / 100).toFixed(2),
      ]),
    ),
  );
  const [enabled, setEnabled] = useState(student.billing?.enabled ?? false),
    [day, setDay] = useState(String(student.billing?.due_day ?? 10));
  const [month, setMonth] = useState(
    student.billing?.first_month ?? monthNow(),
  );
  const [payer, setPayer] = useState(
      student.billing?.payer_name ?? student.name,
    ),
    [document, setDocument] = useState(student.billing?.payer_document ?? "");
  const showPayer = minor && !rankId;
  function total() {
    return student.charge_mode === "modalities"
      ? student.modality_details.reduce(
          (sum, d) => sum + parseMoney(amounts[d.modality_id] || "0"),
          0,
        )
      : parseMoney(amount || "0");
  }
  const save = useMutation({
    mutationFn: async () => {
      if (rankId) {
        if (!modality || !oldRank)
          throw new Error("Modalidade não encontrada.");
        if (modality.belt_options?.length && !belt)
          throw new Error("Escolha a faixa.");
        return api<Student>(
          academyPath(
            academyId,
            "/students/" + student.id + "/graduations/" + rankId,
          ),
          { method: "PATCH", body: { belt, degrees } },
        );
      }
      const latest = await api<Student>(
        academyPath(academyId, "/students/" + student.id),
      );
      const body = payload(latest);
      if (section === "personal") {
        if (identity.pending)
          throw new Error("Aguarde a conferência dos dados.");
        if (identity.error) throw new Error(identity.error);
        if (identity.cpf_exists) throw new Error(identity.cpfMessage);
        if (identity.email_exists) throw new Error(identity.emailMessage);
        if (name.trim().length < 2 || name.trim().length > 100)
          throw new Error("Informe o nome completo.");
        if ((cpf.trim() || latest.cpf) && !validCPF(cpf))
          throw new Error("Informe um CPF válido do próprio aluno.");
        if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
          throw new Error("Confira o e-mail.");
        if (age === null)
          throw new Error(
            "Informe uma data de nascimento válida (DD/MM/AAAA).",
          );
        Object.assign(body, {
          birth_date: birthISO,
          name: name.trim(),
          cpf: cpfDigits(cpf),
          email: email.trim(),
          phone,
          alternate_phone: alternate,
          status,
        });
        body.billing = null;
        if (minor && (latest.billing || document.trim())) {
          const b: Billing = latest.billing
            ? { ...latest.billing }
            : {
                enabled: false,
                amount_cents: 0,
                due_day: 10,
                first_month: monthNow(),
                payer_name: "",
                payer_document: "",
              };
          b.payer_name = payer.trim();
          b.payer_document = document.replace(/\D/g, "");
          if (status !== "active") b.enabled = false;
          if (
            (b.enabled || b.payer_document) &&
            (b.payer_name.length < 2 ||
              !validDocument(b.payer_document) ||
              b.payer_document === cpfDigits(cpf))
          )
            throw new Error(
              "Informe nome e CPF/CNPJ de um responsável diferente do menor.",
            );
          body.billing = b;
        }
      } else {
        if (
          JSON.stringify(latest.billing) !== JSON.stringify(student.billing) ||
          latest.charge_mode !== student.charge_mode ||
          latest.birth_date !== student.birth_date ||
          [...latest.modality_ids].sort().join() !==
            [...student.modality_ids].sort().join()
        ) {
          queryClient.setQueryData(["student", academyId, student.id], latest);
          throw new Error(
            "O contrato foi atualizado. Feche esta janela e abra novamente para editar os dados atuais.",
          );
        }
        if (age === null)
          throw new Error(
            "Informe a data de nascimento para definir quem paga.",
          );
        if (section === "payer" && !minor)
          throw new Error(
            "O responsável financeiro é usado somente para menores de 18 anos.",
          );
        body.birth_date = birthISO;
        const billing: Billing = latest.billing
          ? { ...latest.billing }
          : {
              enabled: false,
              amount_cents: 0,
              due_day: 10,
              first_month: monthNow(),
              payer_name: latest.name,
              payer_document: "",
            };
        if (section === "billing") {
          const cents = total();
          if (cents < 0 || cents > 100000000 || (enabled && cents === 0))
            throw new Error(
              "Informe um valor mensal positivo para ativar a cobrança.",
            );
          if (!/^\d+$/.test(day) || Number(day) < 1 || Number(day) > 31)
            throw new Error("O vencimento deve ser um dia de 1 a 31.");
          if (!/^(20[2-9]\d|2100)-(0[1-9]|1[0-2])$/.test(month))
            throw new Error("Informe o mês no formato AAAA-MM (ex.: 2026-11).");
          if (enabled && !student.billing?.enabled && month < monthNow())
            throw new Error("A cobrança deve começar no mês atual ou futuro.");
          if (enabled && latest.status !== "active")
            throw new Error("Reative o aluno antes de habilitar a cobrança.");
          Object.assign(billing, {
            enabled,
            amount_cents: cents,
            due_day: Number(day),
            first_month: !student.billing?.enabled
              ? firstBillingMonth(month, Number(day), academyDate(timezone))
              : month,
          });
          if (latest.charge_mode === "modalities")
            body.modality_details = latest.modality_details.map((d) => ({
              ...d,
              amount_cents: parseMoney(amounts[d.modality_id] || "0"),
            }));
        }
        if (showPayer)
          Object.assign(billing, {
            payer_name: payer.trim(),
            payer_document: document.replace(/\D/g, ""),
          });
        if (!minor) {
          billing.payer_name = latest.name;
          billing.payer_document = latest.cpf;
        }
        if (
          minor &&
          (billing.enabled || billing.payer_document) &&
          (billing.payer_name.length < 2 ||
            billing.payer_document === latest.cpf)
        )
          throw new Error(
            "Informe um responsável financeiro diferente do menor.",
          );
        if (
          (billing.enabled || billing.payer_document) &&
          !validDocument(billing.payer_document)
        )
          throw new Error(
            minor
              ? "Informe um CPF ou CNPJ válido do responsável."
              : "Confira o CPF nos dados pessoais do aluno.",
          );
        body.billing = billing;
      }
      return api<Student>(academyPath(academyId, "/students/" + student.id), {
        method: "PATCH",
        body,
      });
    },
    onSuccess: (value) => {
      queryClient.setQueryData(["student", academyId, student.id], value);
      void queryClient.invalidateQueries();
      onClose();
    },
  });
  const title = rankId
    ? "Graduação · " + (modality?.name ?? "Modalidade")
    : section === "personal"
      ? "Dados pessoais"
      : section === "billing"
        ? "Mensalidade"
        : "Responsável financeiro";
  let totalLabel = "Confira os valores";
  try {
    totalLabel = money(total());
  } catch {}
  return (
    <EditorDialog
      title={title}
      wide={!rankId}
      pending={save.isPending}
      onClose={onClose}
      footer={
        <>
          <Button compact secondary disabled={save.isPending} onPress={onClose}>
            Cancelar
          </Button>
          <Button
            compact
            loading={save.isPending}
            onPress={() => save.mutate()}
          >
            Salvar alterações
          </Button>
        </>
      }
    >
      {rankId && modality ? (
        <>
          <BeltPicker
            modality={modality.name}
            options={modality.belt_options ?? []}
            value={belt}
            degrees={degrees}
            onChange={(next) => {
              if (next !== belt) setDegrees(0);
              setBelt(next);
            }}
          />
          {belt ? (
            <DegreePicker
              modality={modality.name}
              value={degrees}
              onChange={setDegrees}
            />
          ) : null}
          <Label muted>
            A alteração vale só para esta modalidade. O contrato e as
            mensalidades são mantidos.
          </Label>
        </>
      ) : null}
      {section === "personal" ? (
        <>
          <Field
            label="Nome completo"
            value={name}
            onChangeText={setName}
            editable={!save.isPending}
            autoCapitalize="words"
          />
          <Field
            label={student.cpf ? "CPF do aluno" : "CPF do aluno (pendente)"}
            value={cpf}
            onChangeText={(v) => setCPF(formatCPF(v))}
            keyboardType="number-pad"
            maxLength={14}
            editable={!save.isPending}
          />
          <Notice message={identity.cpfMessage} />
          <Field
            label="Data de nascimento"
            value={birth}
            onChangeText={(v) => setBirth(formatBirth(v))}
            placeholder="DD/MM/AAAA"
            maxLength={10}
            keyboardType="number-pad"
            editable={!save.isPending}
          />
          <Label muted>
            {age === null
              ? "A data define a necessidade de responsável."
              : minor
                ? "Menor de idade: informe o responsável financeiro abaixo."
                : "Maior de idade: o próprio aluno será o pagador."}
          </Label>
          <Field
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            editable={!save.isPending && !student.email_locked}
          />
          <Notice message={identity.emailMessage} />
          {student.email_locked ? (
            <Label muted>
              E-mail da identidade: sua alteração não é feita pela matrícula.
            </Label>
          ) : null}
          <Field
            label="Celular"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            editable={!save.isPending}
          />
          <Notice message={identity.phoneMessage} />
          <Field
            label="Telefone alternativo (opcional)"
            value={alternate}
            onChangeText={setAlternate}
            keyboardType="phone-pad"
            editable={!save.isPending}
          />
          <Notice message={identity.alternateMessage} />
          <Row>
            <Chip
              selected={status === "active"}
              onPress={save.isPending ? undefined : () => setStatus("active")}
            >
              Ativo
            </Chip>
            <Chip
              selected={status === "inactive"}
              onPress={save.isPending ? undefined : () => setStatus("inactive")}
            >
              Inativo
            </Chip>
          </Row>
          <Label muted>
            Inativar interrompe novas presenças e cobranças. Os históricos e
            débitos são mantidos.
          </Label>
        </>
      ) : null}
      {section === "billing" ? (
        <>
          {!student.birth_date ? (
            <>
              <Field
                label="Data de nascimento"
                value={birth}
                onChangeText={(v) => setBirth(formatBirth(v))}
                placeholder="DD/MM/AAAA"
                maxLength={10}
                keyboardType="number-pad"
                editable={!save.isPending}
              />
              <Label muted>
                Informe a data para definir se o próprio aluno paga ou se
                precisa de responsável.
              </Label>
            </>
          ) : null}
          <Label muted>
            {student.charge_mode === "modalities"
              ? "Ajuste os valores contratados. A soma forma uma única mensalidade."
              : "Ajuste o valor combinado para este aluno."}
          </Label>
          {student.charge_mode === "modalities" ? (
            student.modality_details.map((d) => (
              <Field
                key={d.modality_id}
                label={
                  "Valor de " +
                  (modalities.find((m) => m.id === d.modality_id)?.name ??
                    "modalidade") +
                  " (R$)"
                }
                value={amounts[d.modality_id]}
                onChangeText={(v) =>
                  setAmounts((old) => ({ ...old, [d.modality_id]: v }))
                }
                keyboardType="decimal-pad"
                editable={!save.isPending}
              />
            ))
          ) : (
            <Field
              label="Valor mensal (R$)"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              editable={!save.isPending}
            />
          )}
          <Heading>{totalLabel} por mês</Heading>
          <BillingToggle
            enabled={enabled}
            disabled={save.isPending || student.status !== "active"}
            onChange={(next) => {
              setEnabled(next);
              if (next && !student.billing?.enabled && month < monthNow())
                setMonth(monthNow());
            }}
          />
          {student.status !== "active" ? (
            <Label muted>Reative o aluno para habilitar a cobrança.</Label>
          ) : null}
          <View style={{ gap: 16 }}>
            <DueDayPicker
              value={day}
              onChange={setDay}
              disabled={save.isPending}
            />
            <MonthPicker
              label={
                student?.billing?.enabled
                  ? "Próxima emissão"
                  : "Começar a cobrança em"
              }
              value={month}
              onChange={setMonth}
              disabled={save.isPending || !!student?.billing?.enabled}
              min={!student?.billing?.enabled ? monthNow() : ""}
            />
            <Label muted>
              {student?.billing?.enabled
                ? "Próxima emissão prevista: "
                : "Primeiro vencimento: "}
              {dueDateLabel(
                !student.billing?.enabled
                  ? firstBillingMonth(month, Number(day), academyDate(timezone))
                  : month,
                Number(day),
              )}
            </Label>
          </View>
          <Label muted>
            Mensalidades já emitidas mantêm seus valores e vencimentos.
            Alterações valem para as próximas emissões.
          </Label>
        </>
      ) : null}
      {showPayer ? (
        <>
          <Field
            label="Nome do responsável financeiro"
            value={payer}
            onChangeText={setPayer}
            editable={!save.isPending}
            autoCapitalize="words"
          />
          <Field
            label="CPF ou CNPJ do responsável"
            value={document}
            onChangeText={setDocument}
            keyboardType="number-pad"
            editable={!save.isPending}
          />
          <Label muted>
            O responsável financeiro é necessário para alunos menores de 18
            anos.
          </Label>
        </>
      ) : null}
      <Notice message={save.error?.message} />
    </EditorDialog>
  );
}
