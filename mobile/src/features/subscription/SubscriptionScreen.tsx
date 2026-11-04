import { useEffect, useRef, useState } from "react";
import { AccessRecovery } from "../../components/AccessRecovery";
import { View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AcademyShell, RoleGate } from "../shared/AcademyShell";
import {
  Page,
  Button,
  Card,
  Heading,
  Label,
  Loading,
  Notice,
  Row,
} from "../../components/ui";
import { ResponsiveGrid } from "../../components/ResponsiveGrid";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Pagination } from "../../components/Pagination";
import { api, academyPath } from "../../services/api";
import { queryClient, useSession } from "../../services/session";
import { beginInvoiceCheckout } from "../../services/checkout-flow";
import { openPaymentURL } from "../../services/open-payment";
import type { Checkout, Page as ResultPage } from "../../types/billing";
import { money } from "../../types/billing";
import {
  Subscription,
  SubscriptionCycle,
  subscriptionDate,
  subscriptionLabel,
  planRange,
} from "./types";

function Content({
  event,
}: {
  event?: { order_nsu: string; transaction_nsu: string; slug: string };
}) {
  const { academy } = useSession();
  const a = academy!.id;
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<Checkout>();
  const returned = useRef("");
  const status = useQuery({
    queryKey: ["subscription", a],
    queryFn: () => api<Subscription>(academyPath(a, "/subscription")),
    refetchInterval: 30000,
  });
  const history = useQuery({
    queryKey: ["subscription-history", a, page],
    queryFn: () =>
      api<ResultPage<SubscriptionCycle>>(
        academyPath(a, "/subscription/history?page=" + page),
      ),
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["subscription", a] });
    void queryClient.invalidateQueries({
      queryKey: ["subscription-history", a],
    });
  };
  const pay = useMutation({
    mutationFn: () =>
      beginInvoiceCheckout(
        () =>
          api<Checkout>(academyPath(a, "/subscription/checkout"), {
            method: "POST",
            body: { cycle_id: status.data?.cycle?.id },
          }),
        openPaymentURL,
      ),
    onSuccess: (v) => {
      setResult(v);
      refresh();
    },
  });
  const check = useMutation({
    mutationFn: (callback?: typeof event) =>
      api<Checkout>(academyPath(a, "/subscription/payment-check"), {
        method: "POST",
        body: {
          attempt_id: callback ? "" : status.data?.checkout?.id,
          event: callback || {},
        },
      }),
    onSuccess: (v) => {
      setResult(v);
      refresh();
    },
  });
  const { mutate: verifyReturn } = check;
  useEffect(() => {
    if (!event || returned.current === event.order_nsu) return;
    returned.current = event.order_nsu;
    verifyReturn(event);
  }, [event, verifyReturn]);
  const renewal = useMutation({
    mutationFn: (enabled: boolean) =>
      api<Subscription>(academyPath(a, "/subscription"), {
        method: "PATCH",
        body: { enabled },
      }),
    onSuccess: (v) => {
      queryClient.setQueryData(["subscription", a], v);
      setConfirm(false);
      refresh();
    },
  });
  const v = status.data;
  const checkout = result || v?.checkout;
  return (
    <AcademyShell
      title="Minha assinatura"
      subtitle="Seu acesso ao sistema · separado das mensalidades dos alunos"
      swipeEnabled={false}
    >
      {status.isPending ? (
        <Loading />
      ) : status.error ? (
        <>
          <Notice message={status.error.message} />
          <Button onPress={() => void status.refetch()}>
            Tentar novamente
          </Button>
        </>
      ) : v ? (
        <>
          <ResponsiveGrid>
            <Card>
              <Label muted>Enquadramento atual</Label>
              <Label>{v.plan?.name ?? "PLANO MENSAL"}</Label>
              <Heading>{money(v.amount_cents)} / mês</Heading>
              {v.active_students !== undefined ? (
                <Label>
                  {v.active_students.toLocaleString("pt-BR")} alunos ativos e
                  não arquivados
                </Label>
              ) : null}
              {v.plan ? <Label muted>{planRange(v.plan)}</Label> : null}
              {v.cycle && v.cycle.amount_cents !== v.amount_cents ? (
                <Notice
                  message={`A cobrança deste período permanece em ${money(v.cycle.amount_cents)} porque já teve uma emissão. O novo enquadramento será considerado no próximo período sem checkout emitido.`}
                />
              ) : null}
              {v.plan?.max_students &&
              v.active_students !== undefined &&
              v.active_students >= Math.ceil(v.plan.max_students * 0.9) ? (
                <Label>
                  Você está próximo da próxima faixa. O valor é recalculado
                  antes da emissão de uma nova cobrança, sem alterar o período
                  pago.
                </Label>
              ) : null}
              <Label>{subscriptionLabel[v.status]}</Label>
              <Label>
                {v.status === "active" ? "Acesso pago até " : "Vencimento: "}
                {subscriptionDate(v.paid_until)}
              </Label>
              {v.status === "grace" ? (
                <Label>
                  Prazo de tolerância até {subscriptionDate(v.grace_until)}.
                </Label>
              ) : null}
              <Label>
                Uma assinatura por academia, compartilhada por todos os
                gestores.
              </Label>
            </Card>
            <Card>
              <Heading>Pagamento</Heading>
              <Label>
                Você paga à TatameMix. As mensalidades dos seus alunos continuam
                sendo recebidas pela academia.
              </Label>
              {!v.enabled ? (
                <Label>
                  A equipe TatameMix ainda precisa habilitar a cobrança no
                  servidor. Nenhum pagamento foi gerado.
                </Label>
              ) : (
                <>
                  <Label>
                    Pix ou cartão no checkout seguro da InfinitePay. Pagamento
                    mensal, sem débito automático nesta versão.
                  </Label>
                  {v.restricted ? (
                    <Notice message="Novas operações estão restritas. Pague para liberar; seus dados e consultas permanecem disponíveis." />
                  ) : null}
                  {checkout?.status === "review" ? (
                    <Notice
                      message={
                        checkout.review_reason ||
                        "Pagamento em conferência. Não gere outro link; procure o suporte TatameMix."
                      }
                    />
                  ) : null}
                  {checkout?.status === "paid" ? (
                    <Notice
                      success
                      message="Pagamento confirmado. Seu período de acesso foi atualizado."
                    />
                  ) : null}
                  <Notice
                    message={
                      pay.error?.message ||
                      check.error?.message ||
                      renewal.error?.message
                    }
                  />
                  <Row>
                    {v.renewal_enabled && v.cycle ? (
                      <Button
                        icon="wallet"
                        loading={pay.isPending}
                        disabled={
                          check.isPending ||
                          (v.checkout?.status === "review" &&
                            !v.checkout.retryable)
                        }
                        onPress={() => pay.mutate()}
                      >
                        {v.checkout?.url
                          ? "Continuar pagamento"
                          : `${v.status === "active" ? "Renovar por" : "Pagar"} ${money(v.cycle.amount_cents)}`}
                      </Button>
                    ) : null}
                    {v.checkout?.id ? (
                      <Button
                        secondary
                        loading={check.isPending}
                        onPress={() => check.mutate(undefined)}
                      >
                        Conferir pagamento
                      </Button>
                    ) : null}
                    {!v.renewal_enabled ? (
                      <Button
                        loading={renewal.isPending}
                        onPress={() => renewal.mutate(true)}
                      >
                        Retomar assinatura
                      </Button>
                    ) : null}
                  </Row>
                  {v.renewal_enabled ? (
                    <Button secondary compact onPress={() => setConfirm(true)}>
                      Encerrar ao fim do período pago
                    </Button>
                  ) : null}
                </>
              )}
            </Card>
          </ResponsiveGrid>
          <Card>
            <Heading>Planos TatameMix</Heading>
            <Label muted>
              Mesmas funcionalidades. A faixa considera somente alunos ativos,
              sem contar alunos arquivados ou acessos sem matrícula. Mudanças
              não alteram pagamentos e links já emitidos.
            </Label>
            {(v.plans ?? []).map((plan) => (
              <View key={plan.id} style={{ gap: 6, paddingVertical: 12 }}>
                <Heading>
                  {plan.name}
                  {v.plan?.id === plan.id ? " · Seu enquadramento" : ""}
                </Heading>
                <Label>{planRange(plan)}</Label>
                <Label>{money(plan.amount_cents)} / mês</Label>
              </View>
            ))}
          </Card>
          <Card>
            <Heading>Histórico da assinatura</Heading>
            {history.isPending ? (
              <Loading />
            ) : history.error ? (
              <>
                <Notice message={history.error.message} />
                <Button secondary onPress={() => void history.refetch()}>
                  Recarregar histórico
                </Button>
              </>
            ) : (
              <>
                {!history.data?.items.length ? (
                  <Label>Nenhum período registrado.</Label>
                ) : (
                  history.data.items.map((c) => (
                    <View key={c.id} style={{ gap: 4, paddingVertical: 12 }}>
                      <Row>
                        <Label>
                          {subscriptionDate(c.period_start)} →{" "}
                          {subscriptionDate(c.period_end)}
                        </Label>
                        <Heading>{money(c.amount_cents)}</Heading>
                      </Row>
                      {c.plan_id ? (
                        <Label muted>
                          {v.plans?.find((plan) => plan.id === c.plan_id)
                            ?.name ?? "Plano anterior"}
                          {c.active_students != null
                            ? ` · ${c.active_students.toLocaleString("pt-BR")} alunos ativos na emissão`
                            : ""}
                        </Label>
                      ) : null}
                      <Label>
                        {c.state === "paid"
                          ? "Pago em " + subscriptionDate(c.paid_at)
                          : c.checkout_state === "review" ||
                              c.checkout_state === "uncertain"
                            ? "Pagamento em conferência"
                            : "Aguardando pagamento"}
                      </Label>
                      {c.review_reason ? (
                        <Notice message={c.review_reason} />
                      ) : null}
                    </View>
                  ))
                )}
                <Pagination
                  page={page}
                  total={history.data?.total || 0}
                  onChange={setPage}
                />
              </>
            )}
          </Card>
          <Label>
            Para suporte ou pagamento em conferência, contate a equipe
            TatameMix. A confirmação depende da consulta ao provedor, não apenas
            do retorno do navegador.
          </Label>
          <ConfirmDialog
            visible={confirm}
            title="Encerrar assinatura?"
            message={
              "O acesso permanece até " +
              subscriptionDate(v.paid_until) +
              ". Depois, novas operações serão restritas. Links já emitidos podem continuar pagáveis; não haverá estorno automático."
            }
            confirmLabel="Encerrar ao fim do período"
            pending={renewal.isPending}
            error={renewal.error?.message}
            onCancel={() => setConfirm(false)}
            onConfirm={() => renewal.mutate(false)}
          />
        </>
      ) : null}
    </AcademyShell>
  );
}
export default function SubscriptionScreen() {
  const params = useLocalSearchParams<{
    academy_id?: string;
    order_nsu?: string;
    transaction_nsu?: string;
    slug?: string;
  }>();
  const {
    ready,
    session,
    academy,
    role,
    academies,
    academiesLoading,
    academiesError,
    reloadAcademies,
    select,
  } = useSession();
  const target =
    params.academy_id &&
    academies.find(
      (a) =>
        a.id === params.academy_id &&
        a.status === "active" &&
        a.roles.includes("admin"),
    );
  const atTarget =
    !params.academy_id ||
    (!!target && academy?.id === target.id && role === "admin");
  useEffect(() => {
    if (target && !atTarget) select(target, "admin");
  }, [target, atTarget, select]);
  const event =
    typeof params.order_nsu === "string" &&
    typeof params.transaction_nsu === "string" &&
    typeof params.slug === "string"
      ? {
          order_nsu: params.order_nsu,
          transaction_nsu: params.transaction_nsu,
          slug: params.slug,
        }
      : undefined;
  const search = new URLSearchParams();
  if (typeof params.academy_id === "string")
    search.set("academy_id", params.academy_id);
  if (event)
    Object.entries(event).forEach(([k, value]) => search.set(k, value));
  const next = "/subscription" + (search.size ? "?" + search.toString() : "");
  if (!ready || (session?.kind === "user" && academiesLoading))
    return (
      <Page>
        <Loading />
      </Page>
    );
  if (!session)
    return <Redirect href={{ pathname: "/login", params: { next } }} />;
  if (session.kind === "device") return <Redirect href="/kiosk" />;
  if (academiesError)
    return (
      <Page>
        <Notice message={academiesError.message} />
        <Button onPress={reloadAcademies}>Tentar novamente</Button>
        <AccessRecovery next={next} />
      </Page>
    );
  if (params.academy_id && !target)
    return (
      <Page title="Assinatura TatameMix">
        <Notice message="Esta conta não administra a academia desta cobrança." />
        <AccessRecovery next={next} />
      </Page>
    );
  if (!atTarget)
    return (
      <Page>
        <Loading />
      </Page>
    );
  return (
    <RoleGate role="admin">
      <Content key={academy?.id} event={event} />
    </RoleGate>
  );
}
