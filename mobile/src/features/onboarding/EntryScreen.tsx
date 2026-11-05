import { useEffect } from "react";
import { Redirect, router, useLocalSearchParams, Href } from "expo-router";
import {
  Page,
  Button,
  Card,
  Badge,
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
import { EntryActionCards, EntryHelp, EntryWelcome } from "./EntryCards";
import { View } from "react-native";

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
  const firstName = session.user.name.trim().split(/\s+/)[0] || "bem-vindo";
  const academyCount = new Set(options.map((option) => option.academy.id)).size;
  return (
    <Page
      wide
      title={
        options.length
          ? "Escolha seu acesso"
          : academies.length
            ? "Seus acessos"
            : "Vamos começar"
      }
      subtitle={
        options.length
          ? "Entre na academia e no perfil que deseja usar."
          : session.user.email
      }
      action={
        <Button compact secondary onPress={() => void logout()}>
          Sair da conta
        </Button>
      }
    >
      <Button secondary onPress={() => router.push("/delete-account" as Href)}>
        Excluir minha conta
      </Button>
      {options.length ? (
        <>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <Badge
              label={
                academyCount === 1
                  ? "1 academia vinculada"
                  : academyCount + " academias vinculadas"
              }
              tone="slate"
            />
          </View>
          <AcademyAccessList options={options} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <Button secondary onPress={() => router.push("/enrollment-status")}>
              Minhas matrículas e pedidos
            </Button>
            {options.some((option) => option.role === "admin") ? (
              <Button
                secondary
                icon="plus"
                onPress={() => router.push("/create-academy")}
              >
                Criar outra academia
              </Button>
            ) : null}
          </View>
        </>
      ) : !academies.length ? (
        <>
          <EntryWelcome name={firstName} />
          <EntryActionCards canCreate />
        </>
      ) : (
        <Card>
          <Notice message="Nenhum acesso disponível para o perfil solicitado. Converse com o responsável pela academia." />
          {entryAccesses(academies).length > 0 ? (
            <Button secondary onPress={() => router.push("/academies")}>
              Ver todos os meus acessos
            </Button>
          ) : null}
          <Button secondary onPress={() => router.push("/enrollment-status")}>
            Minhas matrículas e pedidos
          </Button>
        </Card>
      )}
      <EntryHelp reload={reloadAcademies} />
    </Page>
  );
}
