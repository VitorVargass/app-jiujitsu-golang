import { router } from "expo-router";
import { Page, Button } from "../components/ui";
import { LegalDocument } from "../features/legal/LegalDocument";
export default function Privacy() {
  return (
    <Page
      title="Aviso de Privacidade"
      action={
        <Button
          compact
          secondary
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/login")
          }
        >
          Voltar
        </Button>
      }
    >
      <LegalDocument privacy />
    </Page>
  );
}
