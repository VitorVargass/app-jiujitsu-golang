import { useState } from "react";
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
import { api, academyPath } from "../../services/api";
import { queryClient, useSession } from "../../services/session";
import { Catalog, money, parseMoney } from "../../types/billing";
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
    initial?.amount_cents ? String(initial.amount_cents / 100) : "",
  );
  const [mods, setMods] = useState(initial?.modality_ids ?? []);
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
            ...(plans
              ? { amount_cents: parseMoney(amount), modality_ids: mods }
              : {}),
          },
        },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      onDone();
    },
  });
  return (
    <Card>
      <Heading>
        {initial ? "Editar" : "Adicionar"} {plans ? "plano" : "modalidade"}
      </Heading>
      <Field label="Nome" value={name} onChangeText={setName} />
      <Chip selected={active} onPress={() => setActive(!active)}>
        {active ? "Ativo" : "Inativo"}
      </Chip>
      {plans ? (
        <>
          <Field
            label="Valor mensal sugerido (R$)"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          <Label>Modalidades incluídas</Label>
          <Row>
            {modalities.map((m) => (
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
        </>
      ) : null}
      <Notice message={save.error?.message} />
      <Button loading={save.isPending} onPress={() => save.mutate()}>
        Salvar
      </Button>
      <Button secondary onPress={onDone}>
        Fechar
      </Button>
    </Card>
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
  return (
    <AcademyShell title="Modalidades e planos">
      <Row>
        <Chip
          selected={!plans}
          onPress={() => {
            setPlans(false);
            setEditing(undefined);
          }}
        >
          Modalidades
        </Chip>
        <Chip
          selected={plans}
          onPress={() => {
            setPlans(true);
            setEditing(undefined);
          }}
        >
          Planos
        </Chip>
      </Row>
      <Button onPress={() => setEditing(null)}>
        Adicionar {plans ? "plano" : "modalidade"}
      </Button>
      {editing !== undefined ? (
        <Editor
          key={String(plans) + (editing?.id ?? "new")}
          initial={editing ?? undefined}
          plans={plans}
          modalities={mods.data ?? []}
          onDone={() => setEditing(undefined)}
        />
      ) : null}
      {list.isPending ? (
        <Loading />
      ) : list.error ? (
        <Notice message={list.error.message} />
      ) : (
        list.data?.map((c) => (
          <Card key={c.id}>
            <Heading>{c.name}</Heading>
            <Label muted>
              {c.active ? "Ativo" : "Inativo"}
              {plans ? " • " + money(c.amount_cents ?? 0) : ""}
            </Label>
            <Button secondary onPress={() => setEditing(c)}>
              Editar
            </Button>
          </Card>
        ))
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
