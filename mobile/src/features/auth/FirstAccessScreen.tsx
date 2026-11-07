import { useState } from "react";
import { Redirect, router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import {
  Button,
  Card,
  Chip,
  Field,
  Label,
  Loading,
  Notice,
  Page,
  Row,
} from "../../components/ui";
import { EditorDialog } from "../../components/EditorDialog";
import { api } from "../../services/api";
import { useSession } from "../../services/session";
import type { User } from "../../types";
import { LegalDocument } from "../legal/LegalDocument";
import { LEGAL_VERSION } from "../legal/content";
import { registrationProblem } from "./registration-validation";

export default function FirstAccessScreen() {
  const { colors } = useTheme();
  const { ready, session, login, logout } = useSession();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [document, setDocument] = useState<"terms" | "privacy" | null>(null);
  const [show, setShow] = useState(false);
  const submit = useMutation({
    mutationFn: async () => {
      const problem = registrationProblem(password, confirmation, acknowledged);
      if (problem) throw new Error(problem);
      const result = await api<{ token: string; user: User }>(
        "/v1/auth/first-access",
        {
          method: "POST",
          body: {
            password,
            password_confirmation: confirmation,
            terms_version: LEGAL_VERSION,
            privacy_version: LEGAL_VERSION,
          },
        },
      );
      await login(result);
    },
    onSuccess: () => router.replace("/entry"),
  });
  const leave = useMutation({ mutationFn: logout });
  if (!ready)
    return (
      <Page>
        <Loading />
      </Page>
    );
  if (session?.kind !== "user") return <Redirect href="/login" />;
  if (!session.user.password_change_required) return <Redirect href="/entry" />;
  return (
    <Page title="Escolha sua senha">
      <Card style={{ width: "100%", maxWidth: 520 }}>
        <Label>Bem-vindo, {session.user.name}.</Label>
        <Label muted>Escolha sua senha pessoal para acessar o portal.</Label>
        <Label>{session.user.email}</Label>
        <Field
          label="Nova senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          editable={!submit.isPending}
        />
        <Field
          label="Confirme a nova senha"
          value={confirmation}
          onChangeText={setConfirmation}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          editable={!submit.isPending}
        />
        <Row>
          <Chip selected={show} onPress={() => setShow(!show)}>
            Mostrar senhas
          </Chip>
        </Row>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel="Aceito os Termos de Uso e li o Aviso de Privacidade"
          accessibilityState={{
            checked: acknowledged,
            disabled: submit.isPending,
          }}
          disabled={submit.isPending}
          onPress={() => setAcknowledged(!acknowledged)}
          style={{
            minHeight: 48,
            padding: 12,
            borderWidth: 1,
            borderRadius: 12,
            borderColor: acknowledged ? colors.primaryLight : colors.border,
          }}
        >
          <Text
            style={{
              color: colors.text,
              fontFamily: "Inter_400Regular",
              fontSize: 14,
            }}
          >
            {acknowledged ? "✓ " : ""}Aceito os Termos de Uso e li o Aviso de
            Privacidade.
          </Text>
        </Pressable>
        <Row>
          <Button compact secondary onPress={() => setDocument("terms")}>
            Ler termos
          </Button>
          <Button compact secondary onPress={() => setDocument("privacy")}>
            Ler aviso de privacidade
          </Button>
        </Row>
        <Notice message={submit.error?.message || leave.error?.message} />
        <Button
          loading={submit.isPending}
          disabled={leave.isPending}
          onPress={() => submit.mutate()}
        >
          Salvar minha senha e entrar
        </Button>
        <View style={{ alignItems: "flex-start" }}>
          <Button
            compact
            secondary
            loading={leave.isPending}
            disabled={submit.isPending}
            onPress={() => leave.mutate()}
          >
            Sair da conta
          </Button>
        </View>
      </Card>
      {document ? (
        <EditorDialog
          title={
            document === "terms" ? "Termos de Uso" : "Aviso de Privacidade"
          }
          onClose={() => setDocument(null)}
        >
          <LegalDocument privacy={document === "privacy"} />
        </EditorDialog>
      ) : null}
    </Page>
  );
}
