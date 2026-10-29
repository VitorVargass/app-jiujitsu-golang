# Interface responsiva do TatameMix

Implementada e verificada em 24 de outubro de 2026. Mesma aplicação Expo SDK 57 para Android e web, sem alteração de banco, endpoints, credenciais ou integração de pagamentos.

## Organização

- `mobile/src/hooks/useResponsiveLayout.ts` centraliza os limites: compacto abaixo de 768 px, intermediário de 768 a 1023 px e amplo a partir de 1024 px. A largura é a da janela, sem identificação por navegador/dispositivo.
- `AcademyShell` usa o menu lateral no amplo e preserva o cabeçalho e a barra inferior nos demais tamanhos. As rotas e permissões continuam sendo as existentes. O check-in mantém seu layout independente.
- `Page` e `SwipeNavigator` preservam a árvore do conteúdo atual ao trocar de largura. No amplo, não montam gestos nem prévias das telas vizinhas.
- `ResponsiveGrid` muda a disposição dos mesmos filhos, sem substituir formulários. Login, filtros e rascunhos não são reinicializados pela mudança de largura.
- `StudentsTable` e `InvoicesTable` são apresentações sem consultas próprias. Recebem a página já consultada pela tela e compartilham os mesmos filtros, cache e paginação das listas compactas.
- Autenticação, API, sessão e regras de autorização permanecem compartilhadas. Não há novo frontend Next.js nem novas dependências.
- `useDialogFocus.web.ts` implementa foco inicial, ciclo de Tab/Shift+Tab, Escape e restauração do foco para os diálogos de edição/confirmação. O arquivo padrão conserva o comportamento nativo do Modal. `PlatformStyles.web.tsx` fornece foco visível no navegador.

## Telas

O desktop recebe menu lateral com contexto da academia/usuário e troca de perfil, indicadores em linha, gráfico e agenda lado a lado, tabelas de alunos e mensalidades, dados pessoais/matrícula/cobrança organizados em colunas, campos de identificação e contato em colunas dentro da mesma etapa, graduação e tempo de academia lado a lado, configurações e acessos de check-in em grade.

A grade semanal existente passa a aproveitar a área ampla do shell. A rolagem horizontal necessária fica dentro da grade. Histórico e calendário usam o mesmo limite central de layout. O portal do aluno mantém apenas as áreas autorizadas e seu cartão de presença tem largura limitada.

## Verificação realizada

As validações de interface usaram o bundle web de produção com um servidor HTTP temporário e dados inteiramente sintéticos. Nenhum banco local ou remoto foi acessado ou modificado. Os testes de interface validam apresentação e redirecionamento; não substituem testes de autorização na API.

- TypeScript: `npm run typecheck` passou.
- Lint: `npm run lint` passou sem erros/avisos do ESLint.
- 30 testes existentes passaram: acesso (15), calendário de presenças (3), identificação de cinco dígitos (1), horários semanais (7) e URL da API (4). O Node emite aviso já existente sobre MODULE_TYPELESS_PACKAGE_JSON nesses testes.
- `npm run build:web` passou com `EXPO_NO_DOTENV=1` e `EXPO_PUBLIC_API_URL=same-origin`, como no Docker.
- Exportação Android/Hermes passou com `expo export --platform android`, sem importar os componentes DOM usados exclusivamente na web. Isso valida o bundle, não um APK instalado.
- `go test ./internal/httpapi -run '^TestPortalDeepLinksAndAPIBoundary$' -count=1` passou, sem banco. Os testes existentes verificam o fallback SPA e a separação de erros da API/arquivos.
- No navegador: login, seleção e troca da academia, menu ativo em detalhe de mensalidade, abrir/atualizar rota direta, voltar do navegador, tabela de alunos com nome longo, busca, financeiro padrão no mês atual, cadastro em etapas, matrícula, graduação, calendário de presenças, tablets e portal do aluno.
- Busca de aluno e campos digitados permaneceram após alternar entre 390 e 1366 px. No amplo, o pager e suas prévias não são montados.
- Financeiro verificado em 360, 390, 768, 1024 e 1366 px sem overflow horizontal na raiz; painel também verificado em 1920 px. A grade semanal mantém rolagem local quando não cabe na tela.
- Tab/Shift+Tab permaneceram no diálogo financeiro; Escape fechou e devolveu foco a Filtros.
- Uma conta sintética de aluno recebeu somente sua navegação e foi redirecionada ao tentar acessar `/students`. As permissões do backend não foram alteradas.
- Nenhum erro JavaScript foi registrado durante os fluxos verificados.

## Pendências de ambiente e publicação

Docker não está instalado/disponível nesta máquina. O build completo da imagem não foi executado; a exportação web e o teste do fallback Go passaram separadamente. O Dockerfile existente continua exportando a pasta mobile e servindo os arquivos pela API Go.

Não havia aparelho Android/iOS conectado para validar toque, câmera, teclado virtual e acessibilidade nativa. Antes de distribuir um novo APK, verificar no Expo Go/aparelho físico: cadastro com teclado, alternância de orientação, arraste entre seções, QR/câmera e check-in. Não foi gerado APK nem feito deploy nesta entrega.

O servidor temporário usado na validação foi encerrado. Para executar a aplicação, usar os comandos habituais de desenvolvimento e a configuração de API já existente. Para publicar, usar o fluxo Docker/Render documentado em DEPLOY.md.

## Menu de conta

O antigo botão de troca foi substituído por `AccountMenu`, compartilhado entre o avatar compacto no cabeçalho do celular e a identidade no rodapé da lateral desktop. A janela mostra conta, academia atual e acessos autorizados. Com um único acesso, exibe um resumo; com vários, permite selecionar academia/perfil diretamente, sem passar por outra página. Atualização dos acessos e saída ficam na mesma janela. A seleção usa os mesmos filtros de permissão de `academyAccesses` e não cria novos papéis.

## Linhas inteiras clicáveis

As tabelas de alunos e mensalidades usam `onRowPress` no componente compartilhado DataTable. Toda a largura da linha, inclusive valor, situação e espaços vazios, abre o detalhe. Há realce no hover/pressionamento; o cabeçalho não navega. Os links dos nomes continuam funcionando pelo teclado e não geram navegação duplicada. Controles interativos internos mantêm suas ações e selecionar texto fora dos links não abre o registro. Os cards de modalidades e planos também abrem a edição pelo corpo inteiro.

Verificação em navegador com dados sintéticos: clique no espaço vazio da linha de aluno, situação do aluno, valor e situação de mensalidade; clique/Enter no nome, com um único voltar para retornar à lista; cabeçalho sem navegação; edição de modalidade/plano pelo título do card. TypeScript, lint e exportação web passaram. Nenhum banco foi alterado.

## Turmas no celular

Abaixo de 768px, WeeklyTimetable apresenta MobileClassAgenda: seleção do dia, quantidade de horários, abertura no dia atual e cartões ordenados por horário. Em telas menores que 380px, o seletor de dias ocupa duas linhas. O toque em um cartão preserva as opções existentes da turma e a configuração de horários. Tablet e computador conservam a grade semanal anterior. Não há alteração de API ou banco. A seleção do dia permanece ao redimensionar a tela.
