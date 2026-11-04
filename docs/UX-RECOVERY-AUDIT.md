# Auditoria de saídas e recuperação — 04/11/2026

## Resultado

Ainda não é correto afirmar que o usuário sempre consegue concluir qualquer
operação. Foram corrigidos bloqueios de navegação e recuperação de leitura,
mas os quatro achados abaixo continuam abertos. Sair de uma tela, repetir uma
consulta e resolver uma pendência financeira são capacidades diferentes.

## Achados abertos

### P1 — Assinatura do software com checkout vencido

`backend/internal/subscriptions/model.go`, `attempt.result`, converte uma
tentativa ready vencida em review sem permitir retry. `service.go`, `Checkout`,
reutiliza a tentativa do ciclo e só reemite se state=rejected. A tela de
assinatura desabilita o pagamento nesse review.

Impacto: o gestor pode navegar e conferir, mas não consegue obter outro link
para regularizar esse ciclo. A renovação de links implementada no pacote
payments atende mensalidades dos alunos, não a assinatura da plataforma.

Correção necessária: histórico de múltiplas tentativas por ciclo, nova
referência, proteção concorrente, conferência de transações conhecidas e
tratamento de confirmação tardia, com testes PostgreSQL isolados. Não substituir
a referência na mesma linha nem simular cancelamento do provedor.

### P1 — Pagamentos incertos não têm resolução operacional pela interface

Existem as rotas backend `/invoices/{invoice}/checkouts` e
`/invoices/{invoice}/checkout-retirement`. Não foi encontrada uma chamada a
essas rotas no frontend. O painel permite conferir pagamento e orienta procurar
a academia, mas a equipe não dispõe de uma tela completa para registrar e
acompanhar essa resolução. A aposentadoria exige evidência externa; não cancela
o link bancário. Sem transaction_nsu e slug, a API InfinitePay não oferece
consulta apenas por order_nsu.

Impacto: uma emissão incerta ou recebimento tardio pode continuar bloqueado
mesmo depois do atendimento. Necessário um procedimento suportado pelo
provedor, uma tela auditada para o operador e um canal de atendimento definido.
Não liberar uma nova cobrança apenas para remover esse bloqueio.

### P1 — Senha esquecida não tem recuperação

As rotas de autenticação registradas são register, login e logout. Não foi
encontrado fluxo de solicitar/consumir token de recuperação, nem a opção
correspondente no login.

Impacto: quem esquece a senha pode trocar de conta, mas não recupera o acesso à
conta original. Requer canal de entrega de token, validade, uso único,
limitação de tentativas e resposta que não exponha se o e-mail existe.

### P2 — Repetição de criação após resposta perdida

`CreateAcademyScreen.tsx` e `backend/internal/academies/{handler,repository}.go`
criam uma academia com ID novo a cada POST, sem chave idempotente. Se o banco
gravar e a resposta se perder, repetir pode criar outra academia. A auditoria
não confirmou idempotência geral de todas as outras gravações.

Correção necessária: chave de operação persistente e recuperação do resultado.
As mutações continuam sem repetição automática, e a mensagem de rede orienta
atualizar os dados antes de repetir pagamento ou cadastro.

## Correções realizadas nesta auditoria

| Situação | Correção |
| --- | --- |
| Cobrança aberta com conta sem acesso | Ações para acessar academias ou trocar de conta, preservando o retorno do pagamento |
| Assinatura de academia que a conta não administra | Mesmas ações de recuperação, sem conceder acesso indevido |
| Convite/matrícula inválidos ou expirados | Saída para o sistema e troca de conta; matrícula também permite cancelar o formulário |
| Falha de consulta em listas e detalhes | Componente QueryError com repetição explícita da leitura e indicação de carregamento |
| Falha ao conferir CPF e contatos | Botão para repetir a conferência sem alterar campos nem perder o formulário |
| Consulta financeira sem aluno selecionável | Não exibir carregamento da consulta desabilitada; mostrar carregamento, erro ou atualização do vínculo |
| Lista perde registros quando está em página avançada | Paginação oferece retorno à página existente; histórico vazio permite retornar à primeira |
| Browser informa offline | Consultas/mutações tentam a requisição e terminam pelo timeout; não ficam pausadas esperando reconexão |
| Erro de armazenamento de sessão | Login e encerramento em memória continuam; sessão expirada não fica presa por falha no storage |
| HTTP 401 com corpo inválido | Sessão é invalidada antes de tentar interpretar JSON |
| Timeout ou falha de internet | Mensagem adequada à hospedagem pública, diferenciando demora e orientando conferir antes de repetir escrita |
| Erro de renderização/carregamento de rota | ErrorBoundary com repetição; recuperação de telas permite voltar ao acesso |
| Endereço inexistente | Página +not-found com retorno ao sistema ou à página anterior |

As correções de recuperação não modificam permissões, baixa financeira, preço
da assinatura ou situação cadastral. Não há repetição automática de pagamentos.

## Cobertura da inspeção

Inspeção estática dos 37 módulos atuais de rotas/layouts em `mobile/src/app`,
dos componentes compartilhados de navegação, sessão, API, diálogos e formulários,
e das famílias de telas abaixo. As rotas reutilizam componentes; não representam
37 testes de navegador nem 37 operações executadas.

| Família | Estados revisados e caminhos disponíveis no código |
| --- | --- |
| Login/cadastro | Validação, erro de API, senha incorreta, mudança de modo, retorno de links; falta recuperação de senha |
| Entrada/academias | Sem acesso, um/vários acessos, perfil anterior inválido, falha ao carregar, sair e atualizar |
| Alunos | Lista, detalhe, cadastro/edição por etapas, identidade, arquivar/restaurar, planos/modalidades, histórico e paginação |
| Financeiro | Filtros, consulta falhada, mensalidade paga/cancelada, checkout vencido, emissão incerta, retorno, histórico e ajustes |
| Assinatura | Cobrança desabilitada, tolerância/restrição, retomada, encerramento, retorno, histórico e checkout vencido; pendência P1 |
| Convites/matrícula | Token inválido, expirado/usado, conta errada, vínculo concluído, tentativa de acesso após conclusão e pedidos pendentes |
| Turmas/presenças | Grade vazia, filtros, erro de consulta, aula indisponível, lançamento manual, histórico, paginação e calendário |
| Aluno/responsável | Sem vínculo, vários alunos, erro de vínculo/credencial, financeiro e consulta de presenças |
| Tablet/dispositivos | Ativação/revogação, sessão inválida, erro de check-in, repetição com chave, permissão de câmera e alternativa numérica |
| Configurações | Catálogo, gestores, participação, recebimentos, planos, horários e formulários de confirmação/cancelamento |

Nos diálogos, fechar e cancelar ficam indisponíveis durante uma escrita para
não apresentar a operação como cancelada enquanto o servidor pode confirmá-la.
As requisições HTTP têm timeout de 15 segundos. Resultado perdido continua
exigindo atualização/conferência; timeout não significa rollback no servidor.

## Validação

- TypeScript: `tsc --noEmit` aprovado.
- ESLint: execução direta com a configuração do projeto e limite de zero avisos.
- Testes Node do frontend: 50 aprovados, incluindo recuperação offline e proteção
  contra repetição automática de mutações.
- Exportação Expo web de produção: executada; artefatos em `mobile/dist` (ignorado).
- Verificação de whitespace: `git diff --check`.

Não houve teste com credenciais reais, gravação no Neon, cobrança, acesso à
conta de um aluno ou publicação. A prévia de navegador não conseguiu alcançar
o servidor local pela ferramenta disponível (timeout); não há validação visual
ou end-to-end autenticada nesta auditoria. Testes Go e integração bancária devem
ser executados pelo workflow Validar pagamentos antes de publicar as mudanças
anteriores de renovação de links.

## Publicação e aceite

Estas correções da auditoria alteram o frontend; publicar o GitHub e aguardar o
deploy Vercel. As mudanças anteriores de pagamentos, se ainda não publicadas,
também exigem testes Go, nova imagem e nova tag na Azure.

Após publicar, validar com conta de teste autorizada: acesso por conta errada,
link expirado, falha de internet com diálogo aberto, CPF com consulta falhada,
listas sem dados/página avançada, URL inexistente e logout. Nenhuma verificação
financeira deve considerar apenas o retorno do navegador como prova de pagamento.
