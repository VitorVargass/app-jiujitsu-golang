import { DueDayPicker } from "../../components/BillingDatePicker";
import { useRef, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import {
  Page,
  Card,
  Heading,
  Label,
  Button,
  Field,
  Chip,
  Row,
  Notice,
  Loading,
} from "../../components/ui";
import { FormWizard } from "../../components/FormWizard";
import { BeltPicker, DegreePicker } from "../../components/BeltPicker";
import { ResponsiveGrid } from "../../components/ResponsiveGrid";
import { api } from "../../services/api";
import { queryClient, useSession } from "../../services/session";
import { ageOn, birthToISO, formatBirth } from "../../types/age";
import { validCPF, formatCPF, cpfDigits } from "../../types/cpf";
import { money } from "../../types/billing";
import type { EnrollmentPreview, EnrollmentResult } from "./types";

export default function EnrollmentScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <EnrollmentLanding key={token} token={token} />;
}
function EnrollmentLanding({ token }: { token: string }) {
  const { ready, session, logout } = useSession();
  const preview = useQuery({
    queryKey: ["enrollment-preview", token],
    queryFn: () => api<EnrollmentPreview>("/v1/enrollment-links/" + token),
    enabled: /^[a-f0-9]{64}$/.test(token ?? ""),
    retry: false,
  });
  if (!/^[a-f0-9]{64}$/.test(token ?? ""))
    return (
      <Page title="Matrícula">
        <Notice message="Link inválido. Peça o link atual à academia." />
      </Page>
    );
  if (!ready || preview.isPending)
    return (
      <Page>
        <Loading />
      </Page>
    );
  if (preview.error || !preview.data)
    return (
      <Page title="Matrícula">
        <Notice message={preview.error?.message ?? "Link inválido."} />
        <Button secondary onPress={() => preview.refetch()}>
          Tentar novamente
        </Button>
      </Page>
    );
  const data = preview.data;
  return (
    <Page title={data.academy_name} subtitle="Sua matrícula começa aqui">
      <Card>
        <Heading>Treine com a gente</Heading>
        <Label muted>
          Escolha seu plano ou suas modalidades. Para menores de idade, o
          responsável cria a conta em seu próprio nome e pode cadastrar mais de
          um filho.
        </Label>
      </Card>
      {session?.kind === "user" ? (
        <>
          <Label>
            Conta de {session.user.name} · {session.user.email}
          </Label>
          <EnrollmentForm preview={data} token={token} />
        </>
      ) : (
        <Card>
          <Heading>Entre ou crie sua conta</Heading>
          <Label muted>
            Use seu próprio e-mail. A matrícula será vinculada a esta academia.
            Para uma criança, use a conta do responsável.
          </Label>
          <Button
            onPress={() =>
              router.push({
                pathname: "/register",
                params: { next: "/enroll/" + token },
              })
            }
          >
            Criar minha conta
          </Button>
          <Button
            secondary
            onPress={() =>
              router.push({
                pathname: "/login",
                params: { next: "/enroll/" + token },
              })
            }
          >
            Já tenho conta
          </Button>
        </Card>
      )}
      {session ? (
        <Button secondary compact onPress={() => void logout()}>
          Sair desta conta
        </Button>
      ) : null}
    </Page>
  );
}
function EnrollmentForm({
  preview: p,
  token,
}: {
  preview: EnrollmentPreview;
  token: string;
}) {
  const { session, reloadAcademies } = useSession();
  const [name, setName] = useState("");
  const [cpf, setCPF] = useState("");
  const [birth, setBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [alt, setAlt] = useState("");
  const [gcpf, setGCPF] = useState("");
  const [gbirth, setGBirth] = useState("");
  const individualModalities = p.modalities.filter(
    (x) => p.available_modality_ids.includes(x.id) && (x.amount_cents ?? 0) > 0,
  );
  const [plan, setPlan] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [ids, setIDs] = useState<string[]>([]);
  const [ranks, setRanks] = useState<
    Record<string, { belt: string; degrees: number }>
  >({});
  const [result, setResult] = useState<EnrollmentResult | null>(null);
  const attempt = useRef<{ hash: string; key: string } | null>(null);
  const age = ageOn(birthToISO(birth), p.timezone);
  const minor = age !== null && age < 18;
  const selectedPlan = p.plans.find((x) => x.id === plan);
  const selectedIDs = selectedPlan?.modality_ids ?? ids;
  const selected = p.modalities.filter((x) => selectedIDs.includes(x.id));
  const amount =
    selectedPlan?.amount_cents ??
    selected.reduce((sum, x) => sum + (x.amount_cents ?? 0), 0);
  const duePreview = useQuery({
    queryKey: ["enrollment-due-preview", token, dueDay],
    queryFn: () =>
      api<EnrollmentPreview>(
        "/v1/enrollment-links/" + token + "?due_day=" + dueDay,
      ),
    enabled: !!dueDay && Number(dueDay) >= 1 && Number(dueDay) <= 31,
    retry: false,
  });
  const firstDue = duePreview.data?.first_due ?? "";
  const submit = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        cpf: cpfDigits(cpf),
        birth_date: birthToISO(birth),
        phone,
        alternate_phone: alt,
        guardian_cpf: minor ? cpfDigits(gcpf) : "",
        guardian_birth_date: minor ? birthToISO(gbirth) : "",
        plan_id: plan,
        modality_details: selected.map((x) => ({
          modality_id: x.id,
          belt: ranks[x.id]?.belt ?? x.belt_options?.[0]?.label ?? "",
          degrees: ranks[x.id]?.degrees ?? 0,
        })),
        expected_amount_cents: amount,
        due_day: Number(dueDay),
      };
      const hash = JSON.stringify(payload);
      if (!attempt.current || attempt.current.hash !== hash)
        attempt.current = { hash, key: Crypto.randomUUID() };
      return api<EnrollmentResult>(
        "/v1/enrollment-links/" + token + "/enroll",
        { method: "POST", body: payload, key: attempt.current.key },
      );
    },
    onSuccess: (r) => {
      setResult(r);
      reloadAcademies();
      void queryClient.invalidateQueries({ queryKey: ["family-students"] });
    },
  });
  function validate(step: number) {
    if (step === 0) {
      if (name.trim().length < 2) return "Informe o nome completo do aluno.";
      if (!validCPF(cpf)) return "Informe o CPF válido do aluno.";
      if (age === null) return "Confira a data de nascimento.";
      if (phone.trim().length < 8) return "Informe um telefone para contato.";
      if (
        minor &&
        (!validCPF(gcpf) ||
          cpfDigits(gcpf) === cpfDigits(cpf) ||
          (ageOn(birthToISO(gbirth), p.timezone) ?? 0) < 18)
      )
        return "Informe CPF e nascimento de um responsável maior de idade, diferente do aluno.";
    }
    if (step === 1) {
      if (!selected.length || amount <= 0)
        return "Selecione um plano ou modalidades com valor definido.";
      if (!dueDay || Number(dueDay) < 1 || Number(dueDay) > 31)
        return "Escolha o dia de vencimento da sua mensalidade.";
      if (!firstDue || duePreview.isError)
        return "Confira a data do primeiro vencimento antes de continuar.";
    }
  }
  if (result)
    return (
      <Card>
        <Heading>
          {result.status === "pending"
            ? "Pedido enviado para análise"
            : result.status === "rejected"
              ? "Pedido não aprovado"
              : "Matrícula pronta!"}
        </Heading>
        <Label>
          {result.status === "pending"
            ? "A gestora precisa conferir o acesso a um cadastro existente. O histórico será liberado após a aprovação. Nenhuma cobrança foi alterada."
            : result.status === "rejected"
              ? "Converse com a academia para revisar seu acesso."
              : result.status === "approved"
                ? "Seu acesso foi aprovado pela academia. O cadastro e a cobrança existentes foram mantidos."
                : "Sua primeira mensalidade vence em " +
                  formatBirth(result.first_due ?? firstDue) +
                  ". Você já pode consultar suas mensalidades, presenças e número de identificação."}
        </Label>
        <Button
          onPress={() =>
            router.replace(
              result.status === "pending" || result.status === "rejected"
                ? "/enrollment-status"
                : "/entry",
            )
          }
        >
          Continuar
        </Button>
        {minor && result.status === "active" ? (
          <Button
            secondary
            onPress={() => {
              setResult(null);
              setName("");
              setCPF("");
              setBirth("");
              submit.reset();
              attempt.current = null;
            }}
          >
            Cadastrar outro filho
          </Button>
        ) : null}
      </Card>
    );
  return (
    <Card>
      <FormWizard
        steps={["Identificação", "Plano e vencimento", "Revisar matrícula"]}
        validate={validate}
        pending={submit.isPending}
        error={submit.error?.message}
        submitLabel="Concluir matrícula"
        onSubmit={() => submit.mutate()}
      >
        {(step) =>
          step === 0 ? (
            <>
              <ResponsiveGrid>
                <Field
                  label="Nome completo do aluno"
                  value={name}
                  onChangeText={setName}
                  maxLength={100}
                />
                <Field
                  label="CPF do aluno"
                  value={cpf}
                  onChangeText={(v) => setCPF(formatCPF(v))}
                  keyboardType="numeric"
                  maxLength={14}
                />
                <Field
                  label="Nascimento do aluno (DD/MM/AAAA)"
                  value={birth}
                  onChangeText={(v) => setBirth(formatBirth(v))}
                  keyboardType="numeric"
                  maxLength={10}
                />
                <Field
                  label="Telefone para contato"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={30}
                />
                <Field
                  label="Segundo telefone (opcional)"
                  value={alt}
                  onChangeText={setAlt}
                  keyboardType="phone-pad"
                  maxLength={30}
                />
              </ResponsiveGrid>
              {minor ? (
                <Card>
                  <Heading>Responsável pelo aluno</Heading>
                  <Label>
                    {session?.kind === "user"
                      ? session.user.name + " · " + session.user.email
                      : ""}
                  </Label>
                  <Label muted>
                    Esta conta terá acesso às mensalidades, presenças e
                    identificação da criança.
                  </Label>
                  <ResponsiveGrid>
                    <Field
                      label="CPF do responsável"
                      value={gcpf}
                      onChangeText={(v) => setGCPF(formatCPF(v))}
                      keyboardType="numeric"
                      maxLength={14}
                    />
                    <Field
                      label="Nascimento do responsável (DD/MM/AAAA)"
                      value={gbirth}
                      onChangeText={(v) => setGBirth(formatBirth(v))}
                      keyboardType="numeric"
                      maxLength={10}
                    />
                  </ResponsiveGrid>
                </Card>
              ) : null}
            </>
          ) : step === 1 ? (
            <>
              <Heading>Como quer treinar?</Heading>
              <Row>
                {individualModalities.length ? (
                  <Chip selected={!plan} onPress={() => setPlan("")}>
                    Por modalidade
                  </Chip>
                ) : null}
                {p.plans.map((x) => (
                  <Chip
                    key={x.id}
                    selected={plan === x.id}
                    onPress={() => setPlan(x.id)}
                  >
                    {x.name + " · " + money(x.amount_cents ?? 0)}
                  </Chip>
                ))}
              </Row>
              {!plan && individualModalities.length ? (
                <Row>
                  {individualModalities.map((x) => (
                    <Chip
                      key={x.id}
                      selected={ids.includes(x.id)}
                      onPress={() =>
                        setIDs(
                          ids.includes(x.id)
                            ? ids.filter((i) => i !== x.id)
                            : [...ids, x.id],
                        )
                      }
                    >
                      {x.name + " · " + money(x.amount_cents ?? 0)}
                    </Chip>
                  ))}
                </Row>
              ) : plan ? (
                <Label muted>{selected.map((x) => x.name).join(" · ")}</Label>
              ) : null}
              {plan ? (
                <Label muted>
                  O plano tem um valor mensal fechado para as modalidades
                  incluídas.
                </Label>
              ) : individualModalities.length ? (
                <Label muted>
                  Escolha uma ou mais modalidades. Os valores são somados em uma
                  única mensalidade.
                </Label>
              ) : !p.plans.length ? (
                <Notice message="A academia ainda não disponibilizou ofertas para matrícula. Entre em contato para conferir os planos." />
              ) : null}
              {selected.map((x) => {
                const rank = ranks[x.id] ?? {
                  belt: x.belt_options?.[0]?.label ?? "",
                  degrees: 0,
                };
                return (
                  <View key={x.id} style={{ gap: 10 }}>
                    <Heading>{x.name}</Heading>
                    <BeltPicker
                      modality={x.name}
                      options={x.belt_options ?? []}
                      value={rank.belt}
                      degrees={rank.degrees}
                      onChange={(belt) =>
                        setRanks({ ...ranks, [x.id]: { belt, degrees: 0 } })
                      }
                    />
                    {x.belt_options?.length ? (
                      <DegreePicker
                        modality={x.name}
                        value={rank.degrees}
                        onChange={(degrees) =>
                          setRanks({ ...ranks, [x.id]: { ...rank, degrees } })
                        }
                      />
                    ) : null}
                  </View>
                );
              })}
              {selected.length && amount > 0 ? (
                <>
                  <Label muted>
                    {plan
                      ? "Valor mensal do plano"
                      : "Mensalidade total das modalidades escolhidas"}
                  </Label>
                  <Heading>{money(amount)} por mês</Heading>
                </>
              ) : (
                <Label muted>
                  {individualModalities.length
                    ? "Selecione um plano ou as modalidades para ver o valor da mensalidade."
                    : "Selecione um plano para ver o valor da mensalidade."}
                </Label>
              )}
              <DueDayPicker value={dueDay} onChange={setDueDay} />
              <Label muted>
                Escolha o dia que você já costuma pagar ou o que combinou com a
                academia.
              </Label>
              {dueDay ? (
                duePreview.isPending ? (
                  <Label muted>Conferindo o primeiro vencimento…</Label>
                ) : duePreview.error ? (
                  <>
                    <Notice message={duePreview.error.message} />
                    <Button
                      compact
                      secondary
                      onPress={() => duePreview.refetch()}
                    >
                      Conferir vencimento novamente
                    </Button>
                  </>
                ) : (
                  <Label>Primeiro vencimento: {formatBirth(firstDue)}</Label>
                )
              ) : null}
            </>
          ) : (
            <>
              <Heading>{name}</Heading>
              <Label>
                {minor
                  ? "Aluno menor de idade · responsável: " +
                    (session?.kind === "user" ? session.user.name : "")
                  : "Matrícula em seu nome"}
              </Label>
              <Label>
                {selectedPlan?.name ?? selected.map((x) => x.name).join(" + ")}
              </Label>
              <Heading>{money(amount)} por mês</Heading>
              <Label>Primeiro vencimento: {formatBirth(firstDue)}</Label>
              <Label muted>
                Depois, todo dia {dueDay} (ou último dia do mês). O cadastro não
                gera pagamento automático. Você escolherá quando abrir o
                checkout.
              </Label>
              <Notice message="Se já houver cadastro com este CPF, a gestora revisará o acesso. O plano e a cobrança existentes serão preservados." />
            </>
          )
        }
      </FormWizard>
    </Card>
  );
}
