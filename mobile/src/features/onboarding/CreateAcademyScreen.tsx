import { useRef, useState } from "react";
import { Redirect, router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import {
  Page,
  Card,
  Heading,
  Label,
  Field,
  Button,
  Notice,
  Loading,
} from "../../components/ui";
import { AcademyShell } from "../shared/AcademyShell";
import { api } from "../../services/api";
import { useSession } from "../../services/session";
import { Academy } from "../../types";

export default function CreateAcademyScreen() {
  const { ready, session, academy, role, academiesLoading, select, logout } =
    useSession();
  const [name, setName] = useState("");
  const submitting = useRef(false);
  const create = useMutation({
    mutationFn: () => {
      const clean = name.trim();
      if (clean.length < 2 || clean.length > 100)
        throw new Error("Informe um nome de 2 a 100 caracteres.");
      return api<Academy>("/v1/academies", {
        method: "POST",
        body: { name: clean },
      });
    },
    onSuccess: (a) => {
      select(a, "admin");
      router.replace("/academy");
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
    <Card>
      <Heading>
        {academy ? "Uma nova academia" : "Vamos preparar sua academia"}
      </Heading>
      <Label muted>
        {academy
          ? "Ela terá seus próprios alunos, turmas e financeiro. Sua conta será a gestora."
          : "Cadastre sua primeira academia para começar a gerenciar alunos, mensalidades e presenças."}
      </Label>
      <Field
        label="Nome da academia"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        maxLength={100}
        editable={!create.isPending}
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />
      <Notice message={create.error?.message} />
      <Button
        loading={create.isPending}
        disabled={name.trim().length < 2}
        onPress={() => void submit()}
      >
        {academy ? "Criar nova academia" : "Criar minha academia"}
      </Button>
      <Label muted>Depois do cadastro, você entra direto na gestão.</Label>
    </Card>
  );
  return academy && role === "admin" ? (
    <AcademyShell
      title="Nova academia"
      swipeEnabled={false}
      titleAction={
        <Button
          compact
          secondary
          disabled={create.isPending}
          icon="chevron-left"
          onPress={() => router.replace("/more")}
        >
          Mais
        </Button>
      }
    >
      {content}
    </AcademyShell>
  ) : (
    <Page
      title="Sua primeira academia"
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
