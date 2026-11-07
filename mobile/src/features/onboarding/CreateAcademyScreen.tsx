import { useRef, useState } from "react";
import { Redirect, router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import {
  Page,
  Card,
  Field,
  Button,
  Notice,
  Loading,
} from "../../components/ui";
import { AcademyShell } from "../shared/AcademyShell";
import { api } from "../../services/api";
import { useSession } from "../../services/session";
import { Academy } from "../../types";
import { Pressable, Text, View } from "react-native";
import { Icon } from "../../components/Icon";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import {
  AcademyPlanPicker,
  AcademySetupRules,
  AcademySetupSummary,
  SetupHeading,
} from "./AcademySetupCards";
import { useTheme } from "../../theme/ThemeProvider";

import { planOptions } from "../subscription/plan-options";
import { LEGAL_VERSION } from "../legal/content";
import { LegalDocument } from "../legal/LegalDocument";
import { EditorDialog } from "../../components/EditorDialog";

export default function CreateAcademyScreen() {
  const { colors } = useTheme();
  const { ready, session, academy, role, academiesLoading, select, logout } =
    useSession();
  const { isCompact, isWide } = useResponsiveLayout();
  const [name, setName] = useState("");
  const [planID, setPlanID] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const selectedPlan = planOptions.find((p) => p.id === planID);
  const submitting = useRef(false);
  const create = useMutation({
    mutationFn: () => {
      const clean = name.trim();
      if (clean.length < 2 || clean.length > 100)
        throw new Error("Informe um nome de 2 a 100 caracteres.");
      if (!selectedPlan)
        throw new Error("Selecione um plano para esta academia.");
      if (!accepted)
        throw new Error("Confirme as condições do plano e do teste gratuito.");
      return api<Academy>("/v1/academies", {
        method: "POST",
        body: { name: clean, plan_id: planID, terms_version: LEGAL_VERSION },
      });
    },
    onSuccess: (a) => {
      select(a, "admin");
      router.replace("/subscription");
    },
  });
  async function submit() {
    if (submitting.current) return;
    submitting.current = true;
    try {
      await create.mutateAsync();
    } catch {
      /* Displayed below. */
    } finally {
      submitting.current = false;
    }
  }
  if (!ready || academiesLoading)
    return (
      <Page>
        <Loading />
      </Page>
    );
  if (!session) return <Redirect href="/login" />;
  if (session.kind === "device") return <Redirect href="/kiosk" />;
  const content = (
    <>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "flex-start",
          gap: 24,
        }}
      >
        <View
          style={{
            flexGrow: 2,
            flexBasis: isCompact ? "100%" : "62%",
            minWidth: isCompact ? 0 : 460,
            gap: 24,
          }}
        >
          <Card style={{ padding: 25, gap: 22 }}>
            <SetupHeading
              number="01"
              title="O nome da sua academia"
              subtitle="É assim que sua equipe e seus alunos vão encontrar você."
            />
            <Field
              label="Nome da academia"
              placeholder="Ex.: Academia Checkmat Centro"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              maxLength={100}
              editable={!create.isPending}
              returnKeyType="done"
            />
            <View
              style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}
            >
              <Icon name="users" size={15} color={colors.muted} />
              <Text
                style={{
                  flex: 1,
                  fontSize: 11,
                  lineHeight: 18,
                  color: colors.muted,
                  fontFamily: "Inter_400Regular",
                }}
              >
                Sua conta será gestora desta academia. Você cadastra os alunos
                depois.
              </Text>
            </View>
          </Card>
          <View style={{ gap: 20 }}>
            <SetupHeading
              number="02"
              title="Um plano para o seu momento"
              subtitle="Mesmas funcionalidades. Escolha a faixa da sua academia."
            />
            <AcademyPlanPicker
              value={planID}
              disabled={create.isPending}
              onChange={(id) => {
                setPlanID(id);
                setAccepted(false);
              }}
            />
          </View>
          <AcademySetupRules />
        </View>
        <View
          style={{
            flexGrow: 1,
            flexBasis: isCompact ? "100%" : "30%",
            minWidth: isCompact ? 0 : 300,
            gap: 16,
          }}
        >
          <AcademySetupSummary plan={selectedPlan}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel="Aceito as condições do plano, do teste grátis e do enquadramento automático"
              accessibilityState={{
                checked: accepted,
                disabled: create.isPending,
              }}
              disabled={create.isPending}
              onPress={() => setAccepted((v) => !v)}
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 10,
                minHeight: 44,
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 5,
                  borderWidth: 1,
                  borderColor: accepted ? colors.primaryLight : colors.border,
                  backgroundColor: accepted ? colors.primary : colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 2,
                }}
              >
                {accepted ? (
                  <Icon name="check-circle" size={16} color="#FFFFFF" />
                ) : null}
              </View>
              <Text
                style={{
                  flex: 1,
                  color: colors.muted,
                  fontSize: 11,
                  lineHeight: 18,
                  fontFamily: "Inter_400Regular",
                }}
              >
                Li e aceito as condições do plano, dos 5 dias grátis e do
                enquadramento automático.
              </Text>
            </Pressable>
            <Button
              secondary
              compact
              disabled={create.isPending}
              onPress={() => setShowTerms(true)}
            >
              Ler Termos da assinatura
            </Button>
            <Notice message={create.error?.message} />
            <Button
              loading={create.isPending}
              disabled={name.trim().length < 2 || !selectedPlan || !accepted}
              icon="arrow-right"
              onPress={() => void submit()}
            >
              {academy ? "Criar nova academia" : "Criar minha academia"}
            </Button>
            <Text
              style={{
                color: colors.muted,
                fontFamily: "Inter_400Regular",
                fontSize: 10,
                lineHeight: 17,
                textAlign: "center",
              }}
            >
              {name.trim().length < 2
                ? "Informe o nome da academia para continuar."
                : !selectedPlan
                  ? "Selecione um plano para continuar."
                  : !accepted
                    ? "Confirme as condições para começar."
                    : "Seu teste de 5 dias começa ao criar a academia."}
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontFamily: "Inter_400Regular",
                fontSize: 10,
                lineHeight: 17,
              }}
            >
              Sem pagamento ao fim do teste, novas operações ficam restritas.
              Consultas e pagamento continuam disponíveis.
            </Text>
          </AcademySetupSummary>
        </View>
      </View>
      {showTerms ? (
        <EditorDialog
          title="Condições da assinatura"
          onClose={() => setShowTerms(false)}
        >
          <LegalDocument />
        </EditorDialog>
      ) : null}
    </>
  );
  return academy && role === "admin" ? (
    <AcademyShell
      title="Nova academia"
      subtitle="Prepare seu espaço. Comece com 5 dias grátis."
      swipeEnabled={false}
      titleAction={
        <Button
          compact
          secondary
          disabled={create.isPending}
          icon="chevron-left"
          onPress={() => router.replace("/more")}
        >
          Voltar
        </Button>
      }
    >
      {content}
    </AcademyShell>
  ) : (
    <Page
      title="Vamos preparar sua academia"
      subtitle="Seu próximo passo começa aqui. Teste grátis por 5 dias."
      wide={isWide}
      action={
        <Button
          compact
          secondary
          disabled={create.isPending}
          onPress={() => void logout()}
        >
          Sair
        </Button>
      }
    >
      {content}
    </Page>
  );
}
