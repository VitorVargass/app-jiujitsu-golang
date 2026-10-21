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

## Identidade única e participação do gestor — 19 de outubro de 2026

- people armazena o único e-mail. Conta de login, participação na academia e matrícula comercial são separadas, com restrições compostas no PostgreSQL para manter a mesma identidade.
- Suíte Go completa com PostgreSQL 17 real passou, incluindo participação de gestor sem aluno ou dívida, CPF/QR, duas credenciais de tablet e reenvio, matrícula posterior sem duplicar a presença, conta errada no convite, aceite único, isolamento de academia e criação simultânea do mesmo e-mail. Formatos de contato como Nome <e-mail> são recusados para não criar identidade paralela. go vet passou.
- Migração 008 passou em banco vazio, desde o esquema 001 e em teste de conflito: sem aprovação explícita, a transação falha e permanece em 007; com associação revisada, conserva credencial, senha e sessão.
- A cópia restaurada no PostgreSQL 18 passou na simulação inicial dos dois casos e na revisão final: o e-mail de exemplo foi conservado na conta e removido do contato conflitante do aluno, sem vincular identidades por suposição. Apenas o vínculo próprio previamente revisado foi reaproveitado. Assinaturas de usuários, matrículas, academias, modalidades, contratos, mensalidades, turmas, agendas, aulas, dispositivos, sessões pessoais, presenças e eventos idempotentes foram conservadas.
- No navegador, CPF foi salvo no perfil pessoal e um check-in real de tablet apareceu no histórico sem criar matrícula nem novas mensalidades. Usar minha própria conta criou matrícula opcional reaproveitando identidade/participação/histórico, com cobrança desligada. E-mail de login ficou somente leitura. Outra identidade existente exigiu confirmação e continuou sem user_id até aceitar convite.
- Layouts finais 320, 390 e 1280 sem transbordamento. Nenhum erro JavaScript na sessão. TypeScript, lint e validação OpenAPI passaram. Capturas em artifacts/validation: participation-final-320.png, participation-final-390.png, participation-final-desktop.png, self-enrollment-390.png, student-identity-locked-390.png e reuse-identity-confirm-390.png.
- Web exportada em artifacts/tatame-web.zip. API nova compilada separadamente em artifacts/tatame-api-identity.exe; executável anterior preservado. APK interno atualizado com Hermes 98, assinatura v2/v3 e alinhamento 16 KiB; anterior em artifacts/Tatame-before-identity-20261019.apk. SHA-256 novo: 62b3397360b5032e211fafbd318ca7535e371b386f7a15a33a59aae304155a8f.
- Encerramento: API/Expo de validação e PostgreSQL 17/18 isolados foram parados. O Expo do usuário na porta 8081 foi preservado. A confirmação de administrador para parar o PostgreSQL principal foi cancelada no Windows; ele permanece Running com inicialização Manual.
- Ativação concluída no banco principal após a clarificação do usuário sobre os exemplos. Backup: artifacts/backups/tatame-before-identity-activation-20261019-144606.dump. Comparação de 19 projeções passou, incluindo a correção explícita do e-mail do contato. Versão 008, única coluna de e-mail e nenhuma duplicação verificadas. API 2.7.0: health ok, OpenAPI e portal HTTP 200. A verificação real de inicialização também conservou as 19 projeções. Credenciais externas do Asaas não foram usadas nesse teste.
- Executável padrão atualizado em artifacts/tatame-api.exe e .tools/tatame-api.exe, com anterior preservado. API temporária e PostgreSQL isolado encerrados ao finalizar. PostgreSQL principal permaneceu ligado/manual, como estava no início da ativação; Expo do usuário preservado. Teste em aparelho físico continua pendente.

## Proposta Noryk e nova tela de acesso — 19 de outubro de 2026

- Login/cadastro redesenhados com fundo grafite, acento verde-lima, monograma vetorial e campos com ícones. Layout em uma coluna no celular/tablet e duas no computador. Nome visível no Expo, cabeçalhos e instruções atualizado, sem mudar identificadores técnicos ou credenciais.
- Componentes AuthLayout, AuthField e AuthAction isolam a apresentação; o cliente HTTP e a persistência da sessão continuam compartilhados. A senha aparece/oculta pelo ícone no campo. Há foco visível, botões com área de toque adequada, validação de campos obrigatórios e bloqueio de envios simultâneos.
- No navegador, login/cadastro passaram em 320, 390, 768 e 1280 pixels, sem transbordamento. Testados formulário vazio, foco no campo inválido, mostrar/ocultar senha, Enter no teclado, credenciais incorretas, falha de rede simulada, nova tentativa, login real e logout.
- Cadastro iniciado por convite conservou o destino ao trocar entre login e cadastro; criou a conta com a mesma identidade do contato, aceitou o convite e abriu suas mensalidades. Testes somente em banco isolado, sem escrita no banco principal. Nenhum erro JavaScript na sessão.
- Capturas em artifacts/validation: noryk-login-320.png, noryk-login-390.png, noryk-login-tablet.png, noryk-login-desktop.png, noryk-login-invalid-390.png, noryk-login-network-390.png, noryk-register-320.png, noryk-register-390.png, noryk-register-tablet.png, noryk-register-desktop.png e noryk-academy-header-320.png.
- O site oficial do Registro.br informou noryk.com.br disponível para registro na consulta de 19 de outubro de 2026. O nome permanece uma proposta visual; a consulta de domínio é pontual.
- TypeScript e lint passaram. A exportação web de produção foi gerada e artifacts/tatame-web.zip atualizado. Validação em aparelho físico continua pendente, especialmente teclado e preenchimento automático. O APK anterior não foi recompilado nesta revisão visual.

## Cobrança clara e confirmação de convite — 19 de outubro de 2026

- Rótulos da interface usam “Mês de início da cobrança”, “Próxima mensalidade” e “Mês da mensalidade”; erros e mensagens de restauração acompanham essa terminologia. O contrato JSON/SQL conserva first_month/competence para compatibilidade.
- Novos formulários de aluno iniciam com cobrança marcada. Matrículas já existentes preservam sua configuração; inativação e restauração não ligam a cobrança. Caixa de seleção compartilhada com toque na área inteira, marca visível, estado acessível em React Native e web e bloqueio durante salvamento ou aluno inativo.
- GET autenticado do convite mostra apenas academia, aluno, validade e indicação de CPF presente, após conferir a identidade. POST aceita CPF opcional somente quando ausente. CPF já definido não pode ser substituído pelo convite. Corpo omitido continua funcionando para clientes anteriores.
- Aceitação bloqueia aluno/participante e depois convite na mesma ordem da edição/emissão, revalida validade e consome o token junto com o vínculo e CPF na mesma transação. Não muda plano, cobranças ou mensalidades. Não houve migração de esquema.
- Suíte Go completa passou com PostgreSQL 17 real em banco dedicado, além de go vet. Casos incluem identidade errada, isolamento entre academias, corpo com academia forjada, CPF inválido ou duplicado sem consumo, CPF normalizado, CPF opcional, links expirados/revogados/substituídos, aluno arquivado, tablet recusado e duas aceitações simultâneas com um sucesso e um 410.
- Navegador: novo aluno adulto com cobrança marcada, alternância da seleção, salvamento com uma mensalidade no mês atual e edição preservando o estado. Convite testado desde conta errada, cadastro/login mantendo destino, CPF existente protegido, CPF ausente com validação e repetição após falha de rede, acesso à academia correta e reabertura recusada após aceitação.
- Layout conferido em 320, 390 e 1280 px sem transbordamento horizontal. Capturas: noryk-billing-checkbox-320/390/desktop.png, noryk-invitation-cpf-320/390/desktop.png e noryk-invitation-used-cpf/locked.png, em artifacts/validation.
- TypeScript e lint passaram. Testes e cadastros fictícios ficaram nos bancos isolados; dados do banco principal não foram alterados. APK não recompilado nesta revisão; teste físico continua pendente.

## Login direto e academias — 19 de outubro de 2026

- Login/cadastro separam visualmente Sou gestor e Sou aluno sem duplicar contas. A API continua sendo a fonte dos papéis e permissões.
- Uma opção de acesso entra diretamente. Múltiplas opções pedem seleção somente sem uma preferência válida. A última academia/perfil fica salva por usuário e é revalidada ao carregar; nenhum objeto de academia salvo localmente autoriza acesso.
- Nova academia foi movida para Mais. O primeiro gestor sem vínculos recebe o cadastro inicial; aluno sem vínculo recebe orientação sobre convite. /onboarding redireciona por compatibilidade.
- TypeScript e lint passaram sem avisos. Onze testes Node do resolvedor passaram, cobrindo academia única, perfil duplo, múltiplas academias, última seleção, separação de áreas, preferência inexistente/forjada, gestão bloqueada, aluno com acesso financeiro inativo e professor legado sem perfil inventado.
- Navegador com API Go e PostgreSQL 17 isolados: login direto de gestor e aluno; perfil duplo em ambas as áreas; primeira entrada com duas academias e escolha lembrada após logout; recarregamento de Alunos, Turmas e detalhe da mensalidade; redirecionamento de /onboarding; criação de outra unidade em Mais; primeiro cadastro de gestor; aluno sem convite; cadastro pelo convite sem perda do destino; pagamento autenticado e após login mantendo área de aluno; falha de rede com repetição; preferência inválida ignorada e sessão expirada retornando ao login.
- Layout conferido em 320, 390 e 1280 px sem transbordamento horizontal. Capturas noryk-entry-login-320/390/desktop.png e noryk-academy-choice-320/390/desktop.png em artifacts/validation foram revisadas visualmente.
- Export web atualizado. Nenhuma migração ou dado do banco principal foi alterado. Validação em aparelho físico e recompilação do APK continuam pendentes.

## Presença por horário e lançamento manual — 19 de outubro de 2026

- attendance-options consulta a grade sem criar ocorrências. O tablet usa o relógio do servidor e o fuso da academia, de 15 minutos antes até o fim da aula. Uma opção é identificada automaticamente; sobreposição exige escolha. Aulas canceladas, turmas pausadas/excluídas e horários removidos não ficam disponíveis.
- check-ins cria ocorrência, presença e evento idempotente na mesma transação. Reenvio recupera o resultado mesmo após encerramento, mas dispositivo revogado continua recusado. O endpoint legado permanece compatível.
- POST attendances exige gestor ativo da academia e confere esse papel dentro da transação. Aceita aluno, horário da grade e data atual/passada; não aceita aula futura ou cancelada. Preserva unicidade com o tablet, bloqueio de aluno inativo/arquivado e auditoria em recorded_by_user_id.
- Histórico e dashboard usam starts_at para o período do treino. checked_in_at preserva o instante real do lançamento, exibido separadamente nos registros do gestor. Nenhuma migração de esquema foi necessária.
- Suíte Go completa e go vet passaram com PostgreSQL 17 real, incluindo aula sem abertura, falha de identificação sem ocorrência parcial, repetição após fechamento, dois dispositivos, concorrência, conflito de chave, aula simultânea, origem preservada em duplicata, lançamento retroativo no mês correto, dashboard de hoje sem inflação, gestor externo recusado, data futura, aula cancelada, aluno arquivado, dispositivo revogado e opção de aula iniciada no dia anterior.
- Testes de janela cobrem o instante anterior à tolerância, limite de 15 minutos, começo, passagem da meia-noite, último instante e fim exclusivo.
- Navegador com dados isolados: gestor lança presença pela ficha do aluno; tablet identifica a aula por horário e confirma CPF; falha de rede não exibe sucesso e permite repetição; sobreposição deixa confirmação desabilitada até escolher aula. Layout de tablet/check-in e diálogo manual conferido em 320, 390 e 1280 px.
- Capturas em artifacts/validation: noryk-manual-attendance-320/390/desktop.png, noryk-kiosk-scheduled-320/390/desktop.png, noryk-kiosk-scheduled-success-390.png e noryk-kiosk-overlap-success-390.png.
- TypeScript e lint passaram. Banco principal preservado; teste em aparelho físico e recompilação do APK continuam pendentes.

## Verificações ainda necessárias

- Homologar Pix com credenciais sandbox reais da academia e webhook HTTPS acessível.
- Conferir confirmação, vencimento e reemissão com eventos reais do Asaas antes de produção.
- Instalar o APK em celular/tablet Android e verificar câmera, QR, teclado, rotação, retorno do segundo plano e gestos.
- Testar a navegação circular e a remoção do retorno por gesto em iPhone físico com Expo Go ou desenvolvimento iOS.
- Testar queda de rede durante envio no aparelho, incluindo conservação da tentativa e ausência de confirmação antecipada.
- Configurar endereço público estável, HTTPS e credenciais de produção antes de publicação.

Não houve aparelho Android conectado nem credenciais reais do Asaas disponíveis. A validação no navegador e no servidor simulado não substitui essas etapas.

## Aviso de configuração da grade — 20 de outubro de 2026

- O início do gestor mostra um aviso clicável enquanto a academia não possui nenhuma turma ativa com horários semanais. Turmas recebe destaque em coral e um indicador vermelho com exclamação na barra inferior, sem animação contínua. O financeiro permanece acessível.
- A condição usa a grade semanal da academia, não a lista de aulas de hoje: dias sem treino não geram aviso. Pausar todas as turmas faz o aviso reaparecer; criar ou reativar uma turma com horários o remove após a consulta atualizar. Falha na consulta não é interpretada como cadastro vazio. Alunos não recebem a indicação administrativa.
- TypeScript e lint passaram. Navegador com API Go e PostgreSQL de testes: academia vazia, atalho, criação real da primeira turma, dia sem aula, pausa/reativação, troca entre academias e falha de rede passaram. Layouts de 320, 390 e 1280 px conferidos, sem transbordamento nem erros JavaScript. Nenhuma migração necessária.

## Turmas como grade fixa semanal — 20 de outubro de 2026

- Turmas e formulário indicam repetição semanal sem data final. Campos Início/Fim e intervalos como 19:00–20:00 substituem a apresentação de duração em minutos. Cadastro e edição em lote mantêm vários horários nos mesmos dias, com intervalos diferentes. Presenças de hoje são apresentadas como registros daquele dia.
- Sete testes de horários passaram: terça/quinta, múltiplos pares fora de ordem, preservação de horários existentes com durações diferentes e finais iguais, virada da meia-noite, validação de intervalos, duplicações e sete dias. Execução: npm run test:weekly.
- TestScheduledAttendanceAndManualEntry passou com PostgreSQL real isolado, incluindo a consulta da mesma turma e horário após fechar uma ocorrência, nas semanas 1, 2, 52 e 520. Nenhuma data de expiração foi acrescentada.
- Navegador com API e banco isolados: criação de Jiu-Jitsu Iniciantes às terças/quintas, 19:00–20:00; recarregamento; edição para vários intervalos com durações distintas; manutenção da identidade da turma; consulta das presenças por dia. Layouts de 320, 390 e 1280 px passaram sem transbordamento nem erros JavaScript. TypeScript e lint passaram. Sem migração ou alteração do banco principal.

## Grade visual de turmas — 20 de outubro de 2026

- A aba Turmas apresenta uma tabela semanal de domingo a sábado, com linhas ordenadas pelos horários de início e blocos com nome, modalidade e intervalo completo. Cores por modalidade, legenda e destaque do dia atual. Turmas no mesmo dia/horário ficam empilhadas na célula, sem ocultar uma à outra. A grade continua representando horários fixos, sem vencimento.
- Em telas largas, somente esta página usa até 1240 px para comportar os sete dias. No celular, os dias rolam horizontalmente dentro da grade, com a coluna de horários fixa e orientação visível acima da tabela. O toque na grade suspende a troca de seção durante a interação. A navegação fora da grade permanece disponível.
- Tocar em um bloco abre detalhes, edição, pausa/reativação e exclusão com confirmação. Blocos do dia atual levam diretamente à lista de presenças daquele horário. Turmas sem horários continuam acessíveis em uma seção própria. Filtros Ativas/Pausadas/Todas preservados.
- Navegador com API Go e PostgreSQL isolados: sete dias, horários simultâneos, virada da meia-noite, edição, presenças do dia, pausa/reativação, turma sem grade e criação/exclusão passaram. Semana inteira cabe em 1280/1440 px; rolagem horizontal fica contida em 320/390 px, sem transbordamento da página. Nenhum erro JavaScript. TypeScript e lint passaram. Gesto em aparelho físico ainda não foi verificado. Sem migração ou alterações no banco principal.

## Login único sem seleção prévia de perfil — 20 de outubro de 2026

- Login e criação de conta usam um formulário único, sem Sou gestor/Sou aluno. Textos neutros; links de convite e mensalidade conservam o destino ao alternar login/cadastro e depois de autenticar.
- O resolvedor usa todos os acessos atuais devolvidos pela API. Uma opção entra diretamente; múltiplas opções sem preferência válida são escolhidas após autenticar. A última academia/perfil permanece por usuário. A preferência global antiga tatame.login-area deixou de ser lida e escrita, e parâmetros antigos de área na URL de login não escolhem o perfil. O link financeiro prioriza aluno quando esse acesso existe.
- Conta sem vínculos recebe orientação sobre convite e pode escolher explicitamente cadastrar academia. A autorização continua no backend; nenhuma permissão ou vínculo é criado pela escolha de uma tela.
- Quinze testes de acesso passaram. Navegador com API e PostgreSQL isolados: gestor e aluno sem seleção prévia, flags antigas ignoradas, perfil duplo e última seleção por usuário, várias academias, primeiro acesso, criação de academia, convite com cadastro/aceite, pagamento retomado após login e recarregamento de rota protegida passaram. Telas 320/390/1280 sem transbordamento; nenhum erro JavaScript. TypeScript e lint passaram. Nenhuma migração ou alteração do banco principal.

## Identidade TatameMix — 20 de outubro de 2026

- Nome TatameMix adotado conforme a referência escolhida. Símbolo T vetorial compartilhado entre assinatura e assets; preto #0F0F10, vermelho #E11D2E, texto #F8FAFC e fontes Inter 400/600/700. Layouts e regras existentes preservados. Estados de sucesso/alerta e cores das faixas continuam identificáveis.
- Atualizados login, cadastro, cabeçalhos, navegação, cards, campos, seleções, grade e formulários. Ícone, favicon e camadas do ícone adaptativo Android gerados a partir do mesmo símbolo. Slug, package Android, esquema dos links, sessões e QR existentes mantidos.
- Navegador com API Go e PostgreSQL isolados: login/cadastro, painel, alunos, ficha e formulário, financeiro, grade, editor e QR do aluno. Layouts em 320, 390 e 1280 px, cabeçalho sem sobreposição, três fontes Inter carregadas, cor principal e título conferidos. Sem transbordamento da página nem erros JavaScript. Capturas tatamemix-* em artifacts/validation.
- TypeScript, lint, configuração pública Expo e export web passaram. Fontes incluídas no bundle; versão web local atualizada. Nenhuma migração ou alteração no banco principal. APK não recompilado; instalação nativa e aparelho físico ainda precisam de validação.
## Desconto pontual e baixa manual — 20 de outubro de 2026

- Gestor ativo aplica, altera ou remove desconto em reais de uma mensalidade aberta/vencida, com motivo. Valor original, desconto e líquido são apresentados. Contrato e competências seguintes permanecem com seu preço anterior.
- Recebimento integral do valor líquido pode ser registrado em dinheiro, Pix fora do app, cartão, transferência ou outro meio, com observação opcional. Data/autoria ficam no histórico transacional. Reenvio idêntico não cria outra baixa; alunos só consultam o resultado.
- Pix pendente é consultado e encerrado no Asaas antes do ajuste. Pagamento bancário confirmado bloqueia a ação e atualiza a cobrança. Falha, emissão incerta e resposta perdida não confirmam baixa antecipada. Retentativa recupera a exclusão. Pix novo usa o líquido; eventos antigos não desfazem o fechamento manual. Recebimento em Pix substituído exige conferência (payment_review).
- Suíte Go e go vet passaram com PostgreSQL real isolado. Teste específico cobre permissão e isolamento entre academias, limites de valores, remoção de desconto, contrato/mês seguinte preservados, duplicações, concorrência de descontos e baixas, notificações repetidas/antigas, indisponibilidade e perda de respostas do provedor. Asaas simulado por servidor HTTP; homologação real continua pendente.
- Migração 009 passou desde a versão 008, preservando os dados anteriores das mensalidades, datas de pagamento e valores de Pix. A migração desde a 001 também passou. Nenhuma alteração no banco principal.
- Navegador com API real e cópia isolada: desconto, remoção, baixa manual, histórico com autoria, filtro de pagas, consulta do aluno sem ações administrativas e recarregamento passaram. Telas de 320/390/1280 px sem transbordamento nem erros JavaScript; capturas tatamemix-invoice-* revisadas. TypeScript e lint passaram. Teste físico e novo APK permanecem pendentes.
## Mensalidade organizada, evolução e primeiro vencimento futuro — 20 de outubro de 2026

- Detalhe da mensalidade apresenta resumo com mês, valor, situação e vencimento, seguido de barra compacta para baixa/link. Menu contextual reúne desconto, Pix, histórico e cancelamento; QR e confirmações ficam em diálogos. Atualizar é um ícone no título. Acesso do aluno mantém somente pagamento e consulta.
- Ficha do aluno separa Matrícula, Presenças, Evolução e Dados. Grau/faixa são registrados com data, graduação anterior/nova e gestor. Triggers cobrem edição direta e cadastro completo. Histórico paginado, preservado ao remover modalidade, arquivar e restaurar. Períodos ativos são acumulados, excluindo inatividade; cadastros legados têm data original visível e acompanhamento a partir da migração.
- Primeira mensalidade é emitida ao ativar, mesmo no mês futuro escolhido, sem antecipar seu vencimento. Reativação futura também emite uma primeira cobrança. O worker recupera cadastros antigos sem primeira emissão e não avança para mais meses futuros em execuções repetidas. Filtros incluem Todos/Este mês/Próximo mês e seletor de mês/ano; cadastro e edição usam seletores visuais de dia e mês, com vencimento completo na prévia.
- Suíte Go completa e go vet passaram com PostgreSQL real isolado. Cobertura de gradação direta/completa, repetição, validação sem alteração parcial, autoria/data, paginação, isolamento, pausa/restauração sem intervalos duplicados, remoção/retorno de modalidade, contrato e faturas preservados, primeira cobrança futura, reativação e recuperação de emissão legada. Migração desde 008 e desde 001 verificadas; dados anteriores preservados, sem datas presumidas.
- Navegador com API Go e cópia isolada: filtro do próximo mês, menu financeiro, desconto, baixa manual e histórico; grau seguido de troca de faixa com persistência após reload; cadastro completo por etapas com primeiro vencimento no dia 10 do mês seguinte e mensalidade imediatamente encontrada no financeiro. Layouts 320/390/1280 sem transbordamento nem erros JavaScript. Capturas tatamemix-progress-* revisadas.
- TypeScript, lint e export web passaram. Homologação Asaas, aparelhos físicos e recompilação do APK continuam pendentes. Apenas servidores e bancos isolados foram usados; nenhuma migração foi aplicada ao banco principal.
## Histórico de presenças reorganizado — 20 de outubro de 2026

- Seletor visual de mês/ano com atalhos Este mês e Todos os meses. Turma e aluno ficam em diálogo com aplicação explícita, descarte ao fechar e remoção individual dos filtros. Busca de alunos inclui arquivados; status e final do CPF diferenciam nomes iguais.
- Registros agrupados pelo dia do treino no fuso da academia, com linhas compactas no celular e colunas no desktop. Total e intervalo vêm da resposta paginada da API. Detalhe separa data/horário do treino do momento do registro, mostra origem e permite abrir o cadastro. Registro manual continua disponível.
- Navegador com API Go e PostgreSQL isolados: mês atual/anterior/todos, filtros combinados, cancelamento sem aplicar, limpeza individual, busca de arquivado com histórico preservado, detalhe e vínculo ao cadastro, paginação e recuperação do estado vazio passaram. Área pessoal mantém suas restrições e aluno não acessa histórico administrativo. Larguras 320/390/1280 sem transbordamento ou erros JavaScript; capturas tatamemix-history-* revisadas.
- TypeScript, lint e exportação web passaram. Não houve alteração de esquema ou de dados no banco principal. A verificação nativa em aparelhos e um novo APK não fazem parte desta validação de layout.

## Data de início editável do aluno — 20 de outubro de 2026

- Novo aluno aceita data histórica na identificação. A aba Evolução mostra tempo desde essa data, criação do cadastro e atividade acompanhada separadamente; diálogo exclusivo permite corrigir a entrada sem editar contrato.
- Suíte Go completa e go vet passaram com PostgreSQL real isolado. Cobertura de cadastro/edição, omissão em cliente antigo, calendário inválido/futuro/anterior ao nascimento, fuso, conflito entre edições, reenvio, acesso de aluno/outra academia, arquivamento/restauração e preservação de períodos, graduações e financeiro, sem dívidas retroativas.
- Migração desde 010 validada: entrada baseada no dia local original, hashes dos dados anteriores preservados, importações compatíveis e correção conservada em reinício. Backup e cópia isolada preparados; nenhuma alteração no banco principal.
- Navegador com API Go: cadastro completo de faixa preta com entrada em 2015 e cobrança apenas no mês futuro escolhido; correção para 2012 em Evolução, duração recalculada, data inválida bloqueada, cancelamento e persistência após reload. Capturas tatamemix-startdate-* revisadas em 320/390/1280, sem transbordamento ou erros JavaScript. TypeScript, lint e exportação web passaram. Teste em aparelho físico e novo APK não foram executados nesta validação.

## Dados locais para apresentação — 20 de outubro de 2026

- TestSeedPreservesAcademyAndIsRepeatable passou com PostgreSQL isolado: aluno original e turmas preservados, outra academia intacta, datas de mensalidades coerentes com início, inativos/arquivado presentes, ausência de cobranças bancárias e repetição sem alterar ou duplicar dados. go vet dos pacotes passou.
- Após o teste, foi salvo backup custom completo de tatame com pg_dump 18.6 e conferida a leitura por pg_restore --list. Carga aplicada na única academia local, Checkmat Colombo, em uma transação: 18 alunos Demo, 2 planos, 51 ocorrências históricas de aulas, 549 presenças, 65 mensalidades e 48 eventos de graduação. Os 2 alunos, 2 mensalidades e 5 turmas existentes foram preservados.
- Conferência posterior: 20 alunos totais; exemplos com 15 ativos, 2 inativos e 1 arquivado; 30 mensalidades pagas, 21 abertas, 11 vencidas e 3 canceladas; 3 descontos; nenhum Pix/recebimento bancário emitido. Exemplos usam somente e-mails de teste e documentos sintéticos. O PostgreSQL principal permaneceu no estado de serviço iniciado e inicialização Manual; apenas o PostgreSQL isolado de testes foi iniciado/encerrado pelo agente.

## Check-in simplificado — 20 de outubro de 2026

- Cabeçalho compacto com marca, relógio e menu. CPF em destaque e QR como alternativa dentro de um único painel. Aula automática quando há apenas um horário; horários simultâneos são escolhidos em diálogo. Código legado, atualização da grade e encerramento ficam no menu secundário. Confirmação substitui o formulário e limpa o CPF automaticamente para o próximo aluno.
- Navegador com API Go e PostgreSQL isolados: CPF inválido bloqueado; diálogo da câmera com alternativa ao negar acesso; falha de conexão sem confirmação antecipada, reenvio, presença única após repetição, escolha explícita de aula, identificação por código antigo, estado sem horários, cancelamento de saída e revogação do acesso passaram. Retorno automático e limpeza do CPF verificados. Sem erros JavaScript.
- Capturas tatamemix-checkin-* revisadas em 320, 390, 1024 e 1280 px, sem transbordamento; todos os dígitos do CPF cabem na menor largura. TypeScript, lint e exportação web passaram. Nenhuma alteração de esquema ou de dados no banco principal. Câmera em aparelho físico e APK recompilado permanecem pendentes.
## Alternância de câmera no check-in — 20 de outubro de 2026

- Leitor de QR inicia com a câmera traseira e apresenta Trocar câmera, alternando entre frontal e traseira e informando a seleção atual. Trocar limpa o erro anterior e mantém a leitura do QR. Caso a câmera falhe, a orientação permite trocar ou voltar ao CPF.
- TypeScript, lint e exportação web passaram. A troca e leitura com câmeras de celular/tablet físico ainda precisam ser verificadas. Nenhuma alteração de API, banco ou dependências.
## Preparo da hospedagem Vercel/Railway — 20 de outubro de 2026

- Vercel configurada em mobile/vercel.json: instalação npm ci, export web, dist e fallback das rotas SPA do Expo. Build hospedado valida origem HTTPS da API e portal opcional, recusando URL ausente/auto/local, caminho indevido e credenciais. Desenvolvimento local preservado. Docker exclui arquivos privados de configuração/certificados/backups. Guia em docs/DEPLOY.md cobre o único repositório, painel das hospedagens, CORS, banco novo e importação dos exemplos.
- Configuração Go passou em testes e go vet; API compilada. PORT da hospedagem usada quando HTTP_ADDR está ausente, com prioridade explícita e default local cobertos. TypeScript e lint passaram. Verificação da URL de build passou para casos inválidos e origem HTTPS válida.
- A inspeção do JavaScript exportado detectou cache contendo o endereço local antigo apesar da nova variável. Build hospedado passou a limpar o cache do Expo. Nova exportação isolada incorporou as duas origens HTTPS de teste e removeu a configuração antiga; conteúdo dos arquivos gerados foi conferido. Exportação local restabelecida separadamente para não deixar URLs fictícias no dist usado pelo computador.
- Não foram criados serviços, publicados commits/deploys ou importados dados na nuvem. Build Docker não executado (Docker indisponível neste ambiente); validação da imagem, domínios, CORS e fluxo completo hospedado dependem do provisionamento nas contas do usuário. Nenhuma alteração no banco local.
## Alternativa gratuita de demonstração — 20 de outubro de 2026

- Guia e README alterados para Vercel + Render Free + Neon Free após a restrição de upgrade na Railway. render.yaml define uma única API Docker free, pasta backend, healthcheck /healthz e DATABASE_URL preenchida no painel, sem provisionar PostgreSQL pago. Configuração de porta já existente continua compatível.
- YAML analisado sem erros; caminhos do Dockerfile e go.mod no contexto de build conferidos. Documentados conexão direta Neon com SSL, restauração antes de iniciar a API, CORS, URL do frontend e limites do modo gratuito. A suspensão do Render pode atrasar o primeiro acesso e interrompe as rotinas enquanto o processo dorme; o guia orienta aguardar /healthz antes da apresentação.
- Alterações limitadas à configuração de hospedagem e documentação. Nenhum recurso criado na nuvem, plano contratado, credencial copiada, dado local alterado ou integração bancária habilitada. Deploy Docker remoto e fluxo hospedado continuam pendentes nas contas do usuário.
## Container único com portal e API — 20 de outubro de 2026

- Dockerfile multi-stage na raiz compila Expo web com same-origin e API Go. A imagem final executa somente Go e serve os assets com WEB_DIST_DIR=/app/web, mantendo PostgreSQL externo. .dockerignore exclui ambientes, credenciais, certificados, backups e dependências locais. Render passa a usar a raiz completa; Compose local compila a mesma imagem sem alterar seu volume PostgreSQL.
- Quatro testes do resolvedor passaram: chamadas relativas na web, recusa do modo relativo no nativo, URL HTTPS explícita e descoberta local do Expo preservadas. TypeScript e lint passaram; export de produção same-origin concluído em pasta isolada. Teste Go do limite entre portal/API passou; caminhos do Dockerfile, Render e Compose conferidos.
- Servidor Go real com export same-origin e PostgreSQL isolado: /healthz, login, dados do painel, chamadas /v1 no mesmo endereço, reload de rota protegida, histórico, arquivo ausente e rota de API ausente passaram. Nenhum erro CORS/JavaScript. Somente o servidor e PostgreSQL de teste foram iniciados e encerrados; banco principal preservado. Export local restabelecido com configuração local após a verificação.
- Docker indisponível neste computador: a imagem completa não foi construída nem executada aqui. A compilação Linux da imagem e o fluxo HTTPS hospedado precisam ser verificados no Render ou em ambiente com Docker. Nenhum serviço de nuvem criado, credencial importada ou plano contratado. Guia principal agora cobre um container + Neon, sem exigir Vercel; suspensão do Render Free permanece documentada.