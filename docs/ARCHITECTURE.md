# Arquitetura do TatameMix

Uma API Go organizada em funcionalidades e um aplicativo Expo/React Native com versão web. O backend recebe HTTP com net/http, aplica regras e executa SQL parametrizado pelo pgx. PostgreSQL mantém a integridade entre academias. Migrações Goose ficam incorporadas no executável.

## Contas, academias e alunos

people é a identidade canônica: armazena o único e-mail da pessoa, normalizado e único, ou NULL quando ela ainda não informou e-mail. users referencia person_id e guarda login/nome/senha; auth_sessions continua referenciando o mesmo user_id. academies e memberships representam academias e papéis de acesso.

academy_participants relaciona pessoa e academia e guarda CPF, código e QR, com unicidade por academia/pessoa. students é a matrícula comercial opcional, relacionada à mesma pessoa/participação, podendo existir antes do login. Chaves compostas impedem apontar matrícula e conta para identidades distintas. Modalidades, plano, responsável e cobrança continuam associados à matrícula.

O gestor já recebe uma participação ao criar a academia. Pode treinar por CPF/QR e consultar histórico sem matrícula comercial. Gestor/professor ativo é elegível independentemente da situação de uma matrícula comercial; aluno comum exige matrícula ativa e não arquivada. Nenhum papel ganha cobrança automaticamente.

Criar matrícula com e-mail existente exige confirmação explícita de reutilização. Essa confirmação não concede acesso à identidade; só o convite aceito pela conta correspondente vincula user_id/papel. use_my_account permite ao próprio gestor vincular sua matrícula opcional, validando a identidade autenticada. Registrar login de e-mail já cadastrado como contato de aluno reutiliza a pessoa, mas não cria vínculo com a academia até aceitar convite.

Convites armazenam somente hash do token, validade de sete dias, revogação e aceite único em transação. Os logs de requisição ocultam o token da rota. A tela pública mantém seu destino ao encaminhar para login/cadastro.

Dados pertencem a uma academia. Consultas sempre usam academy_id e relações financeiras, modalidades e presenças usam chaves estrangeiras compostas. Alunos só leem os dados vinculados à própria conta. Cadastros inativos conservam consulta de mensalidades e histórico; dispositivos registram check-in por identificação, e gestores ativos podem lançar presença de aluno escolhendo data e aula.

## Entrada e contexto no aplicativo

A autenticação usa um único formulário de e-mail e senha, sem seleção de perfil antes do login. SessionProvider consulta academias com uma chave de cache por user_id. access.ts resolve o destino apenas entre papéis autorizados pela resposta atual: uma única opção entra diretamente, a última seleção válida por usuário é restaurada, e múltiplas opções sem preferência exigem escolha após autenticar. A antiga preferência global tatame.login-area é ignorada.

A preferência guarda somente academyId e papel, separada do token, por usuário em SecureStore ou sessionStorage na web. Ao restaurar uma página, os gates aguardam a consulta antes de liberar o conteúdo. Preferências inválidas ou de acesso removido não são restauradas. Sair limpa credenciais e cache; trocar academia mantém consultas identificadas por academia, e callbacks de seleção de outra sessão são ignorados.

entry é o resolvedor; academies é o seletor explícito; create-academy recebe o primeiro cadastro e o atalho de Mais. Contas sem vínculos recebem orientação sobre convite e uma ação explícita para cadastrar academia. onboarding redireciona para entry por compatibilidade. Convites e pagamentos conservam o destino específico após o login; o link de pagamento prioriza o papel de aluno quando autorizado, e gestores sem esse papel conservam seu acesso administrativo. Destinos internos podem sugerir uma área por parâmetro, sempre restrita às permissões atuais. Parâmetros antigos de área na URL de login não determinam o perfil.

## Ajustes de mensalidades

payments.Manager concentra desconto pontual e recebimento manual. A autorização exige gestor ativo da academia. expected_amount_cents confirma o valor visto pelo operador; uma alteração concorrente retorna 409. Desconto é um valor total em centavos, substituível ou removível, e amount_cents permanece o total líquido. original_amount_cents é a soma do líquido com discount_cents. student_billing e faturas futuras não são modificados.

invoice_adjustments mantém uma trilha de autor, data, valores anterior/novo, motivo e forma de recebimento. A atualização da mensalidade e a auditoria são confirmadas na mesma transação curta, com bloqueio da fatura e nova conferência de autorização. Uma restrição parcial permite apenas uma baixa manual por mensalidade. Pagamentos manuais são distintos de payment_receipts bancários.

A lease por mensalidade serializa emissão Pix, ajustes, webhook e reconciliação. Chamadas ao Asaas ficam fora da transação SQL. Antes do ajuste, o Pix anterior é consultado, encerrado e confirmado como excluído; resposta perdida é recuperada na tentativa seguinte. pix_charges conserva o valor emitido em cada cobrança, inclusive nas substituídas. Notificações antigas de cobranças retiradas não desfazem a baixa manual; recebimento tardio em Pix substituído retorna payment_review para conferência, sem alterar silenciosamente o fechamento local.

O aplicativo invalida os caches financeiros após confirmar, apresenta o total líquido e só mostra o QR obtido para aquele valor. Estudantes consultam sua cobrança sem ações administrativas. O histórico de ajustes é consultado sob demanda pelo gestor.

## Evolução e atividade do aluno

student_graduation_events é uma trilha de mudanças por aluno/modalidade, com faixa/graus anterior e novo, autor, data e ordem estável. Triggers capturam INSERT/UPDATE; a API usa set_config transacional para a autoria autenticada. Save faz upsert das modalidades e remove somente as ausentes, evitando apagar/recriar graduações em edições financeiras. Alteração idêntica não cria evento e falhas revertem estado e histórico juntos.

A migração 010 registra a graduação legada como baseline com occurred_at nulo; novas matrículas usam initial. Apenas mudanças efetivas recebem occurred_at. Remover uma modalidade conserva a trilha; retornar com a mesma faixa não inventa outra conquista.

student_active_periods acompanha transições de ativo/inativo e arquivamento/restauração, com no máximo um período aberto por aluno. A contagem soma intervalos registrados e exclui pausas. Cadastros antigos começam o acompanhamento na migração, conservando created_at como data original de entrada. O endpoint de progresso exige gestor da academia e pagina o histórico com filtro de modalidade.

## Mensalidades

student_billing configura um único total, dia do vencimento, próximo mês e pagador por aluno. plans sugere valor/modalidades sem obrigar vínculo.

GenerateTx bloqueia configuração e aluno durante a geração. Uma configuração ativa sem nenhuma fatura emite sua primeira cobrança mesmo se o mês for futuro. GenerateFirstTx também emite a primeira competência escolhida numa reativação. A próxima competência avança uma vez; o worker normal só emite os meses seguintes quando chegarem. A restrição academia/aluno/competência evita duplicação entre instâncias. Ao editar, a API gera competências já devidas com a configuração anterior e preserva cada invoice emitida. Próximas emissões usam a configuração nova. O worker roda ao iniciar e a cada minuto, recuperando interrupções enquanto a cobrança estiver ativa.

Os valores são inteiros em centavos; conversão para o provedor usa decimal exato. Vencimentos são datas da academia, enquanto aulas e presenças usam timestamptz em UTC e são apresentadas em seu fuso. O fuso inicial é America/Sao_Paulo.

## Modalidades, graduações e forma de cobrança

A migração 003 estende student_modalities com belt e amount_cents. O catálogo modalities guarda preço avulso e belt_options (rótulo e uma a três cores). O cadastro de aluno conserva o campo belt legado e acrescenta alternate_phone e charge_mode. As consultas e as validações permanecem limitadas à academia, incluindo o plano e cada modalidade.

No modo modalities, normalizeEnrollments calcula a soma; valores negativos, repetições, graduações não configuradas e referências de outra academia são recusados. No modo plan, o aluno utiliza as modalidades do pacote e um valor mensal acordado. custom conserva contratos anteriores. A faixa retirada do catálogo pode permanecer no aluno que já a possuía, sem ser atribuída a novos alunos.

O preço por aluno é persistido como valor contratado. O catálogo serve para preencher novos cadastros e não altera mensalidades emitidas. student_billing aceita zero somente com cobrança desativada. A gravação valida as referências e atualiza cadastro, modalidades e configuração financeira na mesma transação. O aluno é bloqueado antes da configuração financeira tanto na edição quanto no gerador, mantendo uma ordem de locks consistente.

A confirmação do tablet e as listas de presença consultam a faixa da modalidade da turma. As credenciais, os IDs de presenças e os resultados idempotentes existentes são preservados.

O frontend compartilha FormWizard e FormScrollContext: apenas a etapa atual é exibida, os valores ficam no formulário pai e o scroll volta ao início ao trocar de etapa. As seções permanecem montadas quando o gesto é desativado, evitando perda do estado do formulário.

## Asaas

Configuração privada por academia é carregada de um arquivo JSON no servidor. O cliente HTTP usa access_token e timeout. Nenhuma credencial é entregue ao aplicativo.

pix_charges reserva a externalReference antes de criar o Pix. Operações de emissão/cancelamento têm bloqueio temporário por mensalidade no PostgreSQL. A restrição de cobrança atual e o estado creating/uncertain impedem emissões duplicadas em reenvios ou perda de resposta.

O webhook verifica asaas-access-token e busca o pagamento na conta da academia. Repository.Apply compara referência, identificador, tipo PIX e valor antes de registrar payment_receipts e dar baixa na mesma transação. Notificações repetidas/outros eventos consultam o estado atual. O worker reconcilia cobranças independentemente do webhook.

## Tablet

Ativar dispositivo revoga a sessão pessoal daquele aparelho. O token do tablet permite consultar a janela atual da grade e registrar identificação por CPF/QR/código na sua academia. attendance-options lê horários sem criar ocorrências; a janela vai de 15 minutos antes até o fim da aula, no fuso da academia, incluindo aulas que atravessam meia-noite. Sobreposição exige escolha explícita.

O check-in bloqueia dispositivo, chave idempotente, turma/aula e matrícula quando houver, depois a participação, para verificar revogação, cancelamento, janela e inativação. O lançamento manual bloqueia o vínculo/papel ativo do gestor antes da escrita. A aula da grade é criada na mesma transação da primeira presença, sem etapa de abertura. O gestor pode completar uma aula encerrada; o tablet não pode escolher uma data fora da janela atual. Presença e resultado idempotente são gravados juntos. Cada academia/aula/participação tem uma única presença; duas tentativas concorrentes retornam o registro existente. Uma matrícula criada depois do primeiro treino reaproveita a participação e o histórico. Reusar a mesma chave com dados diferentes é recusado. checked_in_at mantém o momento real da escrita; class_sessions.starts_at determina a data do treino nos filtros e indicadores. source é derivado de recorded_by_user_id/device_id, preservando a autoria original de duplicatas. attendances.participant_id substitui o nome legado membership_id no banco; respostas e eventos antigos continuam compatíveis.

As APIs legadas de vínculos/papéis permanecem para compatibilidade e registros anteriores. A nova navegação não apresenta solicitações nem uma área de professor. O frontend não decide autorização: o backend verifica acesso em todas as operações.

## Grade semanal permanente

classes e class_schedules representam a grade fixa da academia, sem data de término. O fim do intervalo de uma aula e o status de uma class_sessions não alteram a situação da turma nem expiram seus horários semanais. A turma permanece até o gestor editar, pausar ou excluir. Cada class_sessions representa apenas uma data de treino, com suas próprias presenças.

O formulário apresenta início e fim de cada intervalo, inclusive vários pares nos mesmos dias e intervalos que cruzam a meia-noite. O frontend converte os pares para start_time/duration_minutes, preservando o contrato da API e os horários já cadastrados. A duração no banco define a janela de cada encontro, sem limitar a repetição semanal. Não foi necessária migração.

## Data informada de entrada na academia

students.started_on guarda uma data civil no fuso da academia, separada de created_at. A migração 011 preenche os registros antigos com a data local do cadastro; um trigger BEFORE INSERT conserva compatibilidade com importações que omitem o campo. O formulário pode informar uma data histórica válida. PATCH completo sem started_on preserva o valor existente.

PATCH /students/{id}/start-date altera somente started_on, com bloqueio da linha e expected_started_on para detectar edição concorrente. Reenvio do mesmo resultado é idempotente. A autorização é de gestor ativo da academia e o aluno não pode estar arquivado. Não chama geração financeira nem altera períodos de atividade ou eventos de graduação. Progress retorna started_on e tenure_days (dias civis), preservando joined_at como a criação original e active_days como tempo efetivamente acompanhado.
