import { Linking, View } from "react-native";
import { Heading, Label, Button, Notice } from "../../components/ui";
import {
  LEGAL_VERSION,
  privacyContact,
  privacySections,
  termsSections,
} from "./content";

export function LegalDocument({ privacy = false }: { privacy?: boolean }) {
  return (
    <View style={{ gap: 20 }}>
      <Label muted>
        Versão {LEGAL_VERSION} ·{" "}
        {privacy ? "Aviso de Privacidade" : "Termos de Uso"}
      </Label>
      {(privacy ? privacySections : termsSections).map(([title, text]) => (
        <View key={title} style={{ gap: 8 }}>
          <Heading>{title}</Heading>
          <Label>{text}</Label>
        </View>
      ))}
      <Heading>Contato e solicitações</Heading>
      {privacyContact ? (
        <>
          <Label>{privacyContact}</Label>
          <Button
            secondary
            onPress={() => void Linking.openURL(`mailto:${privacyContact}`)}
          >
            Enviar solicitação por e-mail
          </Button>
        </>
      ) : (
        <Notice message="O canal público de privacidade e atendimento ainda precisa ser configurado pela TatameMix antes da liberação comercial deste cadastro." />
      )}
      <Label muted>
        Informe a academia e o e-mail da conta. Não envie senhas nem dados
        completos de cartão. Pedidos sobre dados administrados pela academia
        também devem ser encaminhados à sua gestão.
      </Label>
    </View>
  );
}
