import { ComponentRef, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams, Href } from "expo-router";
import { safeNext } from "../../services/links";
import { Notice } from "../../components/ui";
import { Icon } from "../../components/Icon";
import { api } from "../../services/api";
import { useSession } from "../../services/session";
import { User } from "../../types";
import { brand } from "../../theme/brand";
import { AuthLayout } from "./AuthLayout";
import { AuthAction, AuthField, authControlStyles } from "./AuthControls";
import { EditorDialog } from "../../components/EditorDialog";
import { LegalDocument } from "../legal/LegalDocument";
import { LEGAL_VERSION } from "../legal/content";
import { registrationProblem } from "./registration-validation";

export default function AuthScreen({
  register = false,
}: {
  register?: boolean;
}) {
  const { login } = useSession();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const destination = safeNext(next);
  const fromStudentLink =
    destination.startsWith("/enroll/") ||
    destination.startsWith("/invite/") ||
    destination.startsWith("/pay/");
  const nameInput = useRef<ComponentRef<typeof TextInput>>(null),
    emailInput = useRef<ComponentRef<typeof TextInput>>(null),
    passwordInput = useRef<ComponentRef<typeof TextInput>>(null),
    confirmationInput = useRef<ComponentRef<typeof TextInput>>(null);
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [document, setDocument] = useState<"terms" | "privacy" | null>(null);
  const submitting = useRef(false);
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [show, setShow] = useState(false);

  async function submit() {
    if (submitting.current) return;
    setError("");
    if (register && name.trim().length < 2) {
      setError("Informe seu nome completo.");
      nameInput.current?.focus();
      return;
    }
    if (!email.trim()) {
      setError("Informe o e-mail da sua conta.");
      emailInput.current?.focus();
      return;
    }
    if (!password || (register && password.length < 8)) {
      setError(
        register
          ? "Crie uma senha com pelo menos 8 caracteres."
          : "Informe sua senha.",
      );
      passwordInput.current?.focus();
      return;
    }
    submitting.current = true;
    if (register) {
      const problem = registrationProblem(password, confirmation, acknowledged);
      if (problem) {
        submitting.current = false;
        setError(problem);
        if (password !== confirmation) confirmationInput.current?.focus();
        return;
      }
    }
    setBusy(true);
    try {
      const data = await api<{ token: string; user: User }>(
        register ? "/v1/auth/register" : "/v1/auth/login",
        {
          method: "POST",
          body: register
            ? {
                name: name.trim(),
                email: email.trim(),
                password,
                password_confirmation: confirmation,
                terms_version: LEGAL_VERSION,
                privacy_version: LEGAL_VERSION,
              }
            : { email: email.trim(), password },
        },
      );
      await login(data);
      router.replace(destination as Href);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível entrar. Tente novamente.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <AuthLayout register={register} fromStudentLink={fromStudentLink}>
      <View style={s.fields}>
        {register ? (
          <AuthField
            inputRef={nameInput}
            label="Nome completo"
            icon="users"
            placeholder="Como podemos chamar você?"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="name"
            maxLength={100}
            editable={!busy}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => emailInput.current?.focus()}
          />
        ) : null}
        <AuthField
          inputRef={emailInput}
          label="E-mail"
          icon="mail"
          placeholder="voce@exemplo.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoComplete="email"
          maxLength={254}
          editable={!busy}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordInput.current?.focus()}
        />
        <AuthField
          inputRef={passwordInput}
          label="Senha"
          icon="lock"
          placeholder={register ? "Pelo menos 8 caracteres" : "Sua senha"}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!show}
          autoComplete={register ? "new-password" : "current-password"}
          editable={!busy}
          returnKeyType={register ? "next" : "go"}
          submitBehavior="submit"
          onSubmitEditing={() =>
            register ? confirmationInput.current?.focus() : void submit()
          }
          trailing={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={show ? "Ocultar senha" : "Mostrar senha"}
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              hitSlop={2}
              style={({ pressed }) => [
                authControlStyles.eye,
                pressed && { backgroundColor: brand.accentSoft },
              ]}
              onPress={() => setShow((v) => !v)}
            >
              <Icon
                name={show ? "eye-off" : "eye"}
                size={20}
                color={brand.muted}
              />
            </Pressable>
          }
        />
        {register ? (
          <>
            <AuthField
              inputRef={confirmationInput}
              label="Repetir senha"
              icon="lock"
              placeholder="Digite a mesma senha novamente"
              value={confirmation}
              onChangeText={setConfirmation}
              secureTextEntry={!show}
              autoComplete="new-password"
              editable={!busy}
              returnKeyType="done"
              submitBehavior="submit"
              onSubmitEditing={() => void submit()}
            />
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel="Aceito os Termos de Uso e li o Aviso de Privacidade"
              accessibilityState={{ checked: acknowledged, disabled: busy }}
              disabled={busy}
              onPress={() => setAcknowledged((v) => !v)}
              style={s.acknowledgement}
            >
              <View
                style={[
                  s.checkbox,
                  acknowledged && {
                    backgroundColor: brand.accent,
                    borderColor: brand.accent,
                  },
                ]}
              >
                {acknowledged ? (
                  <Icon name="check-circle" size={18} color="#FFFFFF" />
                ) : null}
              </View>
              <Text style={s.note}>
                Aceito os Termos de Uso e confirmo que li o Aviso de
                Privacidade. Isso não autoriza publicidade ou uso irrestrito dos
                meus dados.
              </Text>
            </Pressable>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18 }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setDocument("terms")}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <Text style={s.legalLink}>Ler Termos de Uso</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setDocument("privacy")}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <Text style={s.legalLink}>Ler Aviso de Privacidade</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </View>
      {document ? (
        <EditorDialog
          title={
            document === "privacy" ? "Aviso de Privacidade" : "Termos de Uso"
          }
          onClose={() => setDocument(null)}
        >
          <LegalDocument privacy={document === "privacy"} />
        </EditorDialog>
      ) : null}
      {error ? (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Notice message={error} />
        </View>
      ) : null}
      <AuthAction loading={busy} onPress={() => void submit()}>
        {busy
          ? register
            ? "Criando sua conta…"
            : "Entrando…"
          : register
            ? "Criar minha conta"
            : "Entrar na minha conta"}
      </AuthAction>
      <View style={s.divider}>
        <View style={s.line} />
        <Text style={s.dividerText}>
          {register ? "Já faz parte?" : "Primeira vez por aqui?"}
        </Text>
        <View style={s.line} />
      </View>
      <AuthAction
        secondary
        disabled={busy}
        onPress={() =>
          router.replace({
            pathname: register ? "/login" : "/register",
            params: { next: destination },
          })
        }
      >
        {register ? "Entrar na minha conta" : "Criar uma conta"}
      </AuthAction>
      <View style={s.inviteNote}>
        <Icon name="users" size={17} color={brand.muted} />
        <Text style={s.note}>
          {fromStudentLink
            ? "Use seu próprio e-mail. Para matricular uma criança, entre com a conta do responsável."
            : "Seu perfil é identificado automaticamente após o login."}
        </Text>
      </View>
    </AuthLayout>
  );
}
const s = StyleSheet.create({
  acknowledgement: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    minHeight: 44,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: brand.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  legalLink: {
    color: brand.accentLight,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  fields: { gap: 18 },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: -4,
  },
  line: { flex: 1, height: 1, backgroundColor: brand.border },
  dividerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: brand.muted,
  },
  inviteNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    paddingTop: 2,
  },
  note: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 19,
    color: brand.muted,
  },
});
