import { useState } from "react";
import { Pressable, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AcademyShell, RoleGate } from "../shared/AcademyShell";
import {
  Card,
  Heading,
  Label,
  Button,
  Notice,
  Field,
  Chip,
  Row,
  Loading,
} from "../../components/ui";
import { FormWizard } from "../../components/FormWizard";
import { BeltSwatch } from "../../components/BeltPicker";
import { api, academyPath } from "../../services/api";
import { queryClient, useSession } from "../../services/session";
import { BeltOption, Catalog, money, parseMoney } from "../../types/billing";
import {
  bjjBelts,
  bjjAdultBelts,
  bjjKidsBelts,
  beltPalette,
} from "../../types/graduation";
import { colors } from "../../theme";

function Editor({
  initial,
  plans,
  modalities,
  onDone,
}: {
  initial?: Catalog;
  plans: boolean;
  modalities: Catalog[];
  onDone: () => void;
}) {
  const { academy } = useSession();
  const [name, setName] = useState(initial?.name ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [amount, setAmount] = useState(
    ((initial?.amount_cents ?? 0) / 100).toFixed(2),
  );
  const [mods, setMods] = useState(initial?.modality_ids ?? []);
  const [belts, setBelts] = useState<BeltOption[]>(initial?.belt_options ?? []);
  const [custom, setCustom] = useState(false);
  const [showBelts, setShowBelts] = useState(false);
  const [beltName, setBeltName] = useState("");
  const [firstColor, setFirstColor] = useState("#F5F5F5");
  const [secondColor, setSecondColor] = useState("");
  const [beltError, setBeltError] = useState("");
  const steps = plans
    ? ["Identificação", "Modalidades e valor", "Revisão"]
    : ["Identificação", "Valor por modalidade", "Graduações", "Revisão"];
  const save = useMutation({
    mutationFn: () =>
      api(
        academyPath(
          academy!.id,
          (plans ? "/plans" : "/modalities") +
            (initial ? "/" + initial.id : ""),
        ),
        {
          method: initial ? "PATCH" : "POST",
          body: {
            name,
            active,
            amount_cents: parseMoney(amount),
            ...(plans ? { modality_ids: mods } : { belt_options: belts }),
          },
        },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      onDone();
    },
  });
  function preset(options: BeltOption[]) {
    setBelts(options);
    setCustom(false);
    setShowBelts(false);
    setBeltError("");
  }
  function addBelt() {
    const label = beltName.trim();
    if (
      !label ||
      label.length > 50 ||
      belts.some(
        (b) => b.label.toLocaleLowerCase() === label.toLocaleLowerCase(),
      )
    ) {
      setBeltError("Use um nome único, com até 50 caracteres.");
      return;
    }
    if (belts.length >= 30) {
      setBeltError("O limite é de 30 graduações.");
      return;
    }
    setBelts((old) => [
      ...old,
      { label, colors: secondColor ? [firstColor, secondColor] : [firstColor] },
    ]);
    setBeltName("");
    setBeltError("");
    setShowBelts(true);
  }
  function validate(step: number): string | undefined {
    if (step === 0 && (name.trim().length < 2 || name.trim().length > 100))
      return "Informe um nome com 2 a 100 caracteres.";
    if (step === 1) {
      const cents = parseMoney(amount);
      if (cents > 100000000 || (plans && cents <= 0))
        return "Informe um valor mensal válido.";
      if (plans && !mods.length)
        return "Selecione as modalidades incluídas no plano.";
    }
  }
  return (
    <FormWizard
      steps={steps}
      validate={validate}
      onSubmit={() => save.mutate()}
      onCancel={onDone}
      pending={save.isPending}
      error={save.error?.message}
      submitLabel={
        initial
          ? "Salvar alterações"
          : plans
            ? "Criar plano"
            : "Criar modalidade"
      }
    >
      {(step) => (
        <>
          {step === 0 ? (
            <Card>
              <Field
                label={plans ? "Nome do plano" : "Nome da modalidade"}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
              <Row>
                <Chip selected={active} onPress={() => setActive(true)}>
                  Ativo
                </Chip>
                <Chip selected={!active} onPress={() => setActive(false)}>
                  Inativo
                </Chip>
              </Row>
            </Card>
          ) : null}
          {step === 1 ? (
            <Card>
              {plans ? (
                <>
                  <Heading>Modalidades incluídas</Heading>
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
                        </Chip>
                      ))}
                  </Row>
                </>
              ) : null}
              <Field
                label={
                  plans
                    ? "Valor mensal do plano (R$)"
                    : "Mensalidade avulsa (R$)"
                }
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
              <Label muted>
                {plans
                  ? "Este valor preenche a mensalidade quando o aluno escolhe o plano."
                  : "Este valor será sugerido quando o aluno contratar por modalidade. Zero permite definir o valor individual no cadastro."}
              </Label>
            </Card>
          ) : null}
          {!plans && step === 2 ? (
            <>
              <Card>
                <Heading>Sistema de graduação</Heading>
                <Label muted>
                  Escolha um modelo ou configure as faixas usadas nesta
                  modalidade. Jiu-Jitsu e No-Gi podem ter graduações
                  independentes.
                </Label>
                <Row>
                  <Chip onPress={() => preset(bjjAdultBelts)}>
                    Jiu-Jitsu adulto
                  </Chip>
                  <Chip onPress={() => preset(bjjKidsBelts)}>
                    Jiu-Jitsu infantil
                  </Chip>
                  <Chip onPress={() => preset(bjjBelts)}>
                    Jiu-Jitsu completo
                  </Chip>
                  <Chip
                    selected={!belts.length && !custom}
                    onPress={() => preset([])}
                  >
                    Sem faixas
                  </Chip>
                  <Chip selected={custom} onPress={() => setCustom(true)}>
                    Personalizar
                  </Chip>
                </Row>
                <Label>
                  {belts.length
                    ? belts.length + " graduações configuradas"
                    : "Esta modalidade não utiliza faixas."}
                </Label>
                {belts.length ? (
                  <Button secondary onPress={() => setShowBelts(!showBelts)}>
                    {showBelts ? "Recolher faixas" : "Ver faixas configuradas"}
                  </Button>
                ) : null}
              </Card>
              {showBelts ? (
                <Card>
                  {belts.map((b, index) => (
                    <View
                      key={b.label}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <BeltSwatch colors={b.colors} />
                      <View style={{ flex: 1 }}>
                        <Label>{b.label}</Label>
                      </View>
                      <Button
                        compact
                        secondary
                        onPress={() =>
                          setBelts((old) => old.filter((_, i) => i !== index))
                        }
                      >
                        Remover
                      </Button>
                    </View>
                  ))}
                </Card>
              ) : null}
              {custom ? (
                <Card>
                  <Heading>Adicionar graduação</Heading>
                  <Field
                    label="Nome da graduação"
                    value={beltName}
                    onChangeText={setBeltName}
                    placeholder="Ex.: Prajied branco"
                  />
                  <Label>Cor principal</Label>
                  <Row>
                    {beltPalette.map((c) => (
                      <Pressable
                        key={c.name}
                        accessibilityRole="button"
                        accessibilityLabel={"Cor principal " + c.name}
                        accessibilityState={{
                          selected: firstColor === c.color,
                        }}
                        onPress={() => setFirstColor(c.color)}
                        style={{
                          borderWidth: 2,
                          borderColor:
                            firstColor === c.color
                              ? colors.text
                              : colors.border,
                          borderRadius: 8,
                          padding: 8,
                          minHeight: 44,
                          justifyContent: "center",
                        }}
                      >
                        <View
                          style={{
                            width: 24,
                            height: 18,
                            backgroundColor: c.color,
                            borderWidth: 1,
                            borderColor: "#777",
                          }}
                        />
                      </Pressable>
                    ))}
                  </Row>
                  <Label>Cor secundária</Label>
                  <Row>
                    <Chip
                      selected={!secondColor}
                      onPress={() => setSecondColor("")}
                    >
                      Sem segunda cor
                    </Chip>
                    {beltPalette.map((c) => (
                      <Pressable
                        key={c.name}
                        accessibilityRole="button"
                        accessibilityLabel={"Cor secundária " + c.name}
                        accessibilityState={{
                          selected: secondColor === c.color,
                        }}
                        onPress={() => setSecondColor(c.color)}
                        style={{
                          borderWidth: 2,
                          borderColor:
                            secondColor === c.color
                              ? colors.text
                              : colors.border,
                          borderRadius: 8,
                          padding: 8,
                          minHeight: 44,
                          justifyContent: "center",
                        }}
                      >
                        <View
                          style={{
                            width: 24,
                            height: 18,
                            backgroundColor: c.color,
                            borderWidth: 1,
                            borderColor: "#777",
                          }}
                        />
                      </Pressable>
                    ))}
                  </Row>
                  <Notice message={beltError} />
                  <Button secondary onPress={addBelt}>
                    Adicionar graduação à lista
                  </Button>
                </Card>
              ) : null}
            </>
          ) : null}
          {step === steps.length - 1 ? (
            <>
              <Card>
                <Heading>{name}</Heading>
                <Label muted>{active ? "Ativo" : "Inativo"}</Label>
                <Heading>{money(parseMoney(amount))}/mês</Heading>
                {plans ? (
                  mods.map((id) => (
                    <Label key={id}>
                      {modalities.find((m) => m.id === id)?.name}
                    </Label>
                  ))
                ) : (
                  <Label>
                    {belts.length
                      ? belts.length + " graduações disponíveis para seleção"
                      : "Sem sistema de faixas"}
                  </Label>
                )}
              </Card>
              <Label muted>
                As mensalidades já emitidas e os valores combinados com os
                alunos serão preservados.
              </Label>
            </>
          ) : null}
        </>
      )}
    </FormWizard>
  );
}

function Content() {
  const { academy } = useSession();
  const a = academy!;
  const [plans, setPlans] = useState(false);
  const [editing, setEditing] = useState<Catalog | null | undefined>(undefined);
  const mods = useQuery({
    queryKey: ["modalities", a.id],
    queryFn: () => api<Catalog[]>(academyPath(a.id, "/modalities")),
  });
  const listPlans = useQuery({
    queryKey: ["plans", a.id],
    queryFn: () => api<Catalog[]>(academyPath(a.id, "/plans")),
  });
  const list = plans ? listPlans : mods;
  if (mods.data?.some((m) => typeof m.amount_cents !== "number"))
    return (
      <AcademyShell title="Modalidades e planos">
        <Notice message="Cadastro por etapas aguardando atualização da API." />
      </AcademyShell>
    );
  return (
    <AcademyShell
      title={
        editing !== undefined
          ? (editing ? "Editar " : plans ? "Novo " : "Nova ") +
            (plans ? "plano" : "modalidade")
          : "Modalidades e planos"
      }
    >
      {editing !== undefined ? (
        <Editor
          key={String(plans) + (editing?.id ?? "new")}
          initial={editing ?? undefined}
          plans={plans}
          modalities={mods.data ?? []}
          onDone={() => setEditing(undefined)}
        />
      ) : (
        <>
          <Row>
            <Chip selected={!plans} onPress={() => setPlans(false)}>
              Modalidades
            </Chip>
            <Chip selected={plans} onPress={() => setPlans(true)}>
              Planos
            </Chip>
          </Row>
          <Button icon="plus" onPress={() => setEditing(null)}>
            Adicionar {plans ? "plano" : "modalidade"}
          </Button>
          {list.isPending ? (
            <Loading />
          ) : list.error ? (
            <Notice message={list.error.message} />
          ) : (
            list.data?.map((c) => (
              <Card key={c.id}>
                <Heading>{c.name}</Heading>
                <Label muted>
                  {c.active ? "Ativo" : "Inativo"} •{" "}
                  {money(c.amount_cents ?? 0)}/mês
                </Label>
                {!plans ? (
                  <Label muted>
                    {c.belt_options?.length
                      ? c.belt_options.length + " graduações"
                      : "Sem faixas"}
                  </Label>
                ) : null}
                <Button secondary onPress={() => setEditing(c)}>
                  Editar {c.name}
                </Button>
              </Card>
            ))
          )}
        </>
      )}
    </AcademyShell>
  );
}
export default function CatalogScreen() {
  return (
    <RoleGate role="admin">
      <Content />
    </RoleGate>
  );
}
