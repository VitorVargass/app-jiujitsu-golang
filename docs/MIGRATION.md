# Migração para gestão e mensalidades

A migração 002 conserva usuários, academias, turmas, aulas, presenças e eventos idempotentes. Cria students a partir dos vínculos de aluno existentes, usando o mesmo ID, código numérico, QR e situação. A coluna legada attendances.membership_id passa a referenciar students; o nome da coluna é mantido para preservar registros e clientes anteriores.

Alunos migrados não recebem configuração financeira. Portanto, não são geradas cobranças retroativas. O gestor deve revisar valor, dia, pagador e competência inicial antes de ativar cobranças. Cadastros novos não exigem uma conta de usuário; o vínculo pessoal vem pelo convite individual.

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
