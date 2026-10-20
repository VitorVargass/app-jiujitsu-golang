import { Redirect, router } from "expo-router";
import { Button, Loading, Notice, Page } from "../../components/ui";
import { academyAccesses, accessHome } from "../../services/access";
import { useSession } from "../../services/session";
import { AcademyAccessList } from "./AcademyAccessList";

export default function AcademyPickerScreen() {
  const {
    ready,
    session,
    role,
    academies,
    academiesLoading,
    academiesError,
    reloadAcademies,
    logout,
  } = useSession();
  if (!ready || academiesLoading)
    return (
      <Page>
        <Loading />
      </Page>
    );
  if (!session) return <Redirect href="/login" />;
  if (session.kind === "device") return <Redirect href="/kiosk" />;
  const options = academyAccesses(academies);
  if (!academiesError && !options.length) return <Redirect href="/entry" />;
  return (
    <Page
      title="Academias e perfis"
      subtitle="Troque de academia ou de área quando precisar."
      action={
        <Button
          compact
          secondary
          icon="chevron-left"
          onPress={() =>
            router.replace(
              role === "admin" || role === "student"
                ? accessHome(role)
                : "/entry",
            )
          }
        >
          Voltar
        </Button>
      }
    >
      <Notice message={academiesError?.message} />
      <AcademyAccessList options={options} />
      <Button secondary icon="swap" onPress={reloadAcademies}>
        Atualizar acessos
      </Button>
      <Button secondary onPress={() => void logout()}>
        Sair da conta
      </Button>
    </Page>
  );
}
