# Exclusão de conta e dados — TatameMix

Implementação por solicitação e atendimento manual. Não publicar como exclusão instantânea. A rota pública é `/delete-account`; a URL final depende da publicação e não foi verificada. Nenhum deploy ou acesso ao banco de produção faz parte desta entrega.

## Jornada implementada

- Página sem login com nome do app, consequências, verificação, conservação e e-mail de privacidade já existente em `mobile/src/features/legal/content.ts`. O botão abre uma mensagem; o endereço também é visível para quem não tem cliente de e-mail. Não simula envio nem recebimento. O recebimento desse canal é confirmado pelo atendente.
- App: Minha conta → Excluir minha conta para todos os perfis; Mais → Excluir minha conta para gestores. O Aviso de Privacidade também dá acesso, inclusive sem academia. Na página, a pessoa autenticada informa novamente a senha e confirma as consequências. POST `/v1/auth/deletion-requests` retorna HTTP 202, protocolo e estado reais persistidos. A rota não passa pelo bloqueio de assinatura. O pedido não desativa a conta.
- Apenas o usuário da sessão pode solicitar. Não aceita ID/e-mail de terceiro, nem credencial de dispositivo. Senha incorreta retorna 403 sem remover a sessão. Há limitação de tentativas já usada pelo servidor (por IP/processo), lock transacional de usuário e unicidade por usuário. Repetições retornam o mesmo protocolo, sem reiniciar a data. Não há tokens por e-mail neste fluxo.
- Conclusão somente pelo operador, com acesso administrativo ao banco e caso revisado. Não existe endpoint de gestão dos pedidos acessível a gestores de academia. O login excluído vira uma referência sem nome/senha utilizável para preservar integridade de auditorias; isso é pseudonimização, não anonimização de todos os históricos.

## Operação obrigatória

Designar responsável pelo e-mail configurado e pela consulta da fila **antes de publicar**. O sistema não envia notificações de e-mail nem tem scheduler para a fila. A rotina de consulta deve ser definida pelo responsável; nenhum SLA foi inventado. O atendimento informa progresso, resultado e retenções pelo canal verificado. Não devolva existência de conta ou dados a um remetente não verificado.

1. Consultar a fila em conexão administrativa protegida, sem publicar resultados em logs:

```sql
SELECT r.id,r.status,r.requested_at,r.user_id,p.email
FROM account_deletion_requests r JOIN users u ON u.id=r.user_id
JOIN people p ON p.id=u.person_id
WHERE r.status<>'completed' ORDER BY r.requested_at;
```

2. Para pedido do app, a sessão e a senha verificaram o titular. Para pedido externo, responder ao endereço cadastrado, confirmar controle desse canal e a intenção antes de associar o pedido. Se perdeu esse acesso, executar avaliação proporcional de identidade em canal reservado; nunca pedir senha. Não basta alguém escrever o endereço da vítima. Depois de verificar, registrar com parâmetros vinculados pelo cliente SQL, não interpolação de texto:

```sql
INSERT INTO account_deletion_requests(id,user_id)
VALUES(gen_random_uuid(), :verified_user_id)
ON CONFLICT(user_id) DO NOTHING;
UPDATE account_deletion_requests SET status='reviewing'
WHERE id=:request_id AND status='received';
```

O protocolo externo é comunicado pelo atendente. Pedidos de pessoa sem login ou já excluída continuam no atendimento para tratar os registros da academia, sem criar conta ou divulgar sua existência.

3. Abrir caso restrito com referência opaca (8–200 caracteres). Registrar operador, prova mínima de verificação, escopo, ações executadas, decisões por categoria/academia, finalidade/base aplicável, prazo ou critério objetivo de fim e próxima revisão de cada retenção. Não guardar cópias de documentos sem necessidade. A referência será o único texto do caso salvo na tabela de pedidos. Não colocar nome, CPF, e-mail, senha ou token nela.

4. Inventariar **todos** os vínculos pelo `users.person_id`, não apenas a academia atual:

```sql
SELECT m.academy_id,m.id,m.status,r.role FROM memberships m
LEFT JOIN membership_roles r ON r.membership_id=m.id WHERE m.user_id=:user_id;
SELECT a.* FROM academy_participants a WHERE a.person_id=:person_id;
SELECT s.* FROM students s WHERE s.person_id=:person_id;
SELECT g.* FROM student_guardians g WHERE g.user_id=:user_id;
SELECT g.* FROM guardian_profiles g WHERE g.user_id=:user_id;
SELECT e.* FROM enrollment_submissions e WHERE e.user_id=:user_id;
```

Não exportar indiscriminadamente dados de dependentes/terceiros ao solicitante. O suporte deve procurar também referências da pessoa como pagador ou responsável em cadastros que não tenham seu ID de login.

| Dados reais do esquema | Tratamento antes da conclusão |
| --- | --- |
| `users`, `people`, `auth_sessions`, consentimentos, pedidos de vínculo | Finalizador remove senha, nome e e-mail de login, sessões, aceites e pedidos de acesso. IDs técnicos podem permanecer ligados a auditoria justificada. Revisar necessidade dessa rastreabilidade no caso. |
| `memberships`, `membership_roles`, `academy_participants` | Revisar todos os perfis. Finalizador remove papéis, bloqueia acesso e troca QR pessoal, preservando referências. CPF e número do participante exigem decisão por finalidade; apagar CPF sem justificativa (`cpf=''`). |
| `students`, nascimento, telefone, responsáveis, matrícula | A academia precisa decidir a finalidade de conservar cada campo, independentemente do login. Sem justificativa, remover identificação (`name='Pessoa excluída'`, `phone=''`, `birth_date=NULL`) e minimizar dados de pagador em `student_billing`. Arquivar/inativar não substitui esse trabalho. Matrícula com vínculo pessoal será desvinculada pelo finalizador. |
| `guardian_profiles`, `student_guardians`, `enrollment_submissions` | Finalizador remove perfil e autorizações pessoais, CPF e payload de propostas do solicitante. Avaliar dados da mesma pessoa dentro dos payloads de outros responsáveis; preservar os dados de crianças e terceiros que tenham finalidade válida. |
| `attendances`, `student_graduation_events`, `student_active_periods` | Rever possibilidade de eliminar ou pseudonimizar a identificação, preservando histórico compartilhado somente com justificativa. UUIDs vinculáveis não tornam o histórico anônimo. |
| `student_billing`, `invoices` (`payer_name`, `payer_document`), ajustes e recibos | Revisar titular pagador, contrato e cobranças pendentes. Minimizar identificadores dispensáveis. Valores, situação e comprovação não são apagados indiscriminadamente. Sem fundamento para retenção, executar tratamento específico revisado no caso. |
| `pix_charges`, `payment_events`, `checkout_attempts`, `checkout_inbox`, `checkout_receipts` | Conferir dados pessoais nos payloads, documentos, fingerprints e links; minimizar o que não for necessário após conciliação. Links e identificadores externos precisam de revisão no provedor, não basta apagar localmente. |
| `payment_connections`, auditorias, `enrollment_links`, `platform_subscription_*` | Credenciais e assinatura pertencem à academia; transferir responsabilidade. Referências de ator podem usar o usuário pseudonimizado. Examinar payloads e histórico para retenções justificadas. |
| `student_invitations`, `checkin_events` | Finalizador revoga convites aceitos pelo usuário e pendentes das suas matrículas, remove eventos pessoais de idempotência. Rever convites/payloads de dependentes no caso. |
| `devices` | Não há vínculo de propriedade pessoal: são credenciais da academia. Finalizador não os revoga. Se aparelho saiu da custódia da academia, gestor deve revogar explicitamente o dispositivo correspondente. |
| Backups, logs e fornecedores | Não existe política de prazo confirmada no repositório. Responsável deve levantar a configuração real, informar critério de expiração/restrição no caso, evitar restauração que reative credenciais e reaplicar tratamentos se restaurar backup. Acionar fornecedores para dados sob responsabilidade deles quando aplicável. |

Não existe lista universal de obrigações ou prazo legal implementado. Nenhum dado pode ser conservado só porque a tabela aparece acima. O atendimento precisa registrar a justificativa aplicável e executar a eliminação/minimização decidida. O finalizador **não substitui** essa análise nem apaga automaticamente toda ficha de aluno.

5. Responsabilidade: o esquema usa `membership_roles.role='admin'` e `memberships.status='active'`; não há campo proprietário/criador que autorize exclusão de academia. Se houver outros gestores, apresentar a transferência como escolha explícita ao solicitante, confirmar aceitação do gestor apto e registrar responsável por assinatura, contratos e atendimento dos alunos. Retirar o papel admin da pessoa somente após essa transferência, com revisão da lista completa de academias. Ser criador não impede receber pedido. Se for único gestor, organizar convite/aceitação de sucessor pelo fluxo Gestores ou caso separado de encerramento autorizado. **Não simplesmente remover o último admin.** Encerramento exige resolver alunos, contratos, cobrança, acesso, links de matrícula e dispositivos; não existe botão seguro de encerramento completo neste projeto. Manter pedido em revisão até execução desse plano pelo suporte, sem criar uma academia ativa órfã. Não converter bloqueio de login em conclusão.

6. Financeiro: assinatura TatameMix é por academia, via InfinitePay, checkout mensal por ação do gestor, sem débito automático. Transferir ao sucessor ou ajustar renovação pelo fluxo Minha assinatura conforme decisão expressa da academia. `renewal_enabled=false` não invalida links já emitidos. Mensalidades têm integração InfinitePay e caminho legado Asaas; conciliar com o provedor antes de cancelar cobranças. Não chamar endpoints bancários nem realizar pagamentos, estornos ou exclusões reais em desenvolvimento/testes. Dívida pendente não impede receber pedido; suporte precisa separar obrigação financeira da necessidade de manter identificadores. Não prometer cancelamento externo pela exclusão.

7. Conclusão: após executar tratamento dos dados, revisar retenções e preparar resposta ao titular, colocar API **e workers de todas as réplicas em manutenção** e drenar requisições. Esse é um procedimento administrativo manual: evita que alterações de vínculos, check-ins ou workers concorram com o tratamento. Não executar o SQL de tratamento com tráfego ativo. Em transação, executar ações específicas revisadas e finalizar:

```sql
BEGIN;
-- Executar aqui o tratamento aprovado e parametrizado para este caso.
SELECT complete_account_deletion(:request_id, :restricted_case_reference);
COMMIT;
```

O finalizador exige estado `reviewing`, referência do caso e ausência de qualquer papel admin ativo do usuário, mesmo quando há outros gestores. Bloqueia repetições concorrentes pelo pedido/usuário, é idempotente depois de concluído e não chama provedores. A transação revoga sessões, senha, vínculos pessoais e QR, remove dados de acesso e marca conclusão com horário. Preserva dispositivos compartilhados e registros de academia já tratados/revisados. Sessões novas para `deleted_at` são recusadas no backend, inclusive se um login verificou a senha antes da conclusão. A resposta ao titular deve distinguir dados eliminados, pseudonimizados e conservados. Não comunicar “todos os dados apagados” se houve retenção. Retomar o serviço e conferir que as outras contas/dispositivos continuam acessíveis.

8. Revisar o protocolo mínimo e o caso ao concluir: manter só o necessário para comprovar atendimento enquanto essa finalidade persistir; definir a revisão/eliminação no registro reservado. A tabela não contém cópia de contato nem conteúdo do pedido. Os critérios e configuração de retenção de backups ainda dependem do responsável; não usar isso como autorização para retenção ilimitada.

## Migração e publicação pelo responsável

Migração **021** incorporada pelo Go: tabela de pedidos, `users.deleted_at` e função administrativa `complete_account_deletion`. Startup da API aplica migrações como no restante do projeto. Fazer backup e validar primeiro em staging descartável. Não rodar rollback após pedidos reais sem plano de preservação; ele elimina a trilha de pedidos.

Nenhuma variável obrigatória nova. `EXPO_PUBLIC_PRIVACY_EMAIL` já substitui o contato confirmado; conferir que a caixa configurada recebe mensagens. `EXPO_PUBLIC_API_URL` deve apontar ao backend correto. Não colocar chaves administrativas no frontend. Versão legal passa a `2026-11-05` em backend e frontend: publicar ambos coordenadamente (clientes antigos podem precisar atualizar a tela de cadastro).

Backend/container: na raiz, `docker build -t tatamemix:account-deletion .`; publicar a imagem pelo procedimento de [Azure](AZURE.md), com as variáveis/segredos existentes, somente após revisão. As migrações estão no binário e o export web no container; reiniciar e verificar health e endpoint autenticado em staging. Docker não é necessário para a migração local de testes. Não montar o banco de testes sobre banco real.

Vercel: Root Directory `mobile`, instalar com `npm ci`, configurar URL da API e contato, `npm run build:web`, saída `dist`; a regra SPA existente permite abrir `/delete-account` diretamente. Backend primeiro, frontend em seguida. O portal integrado também tem fallback SPA. Compilar novo app com EAS pelo procedimento existente para distribuir o acesso no menu. Não houve deploy, build Android ou verificação em dispositivo físico nesta tarefa.

Verificação de publicação pelo responsável: abrir a URL HTTPS final `/delete-account` em janela anônima e sem app instalado; verificar nome, endereço de atendimento e início de pedido; testar confirmação/recebimento no canal; testar pedido autenticado e sua fila em staging; confirmar que conta de outra academia não é exposta. Só então usar essa URL no Console. Nenhum domínio final foi presumido.

## Google Play Console

Documentação oficial consultada em 05/11/2026: [exclusão de conta](https://support.google.com/googleplay/android-developer/answer/13327111?hl=pt-BR) e [Segurança dos dados](https://support.google.com/googleplay/android-developer/answer/10787469?hl=pt-BR). Google permite um recurso web de solicitação; deve ser funcional, identificável e fácil de encontrar. Não é exigida execução instantânea, mas o fluxo precisa efetivamente tratar os pedidos.

Após publicar e validar a operação: Play Console → Política e programas → Conteúdo do app → Segurança dos dados → Gerenciar. Informar criação de conta por **nome de usuário e senha** (e-mail é o identificador neste app); indicar que é possível solicitar exclusão de conta e dados associados; no campo de link para exclusão inserir a **URL HTTPS verificada terminada em `/delete-account`**. Não inserir mailto, URL de login nem URL presumida. Se perguntado sobre exclusão de dados sem excluir a conta, este fluxo só confirma exclusão de conta e dados associados; não declarar uma função separada automática que não existe. Revisar a redação exibida na versão atual do formulário e declarar o canal manual existente com suas exceções de retenção.

Atualizar o link da política para `/privacy` no domínio verificado. Não marcar exclusão automática em prazo fixo nem ausência de retenção. As demais respostas de coleta/compartilhamento, criptografia e SDKs precisam refletir a implantação real; esta alteração não valida toda a declaração de Segurança dos dados. Não declarar conformidade final antes de testar a caixa de atendimento, a fila e o procedimento de conclusão com o responsável.

## Validação desta entrega

- `go test ./... -p 1 -count=1` passou com `TEST_DATABASE_URL` apontando exclusivamente para cluster PostgreSQL 18 descartável em `127.0.0.1:55439`. Migrações 001–021 aplicadas nesse cluster; provedores externos simulados. Testes legados que exigem variáveis de cópia/migração específicas continuaram ignorados, sem usar cópia de produção.
- `TestAccountDeletion` passou novamente após ampliar os cenários: conta comum, duas academias, múltiplos gestores, único gestor, transferência explícita obrigatória em cada academia, senha inválida, falta de confirmação, anonimato, tentativa de ID de terceiro, dispositivo sem conta pessoal, repetição concorrente do pedido, conclusão idempotente, revogação de sessão e login, recusa de nova sessão do usuário excluído, manutenção de dispositivo compartilhado e preservação/desvinculação de matrículas nas duas academias.
- `go vet ./...`, `npm run typecheck`, `npm run lint`, `npm run test:access` (16 testes) e `npm run export:web` passaram. `git diff --check` sem erros de whitespace.
- A restrição de sockets do sandbox impediu a primeira execução dos testes locais; a suíte passou com permissão de rede local e servidor descartável no mesmo processo de verificação. Nenhum banco principal/Neon foi conectado. O cluster de teste foi parado ao final.
- Limites: sem build Docker (Docker indisponível neste ambiente), sem build Android, teste físico ou inspeção visual em navegador; caixa de atendimento, hospedagem final e retenção real de backups não foram verificadas. Nenhum pagamento, reembolso, alteração de banco real ou deploy foi executado. O atendimento manual precisa de responsável designado e decisões de retenção reais antes da publicação.
