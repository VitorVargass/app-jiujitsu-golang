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

export default function AuthScreen({
  register = false,
}: {
  register?: boolean;
}) {
  const { login } = useSession();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const destination = safeNext(next);
  const fromStudentLink =
    destination.startsWith("/invite/") || destination.startsWith("/pay/");
  const nameInput = useRef<ComponentRef<typeof TextInput>>(null),
    emailInput = useRef<ComponentRef<typeof TextInput>>(null),
    passwordInput = useRef<ComponentRef<typeof TextInput>>(null);
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
    setBusy(true);
    try {
      const data = await api<{ token: string; user: User }>(
        register ? "/v1/auth/register" : "/v1/auth/login",
        {
          method: "POST",
          body: register
            ? { name: name.trim(), email: email.trim(), password }
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
          returnKeyType={register ? "done" : "go"}
          submitBehavior="submit"
          onSubmitEditing={() => void submit()}
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
      </View>
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
            ? "Use o mesmo e-mail cadastrado pela sua academia."
            : "Seu perfil é identificado automaticamente após o login."}
        </Text>
      </View>
    </AuthLayout>
  );
}
const s = StyleSheet.create({
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
