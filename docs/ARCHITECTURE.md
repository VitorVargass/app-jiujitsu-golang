# Arquitetura do Tatame

Uma API Go organizada em funcionalidades e um aplicativo Expo/React Native com versão web. O backend recebe HTTP com net/http, aplica regras e executa SQL parametrizado pelo pgx. PostgreSQL mantém a integridade entre academias. Migrações Goose ficam incorporadas no executável.

## Contas, academias e alunos

users e auth_sessions representam login pessoal. academies e memberships representam academias e papéis de acesso. students representa a pessoa matriculada na academia, podendo existir sem user_id. O aceite de convite associa uma conta e adiciona o papel de aluno sem criar uma segunda pessoa no histórico.

Convites armazenam somente hash do token, validade de sete dias, revogação e aceite único em transação. Os logs de requisição ocultam o token da rota. A tela pública mantém seu destino ao encaminhar para login/cadastro.

Dados pertencem a uma academia. Consultas sempre usam academy_id e relações financeiras, modalidades e presenças usam chaves estrangeiras compostas. Alunos só leem os dados vinculados à própria conta. Cadastros inativos conservam consulta de mensalidades e histórico; somente dispositivos registram presença.

## Mensalidades

student_billing configura um único total, dia do vencimento, próximo mês e pagador por aluno. plans sugere valor/modalidades sem obrigar vínculo.

GenerateTx bloqueia configuração e aluno durante a geração. A restrição academia/aluno/competência evita duplicação entre instâncias. Ao editar, a API gera competências já devidas com a configuração anterior e preserva cada invoice emitida. Próximas emissões usam a configuração nova. O worker roda ao iniciar e a cada minuto, recuperando interrupções enquanto a cobrança estiver ativa.

Os valores são inteiros em centavos; conversão para o provedor usa decimal exato. Vencimentos são datas da academia, enquanto aulas e presenças usam timestamptz em UTC e são apresentadas em seu fuso. O fuso inicial é America/Sao_Paulo.

## Asaas

Configuração privada por academia é carregada de um arquivo JSON no servidor. O cliente HTTP usa access_token e timeout. Nenhuma credencial é entregue ao aplicativo.

pix_charges reserva a externalReference antes de criar o Pix. Operações de emissão/cancelamento têm bloqueio temporário por mensalidade no PostgreSQL. A restrição de cobrança atual e o estado creating/uncertain impedem emissões duplicadas em reenvios ou perda de resposta.

O webhook verifica asaas-access-token e busca o pagamento na conta da academia. Repository.Apply compara referência, identificador, tipo PIX e valor antes de registrar payment_receipts e dar baixa na mesma transação. Notificações repetidas/outros eventos consultam o estado atual. O worker reconcilia cobranças independentemente do webhook.

## Tablet

Ativar dispositivo revoga a sessão pessoal daquele aparelho. O token do tablet permite consultar aulas abertas e registrar identificação por QR/código na sua academia.

O check-in bloqueia dispositivo, aula e aluno para verificar revogação, encerramento e inativação. Presença e resultado idempotente são gravados juntos. Cada academia/aula/aluno tem uma única presença; duas tentativas concorrentes retornam o registro existente. Reusar a mesma chave com dados diferentes é recusado.

As APIs legadas de vínculos/papéis permanecem para compatibilidade e registros anteriores. A nova navegação não apresenta solicitações nem uma área de professor. O frontend não decide autorização: o backend verifica acesso em todas as operações.
