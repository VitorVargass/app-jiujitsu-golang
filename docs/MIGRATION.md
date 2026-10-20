# Migração para gestão e mensalidades

## 008 — Identidade única e participação sem matrícula

A 008 cria people, a única tabela com e-mail, e academy_participants para a relação pessoa/academia. users passa a referenciar person_id e continua representando autenticação. students conserva matrícula/modalidades/financeiro e aponta para a participação. CPF, código e QR saem de students e ficam na participação; os valores e o ID usado pelas presenças antigas são preservados.

attendances.membership_id passa a se chamar participant_id e referencia academy_participants. IDs de usuários, hashes de senha, sessões de autenticação, matrículas, aulas, presenças, contratos e mensalidades emitidas são mantidos. Resultados idempotentes antigos não são reescritos. Novos participantes de gestores não criam matrícula, plano, configuração de cobrança ou dívidas.

Contas e matrículas já explicitamente vinculadas compartilham a pessoa. A migração interrompe e reverte integralmente se houver e-mail conflitante na conta vinculada, logins com e-mails equivalentes ou matrícula não vinculada com e-mail já existente. Não se presume que duas pessoas sejam a mesma por coincidência de e-mail.

Para um conflito realmente confirmado, IDENTITY_MERGE_APPROVALS aceita um objeto JSON de student_id para user_id, somente durante aquela execução de migração. Cada associação exige o mesmo e-mail normalizado dos registros. Use apenas IDs revisados e retire a variável após a atualização; não mantenha aprovações no arquivo de configuração ou no Git. Pessoas distintas precisam ter o e-mail próprio corrigido ou removido do contato antes de migrar; nunca vincule contas por suposição.

Backup inicial: artifacts/backups/tatame-before-identity-20261019-134853.dump. A migração foi testada desde um banco vazio, desde o esquema 001, no cenário de conflito que deve reverter para 007 e em cópia restaurada no PostgreSQL 18. A primeira simulação reuniu os dois casos para conferir a estrutura; a validação final restaurou um novo backup e aplicou somente o vínculo próprio já revisado, deixando o contato conflitante do outro aluno sem e-mail.

Ativada no banco local em 19 de outubro de 2026, após o usuário esclarecer que os registros conflitantes eram exemplos e reforçar a unicidade global do e-mail. O e-mail permaneceu na conta “Vitor Secundario”; o contato do aluno “Vitinho” foi deixado vazio, sem associar as duas pessoas. Cadastro, CPF/QR, histórico e cobranças foram preservados. A conta do próprio gestor reutilizou sua identidade conforme o vínculo previamente revisado.

Novo backup imediatamente anterior: artifacts/backups/tatame-before-identity-activation-20261019-144606.dump. A correção pontual e a migração passaram primeiro na cópia restaurada. No banco principal, 19 projeções dos dados foram comparadas antes/depois: todas iguais, considerando a correção explícita daquele contato e a reorganização dos campos. Verificadas versão 008, uma única coluna email e nenhuma duplicação em people. API 2.7.0 e portal responderam HTTP 200; uma nova comparação após a inicialização conservou as 19 projeções. O executável anterior está preservado em artifacts/backups/tatame-api-before-identity-activation.exe.

Antes de ativar, refaça o backup, valide as associações na cópia e só então inicie a nova API com as aprovações revisadas. A migração é progressiva; Down recusa separar identidades e presenças. Para voltar, restaure o backup em outro banco com o executável antigo.

## Histórico das migrações anteriores

A migração 002 conserva usuários, academias, turmas, aulas, presenças e eventos idempotentes. Cria students a partir dos vínculos de aluno existentes, usando o mesmo ID, código numérico, QR e situação. A coluna legada attendances.membership_id passa a referenciar students; o nome da coluna é mantido para preservar registros e clientes anteriores.

Alunos migrados não recebem configuração financeira. Portanto, não são geradas cobranças retroativas. O gestor deve revisar valor, dia, data de nascimento, responsável quando menor e competência inicial antes de ativar cobranças. Cadastros novos não exigem uma conta de usuário; o vínculo pessoal vem pelo convite individual.

Antes de iniciar a nova API em um banco existente:
1. Faça backup completo com pg_dump do PostgreSQL.
2. Restaure em outro banco e execute a API/migração nessa cópia.
3. Verifique usuários, academias, presenças, códigos e QR, além da ausência de dívidas criadas pela migração.
4. Só então execute no banco original, conservando o backup.

Neste computador foi salvo artifacts/backups/tatame-before-academy-20261008-170815.dump antes de qualquer migração. Uma cópia do PostgreSQL 18 foi restaurada no PostgreSQL portátil de testes; a atualização foi validada ali. O teste TestLegacyMigrationPreservesAttendance também cria uma base versão 001 com presença e QR reais, aplica as migrações seguintes e verifica sua conservação.

## Migração 003: cadastros por etapas

A 003 acrescenta preço e opções de graduação ao catálogo, faixa e valor contratado no vínculo aluno/modalidade, telefone alternativo e forma de cobrança no aluno. Os contratos anteriores ficam em custom; valores, datas, situação, códigos, QR e presenças existentes permanecem iguais. A migração não ativa cobranças nem cria mensalidades.

O backup desta revisão está em artifacts/backups/tatame-before-wizard-20261015-031612.dump. Ele foi restaurado em um PostgreSQL 18 isolado na porta 55433. TestRestoredCopyMigration aplicou a 003 e comparou assinaturas dos dados anteriores de dez tabelas; todas permaneceram iguais. TestLegacyMigrationPreservesAttendance também verifica um contrato anterior de R$ 180 e uma mensalidade paga de R$ 150.

Após autorização explícita do usuário em 15 de outubro de 2026, foi salvo novo backup em artifacts/backups/tatame-before-wizard-activation-20261015-010445.dump e aplicada a 003 ao banco local tatame. As assinaturas dos dados anteriores das dez tabelas permaneceram iguais. A API foi reiniciada e /healthz respondeu ok por localhost e pelo endereço da rede. O bloqueio anterior da revisão automática foi resolvido pela autorização. Voltar ao esquema anterior exige restaurar um backup, pois Down recusa descartar graduações e valores contratados.

A migração é progressiva: voltar ao modelo anterior não representaria alunos sem conta e dados financeiros. O Down recusa remover históricos. Para voltar à versão anterior, restaure o backup em outro banco e use o executável antigo, preservando a base atual para conferência.

## Migração 004: graus por faixa

Adiciona student_modalities.degrees com valor inicial zero e limite de 0 a 4. Modalidades sem faixa aceitam somente zero. As faixas existentes, valores, mensalidades, códigos, QR e presenças são preservados. student_rank_label formata o nome para os históricos e o check-in sem modificar os registros de presença ou resultados idempotentes anteriores.

A migração foi testada em bancos PostgreSQL 17 isolados e em cópias restauradas do banco local no PostgreSQL 18. Foi aplicada ao tatame local em 15 de outubro de 2026, após novo backup em artifacts/backups/tatame-before-degrees-activation-20261015-154128.dump. Assinaturas de todas as colunas anteriores de dez tabelas permaneceram iguais; somente a nova coluna degrees foi excluída da comparação. A API foi reiniciada e ficou saudável.

O gestor pode ajustar os graus na edição do aluno. Clientes anteriores que omitem degrees conservam os graus já salvos para a mesma faixa; uma faixa nova começa em zero. Down exige restaurar backup para evitar descartar graus cadastrados.
## Migração 005: CPF, arquivamento e exclusão de turmas

Adiciona students.cpf e students.archived_at, índice único de CPF por academia (incluindo arquivados) e classes.deleted_at. CPFs vazios continuam aceitos no banco para legados; a API exige CPF válido nos novos cadastros. Omitir CPF na edição conserva o valor existente. O CPF do pagador não é usado para preencher o CPF do aluno.

Arquivar desativa cobrança e presença sem apagar vínculos, credenciais ou débitos. Restaurar mantém cobrança desligada para revisão da competência. Repetir a restauração de um aluno já ativo não altera seu contrato. Excluir turma usa exclusão lógica e cancela aulas abertas. Abertura, criação de horário e exclusão bloqueiam a turma na transação; o check-in bloqueia a turma antes da aula e respeita o arquivamento do aluno.

O backup artifacts/backups/tatame-before-cpf-20261015-163518.dump foi restaurado num PostgreSQL 18 isolado. TestRestoredCopyMigration comparou os dados anteriores de 12 tabelas após aplicar a 005, incluindo todos os graus. A migração desde a 001 também conservou código/QR, contrato e mensalidade paga, deixando CPF vazio.

Ativação local concluída em 15 de outubro de 2026, com novo backup em artifacts/backups/tatame-before-cpf-activation-20261015-164328.dump. As assinaturas das colunas anteriores de 12 tabelas permaneceram iguais; somente cpf, archived_at e deleted_at foram excluídos da comparação. API 2.3.0 saudável na porta 8080. Down recusa descartar dados novos; para voltar, restaure backup numa base separada com o executável correspondente.

## Migração 006: agenda semanal em lote

Adiciona class_schedules.deleted_at e índice parcial dos horários disponíveis. A migração não remove nem altera horários, aulas, alunos, cobranças ou presenças existentes.

POST/PATCH de turmas passa a aceitar schedules como a grade semanal completa. A operação grava metadados e horários em uma transação; sem schedules, conserva o comportamento anterior. A edição conserva IDs de horários com mesmo dia/início, restaura um horário anteriormente removido se ele voltar à grade e marca como removidos os ausentes. Aulas antigas continuam referenciando os horários anteriores. A abertura de aula verifica novamente o horário dentro da transação, sob o bloqueio da turma.

O backup artifacts/backups/tatame-before-weekly-20261015-172231.dump foi restaurado num PostgreSQL 18 isolado. A migração passou na cópia com comparação de todos os dados anteriores de 13 tabelas. A suíte também passou desde a versão 001.

Aplicada ao tatame local em 15 de outubro de 2026 após novo backup em artifacts/backups/tatame-before-weekly-activation-20261015-172939.dump. Todas as assinaturas dos dados anteriores de 13 tabelas ficaram iguais, excluindo apenas a nova coluna deleted_at dos horários. API 2.4.0 saudável. Down exige restaurar backup para evitar reativar horários removidos.

## 007 — Nascimento, responsável de menor e histórico do aluno

Acrescenta students.birth_date, sem preencher datas presumidas nos cadastros anteriores, e o índice attendances_student_history por academia/aluno/data de check-in. Não altera presenças, graduação, contratos, CPF, QR ou mensalidades emitidas. A API exige data válida para alunos novos; omitir a data no PATCH preserva a anterior.

A idade usa a data local da academia. Antes dos 18 anos, cobrança ativa exige nome e CPF/CNPJ de responsável diferente do aluno; a partir dos 18, novas cobranças usam o próprio nome e CPF. O gerador também faz essa escolha ao emitir após o aniversário. Legados sem nascimento conservam o contrato anterior até revisão. A interface pede a data para definir quem paga.

O backup artifacts/backups/tatame-before-enrollment-20261015-182849.dump foi restaurado num PostgreSQL 18 isolado. A migração passou na cópia, comparando os dados anteriores de 13 tabelas e as datas existentes, além do teste desde a versão 001.

Ativada em 15 de outubro de 2026 após novo backup em artifacts/backups/tatame-before-enrollment-activation-20261015-183138.dump. Todos os dados anteriores de 15 tabelas permaneceram iguais; somente birth_date foi excluída da assinatura de students. API 2.6.0 saudável em localhost e na rede. O Down exige restauração de backup para preservar as datas cadastradas.

## 009 — Desconto pontual e recebimento manual

Acrescenta discount_cents, discount_reason e payment_method às mensalidades, mantendo valor, situação, vencimento e data de pagamento anteriores. Cobranças bancárias já recebidas ficam identificadas como asaas_pix; outros pagamentos legados não recebem uma origem presumida. pix_charges recebe uma cópia do valor originalmente emitido. invoice_adjustments armazena autoria e histórico apenas para novas ações; a migração não inventa lançamentos nem ativa cobranças.

Testada desde uma base vazia, desde a versão 001 com dados legados e desde a 008 com mensalidades abertas/pagas e Pix emitidos. O teste específico compara todos os campos anteriores das mensalidades e os valores preservados das cobranças. Uma cópia isolada da interface também foi atualizada de 008 para 009. O banco principal não foi alterado nesta entrega. Antes de iniciar a nova API sobre sua base, conserve um backup; a migração é automática no início. Down exige restaurar backup para conservar a auditoria.
## 010 — Evolução e períodos ativos

Cria histórico de faixa/graus por aluno/modalidade e intervalos de atividade, sem alterar graduações atuais, contratos, mensalidades, contas ou presenças. Cadastros existentes recebem uma graduação de referência (baseline), com data da conquista desconhecida. Sua data original de criação é conservada. Os períodos ativos começam na atualização: não são presumidas pausas nem atividades passadas.

Novos cadastros e alterações são capturados por triggers transacionais. Edições repetidas não geram conquistas falsas; arquivamento e inativação encerram o período ativo, e retorno abre um novo período. Exclusão de modalidade conserva o histórico. Down exige restauração de backup para preservar a trilha.

A migração passou desde a 001 e numa cópia isolada da versão 009. O teste de atualização desde 008 conserva todos os campos anteriores das mensalidades e seus Pix, mantém faixa/graus atuais e a data original de cadastro, e verifica que não foram inventadas datas de conquista ou períodos ativos antigos. O banco principal permanece sem alteração durante a implementação; a API aplica 010 ao reiniciar. Conserve o backup antes de atualizar a base.
## Migração 011 — início informado do aluno

Adiciona started_on em students sem alterar created_at. Os cadastros existentes recebem a data de criação convertida para o fuso da academia; o gestor pode corrigi-la em Evolução. Dados financeiros, graduações, períodos ativos e presenças são preservados. Importações que omitem started_on usam a data local de created_at. Nenhuma cobrança é retroagida a partir dessa data.

Foi criado backup da base de validação e uma cópia do esquema 010 foi migrada isoladamente. Testes cobrem virada de dia no fuso da academia, preservação dos dados e execuções repetidas. A alteração é aplicada pelo Goose ao reiniciar a API atualizada; conserve um backup do banco antes de atualizar sua instalação.
