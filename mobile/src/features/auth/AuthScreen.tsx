import { useState } from "react";
import { router, useLocalSearchParams, Href } from "expo-router";
import { safeNext } from "../../services/links";
import {
  Page,
  Card,
  Heading,
  Label,
  Field,
  Button,
  Notice,
  Row,
  Chip,
} from "../../components/ui";
import { api } from "../../services/api";
import { useSession } from "../../services/session";
import { User } from "../../types";
export default function AuthScreen({
  register = false,
}: {
  register?: boolean;
}) {
  const { login } = useSession();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const destination = safeNext(next);
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [show, setShow] = useState(false);
  async function submit() {
    setError("");
    setBusy(true);
    try {
      const data = await api<{ token: string; user: User }>(
        register ? "/v1/auth/register" : "/v1/auth/login",
        {
          method: "POST",
          body: register ? { name, email, password } : { email, password },
        },
      );
      await login(data);
      router.replace(destination as Href);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      title={
        register ? "Seu próximo treino começa aqui." : "Bem-vindo de volta."
      }
      subtitle={
        register
          ? "Crie sua conta para gerenciar a academia ou aceitar seu convite."
          : "Mais presença. Mais evolução. Entre para continuar."
      }
    >
      <Card>
        <Row>
          <Chip selected>JIU-JITSU</Chip>
          <Label muted>Uma academia mais forte.</Label>
        </Row>
        <Heading>Seu tatame, conectado.</Heading>
        <Label muted>
          Gestão da academia, mensalidades e presença em um só lugar.
        </Label>
      </Card>
      {register && (
        <Field
          label="Nome completo"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoComplete="name"
        />
      )}
      <Field
        label="E-mail"
        placeholder="voce@email.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoComplete="email"
      />
      <Field
        label="Senha"
        placeholder={register ? "Pelo menos 8 caracteres" : "Sua senha"}
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!show}
        autoComplete={register ? "new-password" : "current-password"}
      />
      <Button secondary onPress={() => setShow(!show)}>
        {show ? "Ocultar senha" : "Mostrar senha"}
      </Button>
      <Notice message={error} />
      <Button onPress={() => void submit()} loading={busy}>
        {register ? "Criar minha conta" : "Entrar"}
      </Button>
      <Button
        secondary
        onPress={() =>
          router.replace({
            pathname: register ? "/login" : "/register",
            params: { next: destination },
          })
        }
      >
        {register
          ? "Já tenho uma conta"
          : "Ainda não tenho conta • Cadastre-se"}
      </Button>
      <Label muted>Alunos acessam a academia pelo convite do gestor.</Label>
    </Page>
  );
}
