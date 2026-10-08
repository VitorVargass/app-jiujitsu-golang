# Tatame — MVP de jiu-jitsu

API em Go e aplicativo React Native/Expo para alunos, professores e gestores de várias academias. O cadastro é aberto; os vínculos de aluno e professor dependem de aprovação do gestor.

## Começar neste computador

As ferramentas portáteis foram preparadas em .tools, sem instalação de serviços do Windows.

No PowerShell, dentro de C:\Users\vitor\Documents\App-jiujitsu:

    .\scripts\start-dev.ps1 -Seed

Abra [http://localhost:8081](http://localhost:8081) para o preview. A API responde em http://localhost:8080/healthz.

| Conta de demonstração | Papel |
|---|---|
| gestor@tatame.demo | Gestor das duas academias |
| professor@tatame.demo | Professor |
| aluno@tatame.demo | João Silva, aluno |
| ana@tatame.demo | Ana Souza, aluna |

Senha de demonstração: **Tatame123!**. O seed mostra os códigos das academias e é repetível. As contas de demonstração pertencem a Gracie Barra • Centro e Tatame • Zona Sul.

Para cadastrar uma nova pessoa: crie conta, escolha aluno ou professor e solicite vínculo com o código mostrado ao gestor. O gestor aprova no dashboard.

## Fluxo completo

1. Entre como gestor para criar academia, aprovar solicitações e criar uma turma com professor. Em Editar turma e horários, adicione os horários semanais.
2. Entre como professor, escolha a turma e abra o horário do dia.
3. Entre como aluno, escolha a academia e abra Meu QR Code.
4. No aparelho que será o tablet, entre como gestor e ative Modo tablet. Essa operação revoga a sessão pessoal daquele aparelho e guarda somente uma credencial de dispositivo.
5. Selecione a aula aberta e leia o QR ou digite os 8 números do aluno.
6. Confira a confirmação no tablet, a lista do professor e o histórico do aluno.

Qualquer aluno ativo pode frequentar qualquer turma da academia. Não existe matrícula por turma.

## Android

O APK interno está em [artifacts/Tatame-arm64.apk](artifacts/Tatame-arm64.apk). Requer Android 7+ arm64 e usa a API http://192.168.15.6:8080, na mesma rede deste computador. A assinatura foi verificada; a instalação e a câmera aguardam teste em aparelho físico.

O projeto usa Expo SDK 57. Para usar Expo Go no celular, configure a API com o IP do computador na mesma rede:

    .\scripts\start-dev.ps1 -ApiUrl http://IP_DO_COMPUTADOR:8080

Se o Metro já estiver iniciado com outra configuração, pare-o antes de trocar a URL. O APK interno usa a URL definida durante sua compilação. O servidor precisa estar rodando e acessível pela mesma rede.

O perfil preview em mobile/eas.json gera APK com EAS:

    cd mobile
    npx eas-cli build --platform android --profile preview

EAS exige uma conta Expo. O build local preparado neste computador utiliza Java e Android SDK em .tools. Para repetir a compilação: `.\scripts\build-apk.ps1 -ApiUrl http://IP_DO_COMPUTADOR:8080`. O script cria e limpa uma cópia temporária com caminho curto, para contornar limites do Windows. O APK de teste é assinado com a chave de desenvolvimento, para distribuição interna.

## Executar em outro computador

Pré-requisitos: Node, Go 1.27 e Docker. No Windows, scripts/bootstrap-windows.ps1 também prepara Go e PostgreSQL portáteis caso necessário.

    docker compose up --build -d
    docker compose run --rm --entrypoint /seed api
    cd mobile
    npm ci
    npx expo start

O Compose usa PostgreSQL na porta 5432. O modo portátil deste computador usa 55432. Não use as contas e senhas de demonstração em publicação pública. A comunicação HTTP está habilitada para o piloto local; use HTTPS ao publicar.

## Estrutura para estudar

- backend/cmd/api: inicialização, migrações e servidor.
- backend/internal: módulos de autenticação, academias, vínculos, turmas, dispositivos e presenças.
- backend/internal/database/migrations: migrações SQL incorporadas no executável com Goose.
- mobile/src/app: rotas curtas do Expo Router.
- mobile/src/features: telas e lógica por funcionalidade.
- mobile/src/services: cliente HTTP, sessão e cache.
- docs/ARCHITECTURE.md: explicação do fluxo entre as camadas.
- docs/openapi.json: contrato da API, também servido em /openapi.json.
- docs/OFFLINE.md: estudo separado de sincronização e conflitos.

## Verificar

API, incluindo testes de integração com um PostgreSQL exclusivo:

    cd backend
    $env:TEST_DATABASE_URL='postgres://tatame:tatame_dev@127.0.0.1:55432/tatame_test?sslmode=disable'
    ..\.tools\go\bin\go.exe test ./...
    ..\.tools\go\bin\go.exe vet ./...

Sem TEST_DATABASE_URL, os testes de integração são explicitamente ignorados. Nunca aponte essa variável para um banco com dados de produção.

Aplicativo:

    cd mobile
    npm run lint
    npm run typecheck
    npx expo-doctor
    npm run export:web

Laboratório offline com SQLite real:

    node --test tools/offline-lab/queue.test.mjs

## Limites da versão

Check-in exige internet e confirmação da API. Mensalidades, pagamentos, graduação, recuperação de senha por e-mail, login social e publicação nas lojas pertencem às próximas versões. O histórico retorna os últimos 200 registros; aulas retornam até 100 ocorrências. O percentual de frequência ainda não é calculado.

Câmera, leitura de QR e instalação do APK precisam ser conferidas em um aparelho físico; o teste de interface no navegador não substitui essa verificação.

O relatório de verificações e os pontos que exigem aparelho físico estão em [docs/VALIDATION.md](docs/VALIDATION.md).
