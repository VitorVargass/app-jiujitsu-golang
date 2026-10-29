# Matrículas pelo link da academia

Em **Mais → Matrículas pelo link**, a gestora escolhe as ofertas públicas, ativa as matrículas e salva. O aluno escolhe seu próprio dia de vencimento ao se cadastrar. O mesmo link pode ser enviado para várias pessoas. É possível suspendê-lo ou gerar outro; a troca invalida o link antigo sem remover cadastros ou pedidos.

## Conta e matrícula

O aluno adulto usa a própria conta. Para menores, o responsável cria a conta em seu próprio nome e e-mail. São obrigatórios os CPFs e nascimentos separados do aluno e do responsável adulto. Os contatos ficam no cadastro do aluno; o nome e e-mail do responsável vêm da conta autenticada. A mesma conta pode matricular vários filhos, sem duplicar seu e-mail nas identidades das crianças.

O cadastro tem identificação, plano/modalidades com graduação e escolha do vencimento, e revisão. O dia de vencimento é selecionado pelo aluno, de 1 a 31, considerando o que já costuma pagar ou combinou com a academia. A academia publica planos/combos e/ou modalidades avulsas com preço definido. O servidor recalcula o valor; não aceita preços escolhidos pelo navegador. Planos com modalidades inativas ficam indisponíveis.

Para um novo CPF, a matrícula é ativada e uma mensalidade é emitida com o **próximo vencimento estritamente futuro escolhido pelo aluno**, no fuso da academia. No próprio dia do vencimento, começa no mês seguinte. Dias 29–31 são ajustados ao último dia do mês. Não há pagamento automático nem emissão de checkout ao se matricular. O portal do aluno mostra também mensalidades futuras; o financeiro do gestor continua iniciando em este mês.

## Cadastros antigos

Um CPF já matriculado gera pedido pendente. Não revela nome, dados ou histórico existentes para o solicitante, não duplica a matrícula, não altera cobrança, não restaura aluno arquivado e não muda identidade/e-mail canônicos.

A gestora confere a identidade e o nascimento por um canal conhecido e aprova ou recusa em **Matrículas pelo link**. Para menores, confira também a legitimidade do responsável. Aluno inativo ou arquivado precisa ser reativado antes. Uma matrícula de adulto já associada a outra conta não é transferida automaticamente. Pedidos recusados devem ser tratados com a academia.

Aprovar cria um acesso explícito ao cadastro, preservando sua identidade original. Esse acesso permite consultar e pagar mensalidades, consultar presenças e exibir QR/número. Não concede permissões administrativas. É possível remover acessos adicionais na mesma tela. A conta pode escolher o filho consultado nas três seções do portal. Convites individuais anteriores continuam funcionando.

## Backend e migração

A migração aditiva **014_shared_enrollment.sql** cria links, perfis de responsável, vínculos de acesso e registros de matrícula/pedido. O papel interno `guardian` utiliza a apresentação de aluno, sem gerar uma matrícula fictícia para o responsável. Há paginação das listas administrativas. Tokens de link são omitidos dos logs da API.

Antes de iniciar a API atualizada contra um banco existente, faça backup: as migrações são executadas na inicialização. Esta implementação foi validada em PostgreSQL temporário; não aplicou a migração ao banco local do aplicativo nem ao Neon. Para voltar ao esquema anterior, restaure um backup revisado; o downgrade automático é recusado para preservar o histórico de acessos.

Matrícula, vínculo, contrato e primeira mensalidade são gravados na mesma transação. O link e a academia são bloqueados/revalidados antes de gravar; chamadas simultâneas e reenvios não duplicam alunos nem cobranças. A mesma chave de idempotência com outro conteúdo retorna conflito. Configuração bancária e checkout existentes são preservados; a autorização de pagamento passa a reconhecer o vínculo familiar ativo.

## Validação

Testes com PostgreSQL isolado cobrem dois filhos, concorrência, preços alterados, conta adulta, planos, aprovação, revogação, isolamento entre academias e de alunos. Testes unitários cobrem próximo vencimento, fim do mês e ano bissexto. TypeScript, lint, testes do frontend e exportação web também devem passar. A validação visual usa dados fictícios. Nenhum pagamento real é realizado por esses testes.

## Ajustar um vencimento

O gestor abre **Alunos → aluno → cobrança** e altera o dia do vencimento. A alteração vale para próximas emissões; mensalidades já emitidas mantêm suas datas e histórico. O dia escolhido pelo aluno nunca libera alteração de plano ou cobrança de um CPF já existente sem revisão da gestora.

A prévia pública aceita `?due_day=20` e calcula `first_due` no servidor. A matrícula envia `due_day`, valida 1–31, grava esse dia no contrato e emite uma única primeira mensalidade na mesma transação. Um reenvio com o mesmo Idempotency-Key e outro dia retorna conflito. Clientes antigos que ainda omitirem o campo mantêm o dia de compatibilidade já salvo na academia; ele não é mais apresentado como configuração obrigatória na nova interface.

Esta mudança usa as tabelas e o editor financeiro existentes, sem nova migração ou variável de ambiente. Não aplica alterações ao banco local do aplicativo nem ao Neon durante a validação.
