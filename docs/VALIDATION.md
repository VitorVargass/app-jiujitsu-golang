# Validação da versão de gestão da academia

Verificação local em 8 de outubro de 2026. A integração de pagamentos desta entrega usa Asaas.

## Preservação dos dados

- Backup do PostgreSQL local original salvo em artifacts/backups/tatame-before-academy-20261008-170815.dump.
- Backup restaurado em uma base separada e migração 002 aplicada com sucesso.
- Teste de migração desde 001 em outro banco vazio confirmou preservação de presença, código numérico, QR e vínculo da conta.
- Alunos migrados não recebem cobranças retroativas nem ativação automática de mensalidades.
- Na implementação inicial, o banco original não recebeu o seed ou os dados de validação. Na revisão de conexão e navegação, ele já estava na migração 002. Um novo backup foi salvo em artifacts/backups/tatame-before-navigation-20261008-213854.dump antes dessa revisão; os testes de interface continuaram na cópia separada.

## Backend

go test ./... -count=1 e go vet ./... passaram. Os testes de integração usaram PostgreSQL 17 real, em bancos exclusivos de testes; as chamadas Asaas usaram servidor HTTP simulado.

Cobertura verificada:

- Cadastro independente de aluno, várias modalidades, plano opcional e dados do pagador.
- Primeira mensalidade, alteração de valores sem modificar cobrança emitida e vencimentos limitados ao último dia do mês.
- Execuções simultâneas da geração mensal sem duplicação por aluno/academia/competência.
- Convite individual, aceitação única, revogação, titularidade e isolamento entre academias.
- Emissão Pix com perda da resposta e recuperação pela referência sem criar outro pagamento.
- Conferência de tipo PIX, valor, identificador e referência consultados no provedor.
- Webhook com token inválido recusado, valor divergente sem baixa e eventos repetidos produzindo um único recebimento.
- Reconciliação independente do webhook.
- Aluno inativo conserva mensalidades e histórico; retomada da geração exige competência atual ou futura.
- Turma com modalidade e sem professor obrigatório.
- Check-in exclusivamente por dispositivo autorizado, inclusive para aluno ainda sem conta.
- Doze registros simultâneos, reenvio após perda de resposta e conflito de Idempotency-Key.
- Dispositivo revogado, aluno inativo e aula encerrada recusados.
- Portal Go com fallback para links de convite/pagamento; rotas da API e arquivos ausentes preservam seus erros.

O teste específico de migração foi executado com MIGRATION_DATABASE_URL apontando para banco novo. Sem essa variável, ele é explicitamente ignorado. Nunca aponte os testes ao banco principal.

## Frontend e fluxo no navegador

npm run typecheck e npm run lint passaram sem erros ou avisos. O export web foi gerado com sucesso.

Em navegador com largura de celular foram verificados:

1. Login do gestor, seleção da academia e financeiro.
2. Cadastro de Maria Validação, sem conta, com duas modalidades e mensalidade de R$ 210,50.
3. Geração do convite, cadastro da conta em sessão separada e aceitação do vínculo.
4. Portal do aluno exibindo somente sua mensalidade e seu QR/código.
5. Link direto de mensalidade no portal servido pelo Go, com retorno à cobrança após login.
6. Habilitação do tablet, substituindo a sessão pessoal pela credencial do dispositivo.
7. Check-in pelo código numérico, confirmação e presença no histórico pessoal.

Não foram registrados erros JavaScript pelo navegador nesse fluxo. Imagem da interface final: artifacts/validation/historico-aluno.png.

Os testes automatizados verificam a confirmação bancária simulada. A configuração local não contém credenciais reais de pagamento.

## Arquivos de entrega

- artifacts/tatame-api.exe: executável Windows da API.
- mobile/dist e artifacts/tatame-web.zip: portal web exportado.
- artifacts/Tatame-arm64.apk: Android interno, arm64-v8a, com API de desenvolvimento em http://192.168.15.6:8080.
- artifacts/Tatame-arm64.apk.sha256: hash da versão final.

O build Android local Gradle terminou com sucesso, incluindo Expo Clipboard e fontes locais. Após os últimos ajustes de interface, o bundle Hermes foi gerado pelo Expo, incorporado ao APK, alinhado e assinado novamente. A assinatura v2/v3 e o alinhamento de 16 KiB foram verificados com as ferramentas Android SDK.

SHA-256 do APK:

    9d986d666134e3e0d6a7deacdd804975a50d8162f38728abbe41f6427ff73273

O APK usa assinatura de desenvolvimento e se destina ao teste interno. A API local e a versão web devem ser reiniciadas para utilizar o código atualizado.

## Revisão da interface

O cabeçalho agora reúne o nome e o perfil junto de Trocar, fora do conteúdo das telas. A navegação inferior usa ícones, rótulos pequenos e destaque da seção, inclusive nas rotas de detalhe.

A tela de alunos apresenta Novo aluno junto do título, busca com ícone, filtros de modalidade recolhidos, estados em abas e linhas clicáveis no lugar de botões repetidos. A paginação aparece somente quando há mais de uma página. O dashboard tem menos ações repetidas e cartões com alturas uniformes.

Verificados no navegador: larguras de 320 e 390 pixels, busca, limpeza da busca, filtros, estado vazio, abertura de cadastro existente, Novo aluno, navegação do gestor e do aluno. TypeScript e lint passaram. A versão web e o APK foram atualizados após essa revisão; assinatura v2/v3 e alinhamento de 16 KiB do APK passaram.

Prévias: artifacts/validation/alunos-design.png, artifacts/validation/alunos-design-320.png e artifacts/validation/aluno-navegacao-design.png.

## Revisão de conexão e navegação

Após a queda de energia, o computador passou de 192.168.15.6 para 192.168.15.5. O frontend estava com o endereço antigo na inspeção inicial; mobile/.env agora aponta para o novo IP. O PostgreSQL 18 local responde na porta 5432 e a API responde em /healthz por localhost e pelo IP da rede. O endpoint de login retorna invalid_credentials para uma conta diagnóstica inexistente, confirmando que a requisição alcança a API e o banco; a senha da conta pessoal não foi utilizada.

O cliente aceita EXPO_PUBLIC_API_URL=auto no desenvolvimento pelo Expo, preservando URLs explícitas. Foram verificados descoberta após mudança de IP, navegador, fallback do emulador e manutenção da URL explícita em builds. O inicializador passou na análise sintática PowerShell e foi executado com os serviços existentes, sem iniciar um segundo PostgreSQL.

A navegação usa um carrossel de três páginas reais: anterior, atual e próxima. A página acompanha o deslocamento horizontal do dedo em proporção 1:1, e a vizinha entra pelo mesmo lado. Arrastar para a direita avança Início → Alunos → Financeiro → Turmas → Mais → Início; para a esquerda, percorre o sentido contrário. O aluno segue Mensalidades → Presenças → Meu código → Mensalidades.

A troca exige soltar após percorrer pelo menos 55% da largura da página. A velocidade não confirma um arraste curto. Segurar, mesmo depois do limite, não altera a rota. Recuar antes de soltar cancela a troca. Ao soltar, uma animação entre 110 e 200 ms termina o encaixe ou retorna ao centro; a rota só é substituída depois do encaixe. O cabeçalho e a navegação inferior permanecem fixos. O botão Voltar e o gesto de dismiss do Stack continuam removidos, com replace e animation: none nas rotas principais.

Com API e PostgreSQL separados dos dados pessoais, eventos de toque via Chrome DevTools verificaram:

- Arraste rápido de 60 pixels e arraste de 165 pixels cancelados numa página de 390 pixels.
- Deslocamento acompanhando o dedo e página vizinha posicionada ao lado da atual.
- Pausa de 700 ms com arraste de 305 pixels sem mudar a rota antes de soltar.
- Arraste que atravessa o limite e volta para 60 pixels cancelado.
- Segundo toque durante o retorno ou durante a substituição da rota sem causar uma troca adicional.
- Ciclo completo do gestor e do aluno nos dois sentidos, sem crescimento do histórico.
- Rolagem vertical e interação em campo de texto sem trocar a seção; dois dedos cancelam a tentativa.
- Arraste sobre linha de aluno sem abrir o cadastro; toque no cadastro após o encaixe abre o detalhe.
- Mudança de largura durante o arraste cancelando e recentralizando o conteúdo; navegação funcionando também em 320 pixels.
- Rotas de detalhe fora do carrossel e ausência do botão Voltar.

TypeScript e lint passaram sem erros ou avisos. Nenhum erro JavaScript foi registrado nas sessões de validação. A medição no navegador verifica o comportamento funcional; não mede a fluidez num aparelho físico.

A versão web foi exportada novamente. O APK conserva seus módulos nativos e atualiza o bundle Hermes, sem novas dependências nativas. A comparação com nomes sensíveis a maiúsculas e minúsculas confirmou 1.215 arquivos nativos e de mídia inalterados, desconsiderando bundle e assinatura. A assinatura v2/v3 e o alinhamento de 16 KiB foram verificados. O APK anterior foi preservado em artifacts/Tatame-before-pager-20261008.apk. O endereço embutido permanece http://192.168.15.5:8080.

Os Stacks de autenticação e aplicação desabilitam gestureEnabled e a animação de transição. Não houve teste em aparelho iOS ou Android físico.

Prévias desta revisão: artifacts/validation/pager-held.png e artifacts/validation/pager-student.png.

## Configuração automática do Expo Go — 14/10/2026

Nesta inspeção, o computador estava em 192.168.15.6 e mobile/.env ainda usava 192.168.15.5. O arquivo local agora usa EXPO_PUBLIC_API_URL=auto. O cliente identifica o host do Expo com expoConfig.hostUri e usa expoGoConfig.debuggerHost como alternativa. URLs explícitas continuam prevalecendo.

A API e o seed agora carregam backend/.env com godotenv; variáveis do processo têm prioridade. A conexão local existente foi preservada com localhost:5432, e HTTP_ADDR=:8080 mantém acesso pela rede. ALLOWED_ORIGINS=auto identifica as origens web locais ao iniciar. O script de desenvolvimento respeita os dados salvos no arquivo e inicia Expo em modo LAN. O novo scripts/start-dev.cmd oferece uma entrada por duplo clique.

Evidências desta revisão:

| Etapa | Resultado |
|---|---|
| Descoberta do endereço | Testes da função resolveram três IPs diferentes sem editar a configuração, além de navegador, emulador e URL explícita |
| Manifesto Android do Expo pela LAN | hostUri e debuggerHost apontaram para 192.168.15.6:8081 |
| API e PostgreSQL | /healthz devolveu status ok tanto por localhost quanto pelo endereço atual da rede |
| Login pela API | Uma conta diagnóstica inexistente recebeu 401 invalid_credentials |
| App no navegador | Após reiniciar o Expo, o log mostrou API http://localhost:8080; o formulário exibiu “E-mail ou senha incorretos.” em vez de erro de conexão |
| Backend | go test ./... -count=1, go vet ./... e compilação da API passaram |
| Frontend | TypeScript e lint passaram |
| Inicializador | Análise sintática e execução com os serviços existentes passaram, reutilizando PostgreSQL e API |

O processo Expo anterior ainda mantinha o IP antigo. Ele foi reiniciado para carregar o preset automático, preservando a API e o PostgreSQL que estavam saudáveis. O executável Windows da API foi recompilado. Os testes não criaram contas nem usaram a senha pessoal do usuário.

Não houve teste no celular físico nesta revisão. No Expo Go, é necessário fazer um Reload completo ou reabrir o projeto pelo endereço/QR atual. O modo auto depende da mesma rede local; APKs e exports de produção continuam exigindo uma URL explícita.

## Cadastros por etapas — 15 de outubro de 2026

Implementados cinco passos no aluno (identificação, modalidades, mensalidade, pagador e revisão), faixa visual independente por modalidade, telefone alternativo e cobrança por modalidades ou pacote de plano. Planos, modalidades, turmas e horários também usam etapas com revisão antes da gravação.

Validação desta revisão:

- go test ./... -count=1 com PostgreSQL 17 real em bancos exclusivos de testes e go vet ./... passaram. O teste de migração usou uma base nova desde a 001; o fluxo novo cobre valores por modalidade, plano, validações, isolamento entre academias e manutenção de mensalidades já emitidas.
- TestRestoredCopyMigration passou numa cópia restaurada do banco local, em PostgreSQL 18 isolado na porta 55433. Assinaturas dos dados anteriores de dez tabelas permaneceram iguais após a 003. O backup está em artifacts/backups/tatame-before-wizard-20261015-031612.dump.
- Um aluno com Jiu-Jitsu Azul e No-Gi Roxa manteve as graduações independentes. Check-in, lista da aula e histórico apresentaram a faixa correspondente à modalidade da turma.
- No navegador, os passos conservaram dados ao voltar, validaram nome e documento, somaram R$ 150 + R$ 90 numa única mensalidade de R$ 240 e criaram um contrato por plano de R$ 200. Nenhum aluno foi salvo antes da revisão final; cancelar uma edição não alterou o registro.
- Um plano, uma modalidade com graduação personalizada, uma turma e um horário semanal foram criados na base isolada. A modalidade personalizada manteve as cores escolhidas. O horário foi confirmado pela API como 18:30 e duração de 60 minutos.
- Telas inspecionadas em 390 e 320 pixels, incluindo seletor visual de faixas e revisão. Prévias: artifacts/validation/wizard-modalities.png, wizard-review.png e wizard-review-320.png.
- O teste de regressão do carrossel passou para segurar, recuar, arraste curto rápido, limite de confirmação, sentidos, ciclo, rolagem vertical, campos e toque na lista de alunos. Os formulários de turmas permanecem montados ao desativar o arraste durante a edição.
- TypeScript, lint e formatação dos formulários passaram. Web e bundle Android Hermes versão 98 foram exportados. O APK atualizado passou na assinatura v2/v3 e no alinhamento de 16 KiB.
- O executável preparado está em artifacts/tatame-api.exe; o portal em mobile/dist e artifacts/tatame-web.zip; o APK em artifacts/Tatame-arm64.apk. API de desenvolvimento dos exports: http://192.168.15.6:8080.

A ativação foi autorizada explicitamente pelo usuário em 15 de outubro de 2026. Novo backup completo validado: artifacts/backups/tatame-before-wizard-activation-20261015-010445.dump. A migração 003 foi aplicada ao banco local tatame; as assinaturas dos dados anteriores das dez tabelas permaneceram iguais antes/depois. A API foi reiniciada e /healthz respondeu ok por localhost e por http://192.168.15.6:8080; o portal retornou HTTP 200. O bloqueio anterior da revisão automática foi resolvido pela autorização. Os testes funcionais com criação de registros continuaram restritos aos bancos isolados. Não houve teste em aparelho físico nesta revisão.

## Revisão de cores e cards — 15 de outubro de 2026

Tema atualizado com fundo azul-escuro, destaque verde-menta e acentos azul, âmbar, lavanda e coral. Aplicado em botões, campos com foco, etapas, cabeçalho, navegação, alunos, financeiro e menus de Mais. O dashboard tem ícones, valores destacados, indicação de ação e atalho compacto para cadastro.

No navegador, todos os cards do início abriram o destino correspondente: alunos, financeiro, histórico, gráfico, lista da aula e cadastro de aluno. O cartão inteiro recebe o toque. Os cards das mensalidades e os atalhos de Mais também abrem seus detalhes. Filtros do Financeiro preservados e recolhidos inicialmente para priorizar as cobranças.

TypeScript e lint passaram. Foram verificadas larguras de 320, 390 e 1280 pixels, sem transbordamento horizontal, além de foco dos campos e ativação dos cards com Tab/Enter. Em 320 pixels, os valores monetários ajustam o tamanho da fonte; R$ 1.280,00 foi exibido completo. O teste de toque do carrossel passou para arraste curto, segurar, recuar, ciclo, ambos os sentidos, rolagem vertical, multitoque, seleção de texto em campo, mudança de largura e toque no aluno. As prévias laterais do carrossel receberam inert somente na web para não capturarem o foco do teclado. A graduação e a cobrança não tiveram mudanças nesta revisão.

Prévias em artifacts/validation: design-colors-home-390.png, design-colors-home-320.png, design-colors-home-web.png, design-colors-chart-390.png, design-colors-finance-390.png, design-colors-students-390.png, design-colors-more-390.png e design-colors-form-390.png. Os dados exibidos são de um banco exclusivo de testes.

Web exportado em mobile/dist e artifacts/tatame-web.zip; APK atualizado em artifacts/Tatame-arm64.apk. Bundle Hermes 98 gerado com sucesso; assinatura v2/v3 e alinhamento de 16 KiB verificados. O APK anterior foi conservado em artifacts/Tatame-before-color-design-20261015.apk. API dos exports: http://192.168.15.6:8080. O export foi servido com HTTP 200 pela API isolada de testes. A API principal respondeu ok em /healthz; seu processo já estava sob controle do usuário e não foi reiniciado nesta revisão. Não houve teste em celular físico nesta revisão.

## Graus por faixa — 15 de outubro de 2026

Adicionado degrees ao vínculo aluno/modalidade: inteiro de 0 a 4, com zero para sem grau. O seletor visual mostra números e listras; a faixa escolhida e a revisão mostram o grau por modalidade. Mudar a faixa pelo formulário reinicia o seletor em zero. Lista de alunos, credencial e presenças também exibem os graus. As telas de presença mantêm a modalidade da aula como referência.

- go test ./... -count=1 com PostgreSQL 17 real, go vet ./... e compilação da API passaram. Foram verificados graus independentes, leitura após gravação, zero explícito, edição por cliente antigo sem apagar graus, mudança de faixa, limites inválidos, frações e graus em modalidade sem faixa.
- Check-in, lista da aula, histórico pessoal e credencial exibiram os graus corretos. O reenvio idempotente manteve a resposta original mesmo após alterar a graduação. Alterar graus não criou mensalidades.
- A migração 004 foi testada desde um banco antigo de teste e em duas cópias restauradas do banco local no PostgreSQL 18 isolado. A comparação final incluiu todas as colunas anteriores de dez tabelas; apenas a nova coluna degrees foi excluída da assinatura.
- No navegador, um aluno foi cadastrado com Jiu-Jitsu Branca/2 graus e No-Gi Azul/4 graus. A escolha persistiu ao avançar, voltar e abrir a edição. A troca de faixa zerou os graus do seletor. Inspeção visual em 390 e 320 pixels, sem transbordamento. Não houve erros JavaScript.
- TypeScript e lint passaram. Web e bundle Android Hermes 98 foram gerados. O APK atualizado passou nas verificações de assinatura v2/v3 e alinhamento de 16 KiB.

Ativação local concluída com backup em artifacts/backups/tatame-before-degrees-activation-20261015-154128.dump. A 004 foi aplicada ao banco tatame; as assinaturas dos dados anteriores das dez tabelas permaneceram iguais. API 2.2.0 saudável na porta 8080, inclusive pelo IP da rede; portal web retornou HTTP 200. Os registros de validação foram criados somente em bancos isolados.

Prévias: artifacts/validation/belt-degrees-selection-390.png, belt-degrees-selection-320.png e belt-degrees-review-390.png. Entregas atualizadas em artifacts/tatame-api.exe, artifacts/tatame-web.zip e artifacts/Tatame-arm64.apk; o APK anterior está em artifacts/Tatame-before-degrees-20261015.apk. Não houve teste em aparelho físico nesta revisão.


## CPF e ciclo de vida — 15 de outubro de 2026

- Suíte Go completa com PostgreSQL 17 real e go vet passaram. CPF com e sem máscara foi validado; inválidos foram recusados. A unicidade inclui arquivados e respeita a academia.
- CPF e QR simultâneos geraram uma presença. Reenvio conservou a resposta; chave com dados diferentes foi recusada. Tentativas antigas por código conservaram o hash após adicionar CPF. O tablet não recebe CPF no resultado.
- Arquivar bloqueou presença, ocultou o aluno da lista principal e desativou cobrança. Busca por CPF e aba Arquivados localizaram o cadastro. O gerador numa data futura não criou dívidas do arquivado. O titular ainda consultou cobranças e histórico. Restaurar conservou ID, QR, código e débitos, sem ativar cobrança. Restauração repetida de aluno ativo não alterou contrato.
- Excluir turma cancelou aulas abertas, bloqueou reativação e novos horários/aulas e conservou presenças antigas. Alunos e gestores de outra academia não puderam arquivar/excluir.
- Migração 005 passou desde base antiga e em cópia do PostgreSQL 18. Na ativação local, backup e comparação confirmaram os dados anteriores de 12 tabelas.
- TypeScript e lint passaram. No navegador: cadastro com CPF, validação, cancelamento/confirmação de arquivamento, filtros, busca, restauração e exclusão de turma. No tablet simulado: CPF, recusa de arquivado e nova tentativa após restauração sem duplicar. Larguras 320, 390 e 768 sem transbordamento e nenhum erro JavaScript.
- Web e bundle Android Hermes 98 gerados. APK interno com assinatura v2/v3 e alinhamento de 16 KiB verificados. Backup: artifacts/Tatame-before-cpf-20261015.apk. Entregas em artifacts/Tatame-arm64.apk, artifacts/tatame-web.zip e artifacts/tatame-api.exe.

API 2.3.0 reiniciada e saudável por localhost e rede; portal HTTP 200. Nenhum cadastro real foi arquivado/excluído na validação. Capturas em artifacts/validation: cpf-identification-390.png, student-archive-confirmation-390.png, students-archived-390.png, students-archived-320.png, student-restored-390.png, class-delete-confirmation-390.png, cpf-kiosk-768.png, cpf-kiosk-success-768.png, cpf-kiosk-archived-768.png e cpf-kiosk-success-390.png. Teste em aparelho físico e câmera continua pendente.


## Turmas e agenda semanal em lote — 15 de outubro de 2026

- A suíte Go passou com PostgreSQL 17 real; go vet também passou. Foram verificados criação e edição com vários dias/horários, resposta/listagem com grade completa, repetição sem duplicar horários, identidade dos horários conservados, validação e isolamento de academia.
- Erros de banco forçados após inserir/editar a turma desfizeram tanto os metadados quanto os horários, sem turma órfã ou grade parcial.
- Remover um horário da grade impediu nova abertura por ele, preservando aula já aberta e presença. O cadastro individual legado conseguiu restaurar o mesmo horário/ID e recusou duplicação. PATCH sem schedules conservou a grade.
- Migração 006 passou desde banco antigo e em cópia restaurada do PostgreSQL 18. A ativação local teve backup e comparação dos dados anteriores de 13 tabelas, sem mudanças.
- No navegador, o formulário criou oito horários de uma vez: seg/qua/sex às 19h e 20h; sábado às 9h e 10h30. Edição alterou três horários para 21h sem duplicar. Menu compacto, pausa/reativação e acesso às presenças da aula aberta passaram.
- Inspeção visual e fluxo em 320, 390 e 1280 pixels, sem transbordamento horizontal. Duas colunas no desktop, dias e horários agrupados em cards no celular. Nenhum erro JavaScript. TypeScript e lint passaram.
- Web, API e APK interno atualizados. Bundle Hermes 98, assinatura v2/v3 e alinhamento de 16 KiB verificados. Backup do APK anterior: artifacts/Tatame-before-weekly-20261015.apk.
- API 2.4.0 saudável por localhost e IP da rede; portal web HTTP 200. Os testes de cadastro/edição usaram somente a base isolada.

Capturas em artifacts/validation: weekly-create-390.png, weekly-create-320.png, weekly-list-390.png, weekly-list-desktop.png, weekly-options-390.png, weekly-create-desktop.png e weekly-today-390.png. Teste no aparelho físico continua pendente.


## Perfil do aluno e aparelhos de check-in — 15 de outubro de 2026

- Perfil com seções e lápis de edição para contato, graduação, mensalidade e pagador; arquivamento no menu. Alteração de modalidades/plano abre a etapa correspondente do formulário.
- Nova operação de graduação altera somente a modalidade selecionada e o fallback legado, sem reescrever contrato nem chamar o gerador de mensalidades. Suíte Go passou com PostgreSQL real, incluindo cursor financeiro atrasado, graus independentes, valores inválidos, aluno arquivado e isolamento de academia. go vet passou.
- Acessos de check-in mostram a data de ativação e separam autorizados/encerrados. Ativação informa a troca de sessão e pede confirmação. Sair do check-in encerra a credencial do próprio aparelho no servidor; encerramento remoto também pede confirmação.
- Testes Go comprovaram que um aparelho encerra apenas seu acesso, não pode encerrar acesso em outra academia, fica sem autenticação após sair e não interfere em outro aparelho ou na sessão pessoal do gestor.
- No navegador, edição de graduação preservou contrato e cobranças; edição de mensalidade e vencimento manteve valores emitidos; contato/pagador foram alterados em separado, preservando o CPF do aluno. A troca de plano manteve graus e débitos. Arquivamento e restauração também passaram.
- Preparação do check-in, cancelamento da ativação, saída confirmada, cancelamento da saída, encerramento remoto e histórico de acessos passaram. Layouts 320, 390 e 1280 sem transbordamento; nenhum erro JavaScript. TypeScript e lint passaram.
- Não há migração nova: esquema permanece na versão 006. API 2.5.0 ativada após backup em artifacts/backups/tatame-before-profile-activation-20261015-175956.dump e comparação de todos os dados de 15 tabelas, incluindo dispositivos e sessões pessoais. Assinaturas permaneceram iguais.
- API saudável por localhost e rede; portal HTTP 200. Web, API e APK atualizados. Bundle Hermes 98, assinatura v2/v3 e alinhamento de 16 KiB verificados. APK anterior conservado em artifacts/Tatame-before-profile-20261015.apk.

Capturas em artifacts/validation: student-profile-390.png, student-profile-320.png, student-profile-desktop.png, student-rank-edit-390.png, student-billing-edit-390.png, more-checkin-390.png, checkin-accesses-390.png, checkin-help-expanded-390.png, checkin-activation-390.png, checkin-ended-390.png e checkin-ended-320.png. Todos os cadastros e encerramentos de validação usaram banco isolado. Teste em aparelho físico continua pendente.

## Matrícula, presenças no perfil e responsável de menor — 15 de outubro de 2026

- Perfil nas abas Matrícula, Presenças e Dados. Matrícula conecta modalidades/valores individuais ou pacote do plano ao total mensal. Graduação tem seção própria e edição direta.
- Presenças mostra total, último check-in, turma, modalidade, horário da aula e data/hora do registro, com filtro mensal e paginação. Continua exclusiva a dispositivos autorizados a gravação da presença.
- Novo cadastro exige nascimento. Adulto segue quatro etapas e usa nome/CPF próprios; menor segue cinco, com responsável financeiro. Campos do responsável aparecem apenas para menores. A API também aplica a regra.
- Suíte Go completa passou com PostgreSQL real: adulto/menor, nascimento omitido/inválido/futuro, preservação por cliente antigo, responsável diferente do menor, transição aos 18 anos no gerador, mensalidades emitidas imutáveis, turma excluída, aluno arquivado, isolamento e paginação. Limites de mês em UTC foram conferidos no fuso da academia. go vet passou.
- Migração 007 passou desde a 001 e numa cópia restaurada do PostgreSQL 18. Ativação local após backup e comparação de dados anteriores de 15 tabelas: assinaturas iguais. Ver MIGRATION.md.
- No navegador, adulto e menor foram cadastrados até a emissão da mensalidade. Edição de valor preservou mensalidade emitida; troca de modalidades para plano mostrou pacote e valor único. Check-in enviado pelo tablet apareceu no perfil. Filtros, vazio e duas páginas de 27 presenças passaram.
- Layouts 320, 390 e 1280 sem transbordamento e sem erros JavaScript. TypeScript e lint passaram. API 2.6.0 saudável por localhost e rede; portal HTTP 200.
- Web, API e APK interno atualizados. Bundle Hermes 98, assinatura v2/v3 e alinhamento de 16 KiB verificados. APK anterior: artifacts/Tatame-before-enrollment-20261015.apk. SHA-256 do novo: 30716ef702d49a3395eef52974df03351cccd5b99df980be1dbd53b479e6924a.
- Capturas em artifacts/validation: student-contract-390.png, student-contract-320.png, student-contract-desktop.png, student-guardian-390.png, student-identification-age-390.png, student-plan-390.png, student-attendances-390.png, student-attendances-empty-390.png, student-attendances-pagination-390.png, student-attendances-320.png e student-attendances-desktop.png. Dados fictícios somente nos bancos isolados. Teste físico permanece pendente.

## Verificações ainda necessárias

- Homologar Pix com credenciais sandbox reais da academia e webhook HTTPS acessível.
- Conferir confirmação, vencimento e reemissão com eventos reais do Asaas antes de produção.
- Instalar o APK em celular/tablet Android e verificar câmera, QR, teclado, rotação, retorno do segundo plano e gestos.
- Testar a navegação circular e a remoção do retorno por gesto em iPhone físico com Expo Go ou desenvolvimento iOS.
- Testar queda de rede durante envio no aparelho, incluindo conservação da tentativa e ausência de confirmação antecipada.
- Configurar endereço público estável, HTTPS e credenciais de produção antes de publicação.

Não houve aparelho Android conectado nem credenciais reais do Asaas disponíveis. A validação no navegador e no servidor simulado não substitui essas etapas.
