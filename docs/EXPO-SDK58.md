# Expo SDK 58 e Expo Go no iPhone

O projeto foi atualizado do SDK 57 para o SDK 58 para corresponder ao Expo Go atual do iPhone. A integracao InfinitePay nao havia alterado a versao principal: o SDK anterior continuava sendo 57.

## Rodar depois da atualizacao

1. Encerre o terminal do Expo antigo com Ctrl+C.
2. Na pasta mobile, execute `npx expo start --clear`.
3. Abra o Expo Go atualizado e escaneie o novo QR Code.

Em outro computador, instale as dependencias com `npm ci` antes de iniciar. O backend e executado separadamente e nao foi alterado por esta atualizacao de SDK. Node.js 24.3+ na linha 24 e compativel; a verificacao local usou 24.14.

## Mudancas

- Expo 58 e dependencias recomendadas por `expo install --fix`: React 19.3, React Native 0.88, Expo Router 58, camera, SecureStore, fontes e demais modulos.
- Tipos de referencias de View, ScrollView e TextInput ajustados para `ComponentRef<typeof Componente>`, conforme os componentes funcionais do React Native 0.88.
- Web continua com `output: single`, servida pela API Go no Docker existente.
- Instalacao antiga e lockfile anteriores preservados em `.tools/sdk58-backups` na raiz, fora do Git e do contexto Docker.

A pasta android local, se existente, foi gerada para o SDK anterior e nao e usada pelo Expo Go. Antes de gerar um novo APK local, preserve eventuais alteracoes manuais e regenere os projetos nativos com o Expo SDK 58. Builds EAS que usam CNG devem gerar novamente os projetos com as novas dependencias; APKs instalados antigos nao se atualizam apenas com esta mudanca.

## Validacao

Expo Doctor: 20/20 verificacoes aprovadas. Compatibilidade das dependencias, TypeScript e lint aprovados. Bundles iOS e web gerados com sucesso; 32 testes do frontend aprovados. A abertura final no Expo Go deve ser confirmada no iPhone; o ambiente Windows nao executa o simulador iOS.

Referencias oficiais: https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/ e https://docs.expo.dev/router/migrate/sdk-57-to-58/.
