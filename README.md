# Tatame — gestão da academia

API Go, PostgreSQL e aplicativo React Native/Expo com portal web do aluno. Esta versão inclui alunos independentes de contas, modalidades, planos opcionais, geração mensal, Pix Asaas e presenças exclusivamente pelo tablet. A interface usa preto, branco e cinza, com Montserrat e Lato, inspirada na [Checkmat](https://checkmatbrasil.com.br/checkmat/#matriz).

## Começar com seu PostgreSQL local

O backend precisa de Go, PostgreSQL funcionando e um banco criado. Neste computador você já criou o banco tatame e o usuário tatame. O pgAdmin administra esse servidor; a API conecta diretamente ao PostgreSQL.

No terminal CMD, entre na pasta backend do projeto. Configure DATABASE_URL com usuário, senha, endereço, porta e banco correspondentes à sua instalação. Exemplo de desenvolvimento:

    cd /d C:\Users\vitor\Documents\App-jiujitsu\backend
    set "DATABASE_URL=postgres://tatame:tatame_dev@localhost:5432/tatame?sslmode=disable"
    go run ./cmd/api

Use sua senha real se ela for diferente. Senhas com caracteres especiais na URL precisam ser codificadas. A API inicia em http://localhost:8080 e /healthz informa o estado.

go run compila e executa o pacote indicado. ./cmd/api contém main.go. Você executa o comando a partir de backend, onde está go.mod; não precisa manter o terminal na pasta do main.go. go run sozinho não indica o que executar. As migrações SQL estão incorporadas no programa e são aplicadas ao iniciar.

backend/.env.example é um modelo. A API lê as variáveis do processo e não carrega arquivos .env automaticamente. Valores definidos com set valem para aquele terminal; deixe a janela aberta enquanto a API estiver rodando. Ao atualizar o código, pare a API antiga e execute novamente.

Antes da primeira execução desta versão em uma base existente, conserve o backup e siga [MIGRATION.md](docs/MIGRATION.md). A nova migração conserva históricos e não ativa cobranças para alunos antigos.

## Rodar o frontend

Em outro terminal:

    cd /d C:\Users\vitor\Documents\App-jiujitsu\mobile
    npm install
    npx expo start

O frontend está em mobile. O Expo lê mobile/.env. EXPO_PUBLIC_API_URL deve ser o endereço da API acessível pelo aparelho. No celular físico conectado à mesma rede, o endereço atual deste computador é http://192.168.15.5:8080. localhost no celular aponta para o próprio celular.

Para desenvolvimento na mesma rede, EXPO_PUBLIC_API_URL=auto descobre o computador pelo endereço do Expo Go; no navegador, usa o hostname da página e a porta 8080. Isso acompanha mudanças de IP após reiniciar o roteador. Uma URL explícita sempre tem prioridade. O túnel do Expo não publica a API; ambos os aparelhos precisam alcançar o servidor na rede local. APKs e exports de produção precisam de uma URL explícita, preferencialmente HTTPS.

O PostgreSQL instalado e a API ficam neste computador, então DATABASE_URL usa localhost:5432. Esse endereço independe do IP da rede. Após uma queda de energia, confirme que o PostgreSQL, a API e o Expo voltaram a funcionar. Também é possível reservar o IP do computador no DHCP do roteador.

O auxiliar scripts/start-dev.ps1 respeita -DatabaseUrl ou DATABASE_URL e prefere o PostgreSQL já ativo na porta 5432. Só usa Docker ou a instalação portátil quando não existe conexão configurada nem servidor nessa porta. Sem -ApiUrl, preserva a configuração lida pelo Expo em mobile/.env; não impõe localhost ao celular.

Para testar no navegador, use npx expo start --web. Depois de trocar a URL, reinicie o Expo. A API e o Expo devem rodar ao mesmo tempo. npx expo run:android compila um aplicativo Android local; expo start é o comando para usar Expo Go.

## Navegação

As seções principais formam uma navegação circular. Arraste para a direita para avançar: Início → Alunos → Financeiro → Turmas → Mais → Início. Arraste para a esquerda para percorrer o sentido contrário, inclusive de Início para Mais. O portal do aluno segue Mensalidades → Presenças → Meu código → Mensalidades.

O botão Voltar e o gesto de retorno do Stack foram removidos. O conteúdo acompanha o dedo na mesma direção, mostrando a página vizinha durante o arraste. Segurar o dedo não muda a rota: é necessário soltar após percorrer pelo menos 55% da largura da página. Arrastes curtos ou desfeitos voltam à posição inicial; a velocidade sozinha não confirma a troca. Uma animação curta termina o encaixe. As trocas substituem a rota atual, mantendo o histórico limitado mesmo depois de várias voltas. Os ícones inferiores continuam oferecendo acesso direto.

Campos de texto e rolagem vertical não trocam a seção. Cadastros e mensalidades de detalhe não participam do ciclo; use os ícones inferiores para abrir a lista desejada.

## Fluxo do gestor e do aluno

1. Crie uma conta e uma academia, ou entre na academia já cadastrada.
2. Em Alunos, cadastre nome, contato, faixa e modalidades. Selecione um plano opcional ou defina o valor mensal total.
3. Preencha vencimento, competência inicial e dados do pagador; ative a cobrança. A primeira mensalidade é criada imediatamente e as próximas no início de cada mês, enquanto a API estiver funcionando. Reiniciar recupera competências pendentes.
4. Gere o convite e envie o link ao aluno pelo canal de sua escolha. O convite dura sete dias e é aceito uma única vez.
5. O aluno abre o link no navegador, cria uma conta ou faz login e aceita. Seu portal mostra somente suas mensalidades, presenças e código.
6. Após configurar o Asaas, o aluno abre a mensalidade e usa Pix. A confirmação depende de consulta ao provedor, webhook e reconciliação.
7. Em Turmas, configure modalidade e horários. Professor vinculado é opcional. O gestor abre o horário correspondente ao dia e encerra a aula.
8. No tablet, entre como gestor e ative o modo tablet em Mais. Isso substitui a sessão pessoal por uma credencial de dispositivo. Selecione a aula aberta e leia o QR ou digite o código numérico.
9. Confira a presença no tablet, na lista da aula e no histórico do aluno. Débito financeiro não bloqueia treino automaticamente.

Inativar um aluno interrompe futuras mensalidades e check-ins. Históricos e débitos permanecem. Para retomar a cobrança, indique a competência atual ou futura. Dias 29, 30 e 31 são limitados ao último dia disponível do mês.

## Pix com Asaas

A integração usa a conta Asaas da própria academia. Leia [ASAAS.md](docs/ASAAS.md) para habilitar sandbox e configurar o webhook. Sem credenciais, o sistema continua utilizável e informa que Pix não está habilitado. Chaves e tokens ficam exclusivamente no servidor.

Os testes automatizados simulam o Asaas. Recebimento real exige credenciais de produção, conta liberada e webhook HTTPS público. Homologação com credenciais reais ainda precisa ser feita.

## Portal web e links

    cd mobile
    npm run export:web

O export fica em mobile/dist. Ao iniciar o Go a partir de backend, a API detecta ../mobile/dist e serve o portal automaticamente. WEB_DIST_DIR permite escolher outro diretório. EXPO_PUBLIC_API_URL deve apontar para a API e EXPO_PUBLIC_PORTAL_URL para o endereço web público usado nos convites e links de mensalidade. Configure essas URLs antes de exportar.

O servidor Go entrega a página inicial para /invite/{token} e /pay/{academy}/{invoice}, preservando os links após login. Também é possível hospedar o export em outro servidor com fallback para index.html. Publicação pública não foi realizada nesta entrega.

## Dados de demonstração

Em uma base de desenvolvimento, execute go run ./cmd/seed dentro de backend. Isso adiciona duas academias, alunos, modalidades, plano Essencial, mensalidades locais e uma aula do dia. Não faz chamadas ao Asaas.

| Conta | Acesso |
|---|---|
| gestor@tatame.demo | Gestor das duas academias |
| aluno@tatame.demo | Aluno nas duas academias |
| ana@tatame.demo | Aluna nas duas academias |

Senha de demonstração: Tatame123!. O seed pode ser repetido e preserva cadastros e mensalidades já configurados. Use somente em desenvolvimento. Alunos migrados comuns continuam sem cobrança automática; a ativação feita pelo seed se restringe às contas de demonstração.

## Android

O APK interno está em [artifacts/Tatame-arm64.apk](artifacts/Tatame-arm64.apk). A API de desenvolvimento embutida é http://192.168.15.5:8080. Mantenha o servidor ativo e o celular/tablet na mesma rede. A instalação, a câmera e os fluxos em aparelhos físicos ainda precisam ser verificados.

Para recompilar com as ferramentas preparadas neste computador:

    powershell -ExecutionPolicy Bypass -File scripts/build-apk.ps1 -ApiUrl http://IP_DO_COMPUTADOR:8080

Alternativa com conta Expo: npx eas-cli build --platform android --profile preview dentro de mobile. HTTPS e uma URL estável são necessários para distribuição pública.

## Arquitetura e verificações

- backend/cmd/api: inicialização, migrações e worker de cobrança/reconciliação.
- backend/internal/students: alunos, modalidades, planos e convites.
- backend/internal/billing: geração mensal e snapshots das mensalidades.
- backend/internal/payments: cliente Asaas, emissão, webhook e reconciliação.
- backend/internal/attendance: check-in transacional e históricos.
- mobile/src/app: rotas Expo Router; mobile/src/features: telas e lógica.
- [OpenAPI](docs/openapi.json), [arquitetura](docs/ARCHITECTURE.md), [migração](docs/MIGRATION.md), [validação](docs/VALIDATION.md).

No backend, go test ./... e go vet ./.... TEST_DATABASE_URL habilita os testes com um banco PostgreSQL exclusivo de testes. MIGRATION_DATABASE_URL deve apontar para uma base nova e vazia para testar a conversão desde a versão 001. Nunca use seu banco principal para esses testes.

No mobile, npm run typecheck, npm run lint e npm run export:web. O laboratório offline permanece separado em tools/offline-lab.

Cartão, boleto, débito automático, contratos, WhatsApp automático, área de professor, offline, iOS e publicação nas lojas continuam fora desta versão.
