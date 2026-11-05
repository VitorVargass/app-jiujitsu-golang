import { router } from "expo-router";
import { Page, Button } from "../components/ui";
import { LegalDocument } from "../features/legal/LegalDocument";
export default function Terms() {
  return (
    <Page
      title="Termos de Uso"
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
      <LegalDocument />
    </Page>
  );
}
