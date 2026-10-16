# Migração para gestão e mensalidades

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
