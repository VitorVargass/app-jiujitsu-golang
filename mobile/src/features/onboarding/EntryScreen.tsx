import { useEffect } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import {
  Page,
  Button,
  Heading,
  Label,
  Loading,
  Notice,
} from "../../components/ui";
import {
  accessHome,
  accessRole,
  automaticAccess,
  entryAccesses,
} from "../../services/access";
import { useSession } from "../../services/session";
import { AcademyAccessList } from "./AcademyAccessList";

export default function EntryScreen() {
  const { area } = useLocalSearchParams<{ area?: string }>();
  const {
    ready,
    session,
    academy,
    role,
    academies,
    academiesLoading,
    academiesError,
    reloadAcademies,
    selection,
    select,
    logout,
  } = useSession();
  const requestedRole = accessRole(area);
  const target = automaticAccess(academies, requestedRole, selection);
  const atTarget =
    target && academy?.id === target.academy.id && role === target.role;
  useEffect(() => {
    if (!academiesLoading && !academiesError && target && !atTarget)
      select(target.academy, target.role);
  }, [academiesLoading, academiesError, target, atTarget, select]);
  if (!ready)
    return (
      <Page>
        <Loading />
      </Page>
    );
  if (!session) return <Redirect href="/login" />;
  if (session.kind === "device") return <Redirect href="/kiosk" />;
  if (academiesLoading)
    return (
      <Page>
        <Loading />
      </Page>
    );
  if (academiesError)
    return (
      <Page title="Não foi possível abrir sua academia">
        <Notice message={academiesError.message} />
        <Button onPress={reloadAcademies}>Tentar novamente</Button>
        <Button secondary onPress={() => void logout()}>
          Sair da conta
        </Button>
      </Page>
    );
  if (target)
    return atTarget ? (
      <Redirect href={accessHome(target.role)} />
    ) : (
      <Page>
        <Loading />
      </Page>
    );
  if (!academies.length && requestedRole === "admin")
    return <Redirect href="/create-academy" />;
  const options = entryAccesses(academies, requestedRole);
  return (
    <Page
      title={
        options.length
          ? new Set(options.map((option) => option.academy.id)).size > 1
            ? "Qual academia você quer acessar?"
            : "Como você quer acessar?"
          : "Seu acesso à academia"
      }
      subtitle={
        options.length
          ? "Esta conta tem mais de uma opção de acesso."
          : undefined
      }
      action={
        <Button compact secondary onPress={() => void logout()}>
          Sair
        </Button>
      }
    >
      {options.length ? (
        <AcademyAccessList options={options} />
      ) : (
        <>
          <Heading>
            {academies.length ? "Acesso indisponível" : "Sua conta está pronta"}
          </Heading>
          <Label muted>
            {academies.length
              ? "Nenhum acesso disponível para esta conta. Converse com o responsável pela academia."
              : "Para acessar como aluno, abra o convite enviado pela academia usando o mesmo e-mail do seu cadastro."}
          </Label>
          {!academies.length ? (
            <>
              <Heading>Vai gerenciar uma academia?</Heading>
              <Button
                icon="plus"
                onPress={() => router.push("/create-academy")}
              >
                Cadastrar minha academia
              </Button>
            </>
          ) : null}
        </>
      )}
      <Button secondary icon="swap" onPress={reloadAcademies}>
        Atualizar acessos
      </Button>
    </Page>
  );
}
