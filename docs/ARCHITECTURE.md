# Arquitetura e roteiro de estudo

## Uma conta, vários vínculos
users é a pessoa. academies é a organização. memberships é o vínculo entre elas, com status e faixa atual. membership_roles concede papéis no vínculo; uma pessoa pode ser aluno numa academia e professor em outra. Criar uma academia concede apenas a gestão da academia criada.

Solicitações de aluno e professor entram em membership_requests. Um botão ou rota no frontend nunca concede permissão; a API consulta o vínculo ativo e os papéis.

## Caminho de um check-in
1. A tela de tablet em mobile/src/features/kiosk cria um UUID de tentativa.
2. services/api envia o token do dispositivo, Idempotency-Key e a identificação do aluno.
3. httpapi registra a rota. auth verifica a credencial e põe um Principal no context.
4. attendance.Handler decodifica o JSON; attendance.Service valida a entrada e autorização do responsável.
5. attendance.Repository.Record abre a transação. As verificações de estado que precisam ser atômicas, como aula aberta e vínculo ativo, ocorrem dentro dessa operação.
6. PostgreSQL protege unicidade e relacionamentos por academia.
7. O resultado volta em JSON. A tela só apresenta Presença registrada após a resposta.

Use esse fluxo para estudar context.Context, structs, métodos, ponteiros, erros, net/http, interfaces do pgx e transações. Comece pelo módulo attendance e pelos seus testes de integração.

## Dois identificadores, dois problemas
Idempotency-Key identifica uma tentativa. Se a resposta se perder, reenviar a mesma tentativa devolve o resultado gravado.

A restrição UNIQUE(academy_id,session_id,membership_id) identifica uma presença. Dois tablets podem gerar tentativas diferentes e ainda assim convergir para a mesma presença.

O bloqueio consultivo do PostgreSQL serializa reenvios do mesmo evento. A presença e o resultado do evento são gravados na mesma transação. A chave não pode ser reaproveitada com outro corpo.

## Turma, horário e aula
classes guarda modalidade/nome e professor responsável. class_schedules guarda os horários semanais. class_sessions é a ocorrência de um horário em uma data.

O professor abre a aula do dia, e a API materializa sua ocorrência sem duplicar. A aula encerrada não pode ser reaberta por repetir o pedido. Qualquer aluno ativo da academia pode participar.

Datas de ocorrência são gravadas em UTC. A semana e as datas dos dashboards respeitam o fuso da academia.

## Sessões e tablet
O token opaco contém aleatoriedade, não papéis. Seu hash fica no banco; a credencial pessoal expira em 30 dias e pode ser revogada.

O QR identifica o vínculo do aluno. Ele não autoriza uma chamada à API. Quem registra a presença precisa de uma sessão de professor/gestor autorizado ou credencial ativa de tablet daquela academia.

Provisionar um tablet revoga a sessão pessoal usada no provisionamento na mesma transação. O token do tablet consulta somente aulas abertas e registra check-in. O gestor pode revogá-lo.

## Frontend
Expo Router organiza as rotas; cada arquivo de rota apresenta uma tela de features. TanStack Query compartilha consultas e invalida resultados após alterações. O cache é limpo ao trocar sessão ou academia.

SecureStore guarda a credencial no Android. O preview web usa sessionStorage apenas para testes. A seleção de academia é refeita após recarregar o app, permitindo consultar os vínculos atuais.

O dashboard aceita role quando o usuário deseja consultar um papel específico; a API verifica se esse papel foi concedido.

## Extensões futuras
O estudo offline está em OFFLINE.md e no laboratório tools/offline-lab. Pagamentos, recuperação de conta, graduação e publicação exigem novas regras e integrações; não estão misturados aos fluxos do MVP.
