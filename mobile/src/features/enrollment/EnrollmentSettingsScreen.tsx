import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { AcademyShell, RoleGate } from "../shared/AcademyShell";
import {
  Button,
  Card,
  Badge,
  Heading,
  Label,
  Loading,
  Notice,
  IconButton,
} from "../../components/ui";
import { Icon, IconName } from "../../components/Icon";
import { EditorDialog } from "../../components/EditorDialog";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Pagination } from "../../components/Pagination";
import { ResponsiveGrid } from "../../components/ResponsiveGrid";
import { api, academyPath } from "../../services/api";
import { portalLink } from "../../services/links";
import { useSession, queryClient } from "../../services/session";
import { colors, accents } from "../../theme";
import type { Catalog, Page } from "../../types/billing";
import { money } from "../../types/billing";
import { formatBirth } from "../../types/age";
import type { EnrollmentRequest, LinkSettings } from "./types";

type Section = "link" | "requests" | "access";
const sections: { id: Section; label: string; icon: IconName }[] = [
  { id: "link", label: "Link", icon: "mail" },
  { id: "requests", label: "Solicitações", icon: "users" },
  { id: "access", label: "Acessos", icon: "lock" },
];
export default function EnrollmentSettingsScreen() {
  return (
    <RoleGate role="admin">
      <Content />
    </RoleGate>
  );
}
function Content() {
  const { academy } = useSession();
  const a = academy!;
  const [section, setSection] = useState<Section>("link");
  const config = useQuery({
    queryKey: ["enrollment-link", a.id],
    queryFn: () => api<LinkSettings>(academyPath(a.id, "/enrollment-link")),
  });
  const modalities = useQuery({
    queryKey: ["modalities", a.id],
    queryFn: () => api<Catalog[]>(academyPath(a.id, "/modalities")),
  });
  const plans = useQuery({
    queryKey: ["plans", a.id],
    queryFn: () => api<Catalog[]>(academyPath(a.id, "/plans")),
  });
  const error = config.error ?? modalities.error ?? plans.error;
  return (
    <AcademyShell
      title="Matrículas"
      subtitle="Convide seus alunos e organize os acessos da academia."
    >
      <View
        style={s.tabs}
        role="tablist"
        accessibilityLabel="Seções de matrículas"
      >
        {sections.map((x) => (
          <Pressable
            key={x.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: section === x.id }}
            onPress={() => setSection(x.id)}
            style={[s.tab, section === x.id && s.selectedTab]}
          >
            <Icon
              name={x.icon}
              size={18}
              color={section === x.id ? colors.text : colors.muted}
            />
            <Text
              style={[s.tabText, section === x.id && { color: colors.text }]}
            >
              {x.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={section !== "link" ? { display: "none" } : undefined}>
        {config.isPending || modalities.isPending || plans.isPending ? (
          <Loading />
        ) : error ? (
          <Card>
            <Notice message={error.message} />
            <Button
              compact
              secondary
              onPress={() => {
                void config.refetch();
                void modalities.refetch();
                void plans.refetch();
              }}
            >
              Tentar novamente
            </Button>
          </Card>
        ) : config.data ? (
          <SettingsForm
            key={"settings:" + a.id}
            initial={config.data}
            modalities={modalities.data ?? []}
            plans={plans.data ?? []}
          />
        ) : null}
      </View>
      {section === "requests" ? (
        <ReviewRequests key={"requests:" + a.id} />
      ) : null}
      {section === "access" ? <PortalAccess key={"access:" + a.id} /> : null}
    </AcademyShell>
  );
}
function SettingsForm({
  initial,
  modalities,
  plans,
}: {
  initial: LinkSettings;
  modalities: Catalog[];
  plans: Catalog[];
}) {
  const { academy } = useSession();
  const a = academy!;
  const { isCompact } = useResponsiveLayout();
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [editor, setEditor] = useState(false);
  const [menu, setMenu] = useState(false);
  const [rotate, setRotate] = useState(false);
  const [message, setMessage] = useState("");
  const save = useMutation({
    mutationFn: ({
      draft,
      regenerate = false,
    }: {
      draft: LinkSettings;
      regenerate?: boolean;
    }) =>
      api<LinkSettings>(academyPath(a.id, "/enrollment-link"), {
        method: "PUT",
        body: {
          enabled: draft.enabled,
          due_day: draft.due_day,
          modality_ids: draft.modality_ids,
          plan_ids: draft.plan_ids,
          rotate: regenerate,
        },
      }),
    onSuccess: (data) => {
      setSaved(data);
      setValue(data);
      setEditor(false);
      setRotate(false);
      setMessage("Configuração atualizada.");
      void queryClient.invalidateQueries({
        queryKey: ["enrollment-link", a.id],
      });
    },
  });
  const copy = useMutation({
    mutationFn: async () => {
      if (
        !saved.token ||
        !(await Clipboard.setStringAsync(portalLink("/enroll/" + saved.token)))
      )
        throw new Error("Não foi possível copiar o link.");
      setMessage("Link copiado. Pode enviar para seus alunos.");
    },
  });
  const published = [
    ...plans.filter((x) => saved.plan_ids.includes(x.id)),
    ...modalities.filter((x) => saved.modality_ids.includes(x.id)),
  ];
  function edit() {
    setValue(saved);
    save.reset();
    setEditor(true);
  }
  function toggle(kind: "modality_ids" | "plan_ids", id: string) {
    setValue({
      ...value,
      [kind]: value[kind].includes(id)
        ? value[kind].filter((x) => x !== id)
        : [...value[kind], id],
    });
  }
  return (
    <View style={{ gap: 20 }}>
      <Card style={s.hero}>
        <View style={s.header}>
          <View style={s.symbol}>
            <Icon name="mail" color={colors.primaryLight} size={25} />
          </View>
          <View style={s.grow}>
            <Text style={s.eyebrow}>MATRÍCULA ONLINE</Text>
            <Text style={s.heroTitle}>
              {isCompact
                ? "Seu link de matrícula"
                : "Um link para todos os alunos."}
            </Text>
          </View>
          {saved.token ? (
            <IconButton
              icon="more"
              label="Mais opções do link"
              onPress={() => {
                save.reset();
                setMenu(true);
              }}
            />
          ) : null}
        </View>
        <Label muted>
          Envie no grupo da academia. Cada pessoa cria sua conta, escolhe o
          plano e conclui a matrícula.
        </Label>
        <View style={s.statusLine}>
          <Badge
            label={
              !saved.token
                ? "Ainda não publicado"
                : saved.enabled
                  ? "Aceitando matrículas"
                  : "Matrículas suspensas"
            }
            tone={!saved.token ? "slate" : saved.enabled ? "mint" : "amber"}
          />
        </View>
        {saved.token ? (
          <View style={s.linkBox}>
            <Icon name="mail" size={18} color={colors.muted} />
            <Text numberOfLines={1} selectable style={s.linkText}>
              {portalLink("/enroll/" + saved.token)}
            </Text>
          </View>
        ) : null}
        <View style={s.actions}>
          <View style={s.primaryAction}>
            <Button
              icon={saved.token ? "mail" : "plus"}
              loading={copy.isPending}
              onPress={saved.token ? () => copy.mutate() : edit}
            >
              {saved.token ? "Copiar link de matrícula" : "Configurar meu link"}
            </Button>
          </View>
          {saved.token ? (
            <Button
              secondary
              icon="sliders"
              disabled={save.isPending}
              onPress={edit}
            >
              Configurar
            </Button>
          ) : null}
        </View>
        <Notice success message={message} />
        <Notice
          message={
            copy.error?.message ??
            (!editor && !rotate ? save.error?.message : undefined)
          }
        />
      </Card>
      <ResponsiveGrid>
        <Card>
          <View style={s.header}>
            <Icon name="wallet" color={accents.blue.color} />
            <Heading>Ofertas no seu link</Heading>
          </View>
          {published.length ? (
            <View style={s.tags}>
              {published.map((x) => (
                <View key={x.id} style={s.offerTag}>
                  <Text style={s.small}>{x.name}</Text>
                  <Text style={s.muted}>{money(x.amount_cents ?? 0)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Label muted>
              Escolha os planos e as modalidades que os alunos poderão
              contratar.
            </Label>
          )}
        </Card>
        <Card>
          <View style={s.header}>
            <Icon name="calendar" color={accents.amber.color} />
            <Heading>Dia de vencimento</Heading>
          </View>
          <Text style={s.summaryValue}>O aluno escolhe</Text>
          <Label muted>
            Cada aluno escolhe o dia no cadastro. A primeira mensalidade vence
            na próxima data futura escolhida. Você pode ajustar o dia depois no
            cadastro do aluno.
          </Label>
        </Card>
      </ResponsiveGrid>
      <View style={s.hint}>
        <Icon name="lock" size={18} color={colors.muted} />
        <Text style={s.hintText}>
          Um CPF já cadastrado vai para Solicitações. O histórico só é liberado
          depois da sua revisão.
        </Text>
      </View>
      {editor ? (
        <EditorDialog
          title="Configurar link de matrícula"
          wide
          pending={save.isPending}
          onClose={() => setEditor(false)}
          footer={
            <>
              <Button
                compact
                secondary
                disabled={save.isPending}
                onPress={() => setEditor(false)}
              >
                Cancelar
              </Button>
              <Button
                compact
                loading={save.isPending}
                onPress={() => save.mutate({ draft: value })}
              >
                Salvar configuração
              </Button>
            </>
          }
        >
          <Label muted>
            Defina o que aparece para novos alunos. Os cadastros existentes
            continuam como estão.
          </Label>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{
              checked: value.enabled,
              disabled: save.isPending,
            }}
            disabled={save.isPending}
            onPress={() => setValue({ ...value, enabled: !value.enabled })}
            style={s.switchRow}
          >
            <View style={s.grow}>
              <Text style={s.rowTitle}>Aceitar novas matrículas</Text>
              <Text style={s.muted}>
                {value.enabled
                  ? "Alunos podem se cadastrar pelo link"
                  : "O link fica suspenso para novos cadastros"}
              </Text>
            </View>
            <View style={[s.switchTrack, value.enabled && s.switchOn]}>
              <View
                style={[
                  s.switchThumb,
                  value.enabled && { alignSelf: "flex-end" },
                ]}
              />
            </View>
          </Pressable>
          <ResponsiveGrid>
            <View style={{ gap: 12 }}>
              <Heading>Planos e combos</Heading>
              {plans
                .filter((x) => x.active || value.plan_ids.includes(x.id))
                .map((x) => (
                  <Offer
                    key={x.id}
                    item={x}
                    selected={value.plan_ids.includes(x.id)}
                    onPress={() => toggle("plan_ids", x.id)}
                  />
                ))}
              {!plans.length ? (
                <Label muted>Nenhum plano cadastrado.</Label>
              ) : null}
            </View>
            <View style={{ gap: 12 }}>
              <Heading>Modalidades avulsas</Heading>
              {modalities
                .filter(
                  (x) =>
                    (x.active && (x.amount_cents ?? 0) > 0) ||
                    value.modality_ids.includes(x.id),
                )
                .map((x) => (
                  <Offer
                    key={x.id}
                    item={x}
                    selected={value.modality_ids.includes(x.id)}
                    onPress={() => toggle("modality_ids", x.id)}
                  />
                ))}
              {!modalities.some((x) => (x.amount_cents ?? 0) > 0) ? (
                <Label muted>
                  Defina os valores das modalidades para publicá-las.
                </Label>
              ) : null}
            </View>
          </ResponsiveGrid>
          <Button
            compact
            secondary
            icon="edit"
            onPress={() => {
              setEditor(false);
              router.push("/catalog");
            }}
          >
            Gerenciar modalidades e planos
          </Button>
          <Notice message={save.error?.message} />
        </EditorDialog>
      ) : null}
      {menu ? (
        <EditorDialog title="Opções do link" onClose={() => setMenu(false)}>
          <Button
            secondary
            compact
            disabled={save.isPending}
            onPress={() => {
              setMenu(false);
              save.mutate({ draft: { ...saved, enabled: !saved.enabled } });
            }}
          >
            {saved.enabled
              ? "Suspender novas matrículas"
              : "Retomar matrículas"}
          </Button>
          <Button
            secondary
            compact
            onPress={() => {
              setMenu(false);
              setRotate(true);
            }}
          >
            Substituir link da academia
          </Button>
          <Label muted>
            Suspender ou substituir o link preserva alunos e pedidos já
            enviados.
          </Label>
        </EditorDialog>
      ) : null}
      <ConfirmDialog
        visible={rotate}
        title="Substituir o link?"
        message="O link anterior deixará de aceitar novas matrículas. Você precisará enviar o novo link aos alunos. Os cadastros e pedidos existentes serão preservados."
        confirmLabel="Gerar novo link"
        pending={save.isPending}
        error={save.error?.message}
        onCancel={() => setRotate(false)}
        onConfirm={() => save.mutate({ draft: saved, regenerate: true })}
      />
    </View>
  );
}
function Offer({
  item,
  selected,
  onPress,
}: {
  item: Catalog;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={item.name + ", " + money(item.amount_cents ?? 0)}
      onPress={onPress}
      style={[s.offer, selected && s.selectedOffer]}
    >
      <View style={[s.check, selected && s.checked]}>
        {selected ? (
          <Icon name="check-circle" size={18} color={colors.onPrimary} />
        ) : null}
      </View>
      <View style={s.grow}>
        <Text style={s.rowTitle}>{item.name}</Text>
        {!item.active ? (
          <Text style={s.muted}>Indisponível · desmarque para remover</Text>
        ) : null}
      </View>
      <Text style={s.price}>{money(item.amount_cents ?? 0)}</Text>
    </Pressable>
  );
}
function EmptySection({ title, message }: { title: string; message: string }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Icon name="check-circle" size={28} color={accents.mint.color} />
      </View>
      <Heading>{title}</Heading>
      <Label muted>{message}</Label>
    </View>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 5 }}>
      <Text style={s.eyebrow}>{label}</Text>
      <Label>{value || "Não informado"}</Label>
    </View>
  );
}
function ReviewRequests() {
  const { academy } = useSession();
  const a = academy!;
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<EnrollmentRequest | null>(null);
  const [decision, setDecision] = useState<{
    request: EnrollmentRequest;
    approve: boolean;
  } | null>(null);
  const list = useQuery({
    queryKey: ["enrollment-requests", a.id, page],
    queryFn: () =>
      api<Page<EnrollmentRequest>>(
        academyPath(a.id, "/enrollment-requests?page=" + page),
      ),
  });
  const decide = useMutation({
    mutationFn: ({
      request,
      approve,
    }: {
      request: EnrollmentRequest;
      approve: boolean;
    }) =>
      api(academyPath(a.id, "/enrollment-requests/" + request.id), {
        method: "PATCH",
        body: { approve },
      }),
    onSuccess: () => {
      setDecision(null);
      void queryClient.invalidateQueries({
        queryKey: ["enrollment-requests", a.id],
      });
      void queryClient.invalidateQueries({ queryKey: ["portal-access", a.id] });
    },
  });
  function review(approve: boolean) {
    if (!selected) return;
    decide.reset();
    setDecision({ request: selected, approve });
    setSelected(null);
  }
  return (
    <Card>
      <View style={s.header}>
        <View style={s.grow}>
          <Heading>Solicitações de acesso</Heading>
          <Text style={s.muted}>
            {list.data?.total ?? 0} aguardando revisão
          </Text>
        </View>
        <IconButton
          icon="swap"
          label="Atualizar solicitações"
          disabled={list.isFetching}
          onPress={() => list.refetch()}
        />
      </View>
      {list.isPending ? (
        <Loading />
      ) : list.error ? (
        <Notice message={list.error.message} />
      ) : !list.data?.items.length ? (
        <EmptySection
          title="Tudo em dia"
          message="Quando alguém pedir acesso a um cadastro existente, você poderá conferir por aqui."
        />
      ) : (
        list.data.items.map((x) => (
          <View key={x.id} style={s.listRow}>
            <View style={s.avatar}>
              <Icon name="users" size={20} color={colors.muted} />
            </View>
            <View style={s.grow}>
              <Text style={s.rowTitle}>{x.student_name}</Text>
              <Text style={s.muted}>
                {x.account_name} · {x.is_minor ? "Responsável" : "Aluno"}
              </Text>
            </View>
            <Button compact secondary onPress={() => setSelected(x)}>
              Revisar
            </Button>
          </View>
        ))
      )}
      {list.data ? (
        <Pagination page={page} total={list.data.total} onChange={setPage} />
      ) : null}
      {selected ? (
        <EditorDialog
          title="Revisar solicitação"
          wide
          onClose={() => setSelected(null)}
          footer={
            <>
              <Button compact secondary onPress={() => review(false)}>
                Recusar
              </Button>
              <Button compact onPress={() => review(true)}>
                Liberar acesso
              </Button>
            </>
          }
        >
          <Heading>{selected.student_name}</Heading>
          <Label muted>
            Confirme a identidade por um contato conhecido antes de liberar. A
            aprovação não muda plano, mensalidades ou dados do cadastro.
          </Label>
          <Card>
            <Heading>Quem está solicitando</Heading>
            <Label>{selected.account_name}</Label>
            <Label muted>{selected.account_email}</Label>
            <Badge
              label={
                selected.is_minor ? "Responsável por menor" : "Próprio aluno"
              }
              tone="blue"
            />
          </Card>
          <ResponsiveGrid>
            <Detail label="NOME INFORMADO" value={selected.payload.name} />
            <Detail
              label="VENCIMENTO SOLICITADO"
              value={
                selected.payload.due_day
                  ? "Todo dia " + selected.payload.due_day
                  : "Não informado"
              }
            />
            <Detail label="CPF DO ALUNO" value={selected.payload.cpf} />
            <Detail
              label="NASCIMENTO DO ALUNO"
              value={formatBirth(selected.payload.birth_date)}
            />
            <Detail label="TELEFONE" value={selected.payload.phone} />
            {selected.is_minor ? (
              <Detail
                label="CPF DO RESPONSÁVEL"
                value={selected.payload.guardian_cpf}
              />
            ) : null}
            {selected.is_minor ? (
              <Detail
                label="NASCIMENTO DO RESPONSÁVEL"
                value={formatBirth(selected.payload.guardian_birth_date)}
              />
            ) : null}
            {selected.payload.alternate_phone ? (
              <Detail
                label="OUTRO TELEFONE"
                value={selected.payload.alternate_phone}
              />
            ) : null}
          </ResponsiveGrid>
          {selected.archived_at || selected.student_status !== "active" ? (
            <Notice message="Reative ou restaure este aluno antes de liberar o acesso." />
          ) : null}
        </EditorDialog>
      ) : null}
      <ConfirmDialog
        visible={!!decision}
        title={
          decision?.approve
            ? "Liberar acesso ao aluno?"
            : "Recusar solicitação?"
        }
        message={
          decision
            ? decision.request.account_name +
              " (" +
              decision.request.account_email +
              ") " +
              (decision.approve
                ? "terá acesso ao cadastro de "
                : "não terá acesso ao cadastro de ") +
              decision.request.student_name +
              "."
            : ""
        }
        confirmLabel={
          decision?.approve ? "Confirmar acesso" : "Recusar solicitação"
        }
        pending={decide.isPending}
        error={decide.error?.message}
        onCancel={() => setDecision(null)}
        onConfirm={() => decision && decide.mutate(decision)}
      />
    </Card>
  );
}
type AccessGrant = {
  student_id: string;
  user_id: string;
  student_name: string;
  account_name: string;
  account_email: string;
};
function PortalAccess() {
  const { academy } = useSession();
  const a = academy!;
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<AccessGrant | null>(null);
  const grants = useQuery({
    queryKey: ["portal-access", a.id, page],
    queryFn: () =>
      api<Page<AccessGrant>>(academyPath(a.id, "/portal-access?page=" + page)),
  });
  const revoke = useMutation({
    mutationFn: (x: AccessGrant) =>
      api(
        academyPath(
          a.id,
          "/students/" + x.student_id + "/portal-access/" + x.user_id,
        ),
        { method: "DELETE" },
      ),
    onSuccess: () => {
      setTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["portal-access", a.id] });
    },
  });
  return (
    <Card>
      <View style={s.header}>
        <View style={s.grow}>
          <Heading>Acessos liberados</Heading>
          <Text style={s.muted}>
            Responsáveis e contas aprovadas · {grants.data?.total ?? 0}
          </Text>
        </View>
        <IconButton
          icon="swap"
          label="Atualizar acessos"
          disabled={grants.isFetching}
          onPress={() => grants.refetch()}
        />
      </View>
      {grants.error ? (
        <Notice message={grants.error.message} />
      ) : grants.isPending ? (
        <Loading />
      ) : !grants.data?.items.length ? (
        <EmptySection
          title="Nenhum acesso adicional"
          message="Os responsáveis vinculados e os acessos que você aprovar aparecem aqui."
        />
      ) : (
        grants.data.items.map((x) => (
          <View key={x.student_id + ":" + x.user_id} style={s.listRow}>
            <View style={s.avatar}>
              <Icon name="lock" size={20} color={colors.muted} />
            </View>
            <View style={s.grow}>
              <Text style={s.rowTitle}>{x.student_name}</Text>
              <Text style={s.muted}>{x.account_name}</Text>
              <Text style={s.muted} numberOfLines={1}>
                {x.account_email}
              </Text>
            </View>
            <IconButton
              icon="close"
              label={
                "Remover acesso de " + x.account_name + " a " + x.student_name
              }
              onPress={() => {
                revoke.reset();
                setTarget(x);
              }}
            />
          </View>
        ))
      )}
      {grants.data ? (
        <Pagination page={page} total={grants.data.total} onChange={setPage} />
      ) : null}
      <ConfirmDialog
        visible={!!target}
        title="Remover acesso ao aluno?"
        message={
          target
            ? target.account_name +
              " deixará de acessar " +
              target.student_name +
              " por este vínculo. O cadastro, o histórico e as mensalidades serão preservados."
            : ""
        }
        confirmLabel="Remover acesso"
        pending={revoke.isPending}
        error={revoke.error?.message}
        onCancel={() => setTarget(null)}
        onConfirm={() => target && revoke.mutate(target)}
      />
    </Card>
  );
}
const s = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    padding: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    alignSelf: "flex-start",
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    minHeight: 44,
    borderRadius: 11,
  },
  selectedTab: { backgroundColor: colors.surfaceRaised },
  tabText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: colors.muted,
  },
  hero: {
    gap: 20,
    padding: 24,
    borderTopColor: colors.primary,
    borderTopWidth: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
  },
  symbol: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: accents.brand.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  grow: { flex: 1, minWidth: 0, gap: 5 },
  eyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 1,
  },
  heroTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 23,
    color: colors.text,
    letterSpacing: -0.6,
  },
  statusLine: { alignItems: "flex-start" },
  linkBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  linkText: {
    flex: 1,
    minWidth: 0,
    color: colors.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  primaryAction: { flexGrow: 1, flexBasis: 220 },
  tags: { gap: 10 },
  offerTag: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  small: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: colors.text },
  muted: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  summaryValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: colors.text,
  },
  hint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 4,
  },
  hintText: {
    flex: 1,
    color: colors.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 19,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
  },
  switchTrack: {
    width: 46,
    height: 27,
    borderRadius: 20,
    padding: 3,
    backgroundColor: colors.border,
  },
  switchOn: { backgroundColor: colors.primary },
  switchThumb: {
    width: 21,
    height: 21,
    borderRadius: 12,
    backgroundColor: colors.text,
  },
  offer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    minHeight: 64,
  },
  selectedOffer: {
    borderColor: accents.brand.border,
    backgroundColor: accents.brand.soft,
  },
  check: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  checked: { backgroundColor: colors.primary, borderColor: colors.primary },
  rowTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: colors.text,
  },
  price: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: colors.text },
  empty: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 40,
    maxWidth: 460,
    alignSelf: "center",
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 22,
    backgroundColor: accents.mint.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
});
