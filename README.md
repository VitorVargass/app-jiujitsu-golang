# Tatame — gestão da academia

API Go, PostgreSQL e aplicativo React Native/Expo com portal web do aluno. Esta versão inclui alunos independentes de contas, modalidades, planos opcionais, geração mensal, Pix Asaas e presenças exclusivamente pelo tablet. A interface usa preto, branco e cinza, com Montserrat e Lato, inspirada na [Checkmat](https://checkmatbrasil.com.br/checkmat/#matriz).

## Começar com seu PostgreSQL local

O backend precisa de Go, PostgreSQL funcionando e um banco criado. Neste computador você já criou o banco tatame e o usuário tatame. O pgAdmin administra esse servidor; a API conecta diretamente ao PostgreSQL.

Configure a conexão uma única vez em backend/.env, usando backend/.env.example como modelo. O arquivo local deste computador já está configurado. Depois, no terminal CMD:

    cd /d C:\Users\vitor\Documents\App-jiujitsu\backend
    go run ./cmd/api

Use sua senha real se ela for diferente. Senhas com caracteres especiais na URL precisam ser codificadas. A API inicia em http://localhost:8080 e /healthz informa o estado.

go run compila e executa o pacote indicado. ./cmd/api contém main.go. Você executa o comando a partir de backend, onde está go.mod; não precisa manter o terminal na pasta do main.go. go run sozinho não indica o que executar. As migrações SQL estão incorporadas no programa e são aplicadas ao iniciar.

A API e o seed carregam backend/.env quando iniciados na pasta backend. Variáveis já definidas no terminal têm prioridade sobre o arquivo. DATABASE_URL usa localhost:5432 para o PostgreSQL instalado no mesmo computador; HTTP_ADDR=:8080 permite acesso pela rede local. ALLOWED_ORIGINS=auto identifica as origens web locais do Expo ao iniciar a API. Em produção, configure as origens explicitamente. Deixe o terminal aberto enquanto a API estiver rodando; após atualizar o backend, pare e execute novamente.

Antes da primeira execução desta versão em uma base existente, conserve o backup e siga [MIGRATION.md](docs/MIGRATION.md). A nova migração conserva históricos e não ativa cobranças para alunos antigos.

## Rodar o frontend

Em outro terminal:

    cd /d C:\Users\vitor\Documents\App-jiujitsu\mobile
    npm install
    npx expo start --lan

O frontend está em mobile. O arquivo mobile/.env já usa EXPO_PUBLIC_API_URL=auto: no Expo Go, o app identifica o computador que serve o projeto e conecta à API na porta 8080. No navegador, usa o hostname da página. O endereço da rede pode mudar sem editar o arquivo. O PostgreSQL continua acessível somente pelo backend; o celular nunca precisa da senha do banco.

Para desenvolvimento na mesma rede, EXPO_PUBLIC_API_URL=auto descobre o computador pelo endereço do Expo Go; no navegador, usa o hostname da página e a porta 8080. Isso acompanha mudanças de IP após reiniciar o roteador. Uma URL explícita sempre tem prioridade. O túnel do Expo não publica a API; ambos os aparelhos precisam alcançar o servidor na rede local. APKs e exports de produção precisam de uma URL explícita, preferencialmente HTTPS.

O PostgreSQL instalado e a API ficam neste computador, então DATABASE_URL usa localhost:5432. Esse endereço independe do IP da rede. Após uma queda de energia, confirme que o PostgreSQL, a API e o Expo voltaram a funcionar. Também é possível reservar o IP do computador no DHCP do roteador.

Para iniciar com menos etapas no Windows, abra a pasta scripts e dê dois cliques em start-dev.cmd. O auxiliar confere a API, inicia Go e Expo quando necessário e mostra o endereço atual para o Expo Go. Ele respeita -DatabaseUrl, DATABASE_URL ou a conexão em backend/.env, nessa ordem, e reutiliza o PostgreSQL instalado. Sem -ApiUrl, o Expo lê mobile/.env, incluindo auto. Serviços já abertos são reutilizados; depois de editar uma configuração, reinicie o serviço correspondente. Um processo Expo iniciado com uma variável antiga no terminal pode exigir reinício para limpar esse valor.

Para testar no navegador, use npx expo start --web. Após mudar uma configuração do frontend, faça um Reload completo no Expo Go; se o processo mantiver uma variável antiga, reinicie o Expo. Abra o projeto pelo QR/endereço atual, com celular e computador na mesma rede. A API e o Expo devem rodar ao mesmo tempo. npx expo run:android compila um aplicativo Android local; expo start é o comando para usar Expo Go.

## Navegação

As seções principais formam uma navegação circular. Arraste para a direita para avançar: Início → Alunos → Financeiro → Turmas → Mais → Início. Arraste para a esquerda para percorrer o sentido contrário, inclusive de Início para Mais. O portal do aluno segue Mensalidades → Presenças → Meu código → Mensalidades.

O botão Voltar e o gesto de retorno do Stack foram removidos. O conteúdo acompanha o dedo na mesma direção, mostrando a página vizinha durante o arraste. Segurar o dedo não muda a rota: é necessário soltar após percorrer pelo menos 55% da largura da página. Arrastes curtos ou desfeitos voltam à posição inicial; a velocidade sozinha não confirma a troca. Uma animação curta termina o encaixe. As trocas substituem a rota atual, mantendo o histórico limitado mesmo depois de várias voltas. Os ícones inferiores continuam oferecendo acesso direto.

Campos de texto e rolagem vertical não trocam a seção. Cadastros e mensalidades de detalhe não participam do ciclo; use os ícones inferiores para abrir a lista desejada.

## Fluxo do gestor e do aluno

1. Crie uma conta e uma academia, ou entre na academia já cadastrada.
2. Em Alunos → Novo aluno, avance por Identificação, Modalidades, Mensalidade, Pagador e Revisão. Nome, e-mail, celular e telefone alternativo ficam na primeira etapa; a faixa é escolhida visualmente para cada modalidade.
3. Escolha cobrança por modalidades ou por plano. Por modalidades, os valores individuais são somados em uma mensalidade; por plano, o pacote preenche as modalidades incluídas e o valor combinado. Configure vencimento, competência e pagador. A gravação ocorre somente na confirmação da revisão. A primeira cobrança é gerada ao ativar e as seguintes no início de cada mês, enquanto a API estiver funcionando.
4. Gere o convite e envie o link ao aluno pelo canal de sua escolha. O convite dura sete dias e é aceito uma única vez.
5. O aluno abre o link no navegador, cria uma conta ou faz login e aceita. Seu portal mostra somente suas mensalidades, presenças e código.
6. Após configurar o Asaas, o aluno abre a mensalidade e usa Pix. A confirmação depende de consulta ao provedor, webhook e reconciliação.
7. Em Turmas, configure modalidade e horários. Professor vinculado é opcional. O gestor abre o horário correspondente ao dia e encerra a aula.
8. No tablet, entre como gestor e ative o modo tablet em Mais. Isso substitui a sessão pessoal por uma credencial de dispositivo. Selecione a aula aberta e leia o QR ou digite o código numérico.
9. Confira a presença no tablet, na lista da aula e no histórico do aluno. Débito financeiro não bloqueia treino automaticamente.

Inativar um aluno interrompe futuras mensalidades e check-ins. Históricos e débitos permanecem. Para retomar a cobrança, indique a competência atual ou futura. Dias 29, 30 e 31 são limitados ao último dia disponível do mês.

## Cadastros por etapas

O componente FormWizard mantém os campos ao avançar e voltar, valida cada etapa e apresenta uma revisão antes de salvar. Ele é usado em alunos, planos, modalidades, criação/edição de turmas e horários semanais. Nos formulários de turma, o arraste entre seções fica desativado durante a edição.

Em Mais → Modalidades e planos, configure o valor mensal avulso e o sistema de graduação de cada modalidade. Há modelos de Jiu-Jitsu adulto, infantil e completo, além de lista personalizada com até três cores por graduação e opção sem faixas. Jiu-Jitsu e No-Gi guardam faixas independentes. Os modelos podem ser adaptados pela academia; referência visual: [graduações IBJJF](https://ibjjf.com/graduation-system).

Na cobrança por modalidades, a API calcula o total dos valores contratados, em centavos. Alterações no catálogo não reajustam contratos salvos ou mensalidades emitidas automaticamente. Por plano, prevalece o valor combinado para o pacote. Contratos antigos permanecem em “Manter valor atual” até o gestor escolher como reorganizá-los.

A migração 003 acrescenta faixa/valor por modalidade, telefone alternativo e forma de cobrança. Ela foi testada em bancos isolados e numa cópia restaurada do PostgreSQL 18 local. Após autorização explícita, foi aplicada ao banco local em 15 de outubro de 2026, com novo backup e comparação dos dados anteriores de dez tabelas. A API foi reiniciada e está saudável; no Expo Go, recarregue o projeto para usar os novos cadastros.

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

O APK interno está em [artifacts/Tatame-arm64.apk](artifacts/Tatame-arm64.apk). A API de desenvolvimento embutida é http://192.168.15.6:8080. Mantenha o servidor ativo e o celular/tablet na mesma rede. A instalação, a câmera e os fluxos em aparelhos físicos ainda precisam ser verificados.

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
