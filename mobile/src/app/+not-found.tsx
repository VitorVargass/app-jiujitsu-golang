import { router } from "expo-router";
import { Button, Label, Page } from "../components/ui";

export default function NotFoundScreen() {
  return (
    <Page title="Página não encontrada">
      <Label>
        Este endereço não está disponível. Você pode voltar ao acesso do
        sistema.
      </Label>
      <Button onPress={() => router.replace("/entry")}>
        Ir para minhas academias
      </Button>
      {router.canGoBack() ? (
        <Button secondary onPress={() => router.back()}>
          Voltar à tela anterior
        </Button>
      ) : null}
    </Page>
  );
}
