# Estudo de check-in offline

O aplicativo entregue confirma presenças apenas após resposta da API. Este laboratório é separado do aplicativo.

## Executar
Com Node 24 (ou Node 22.13+ com node:sqlite):
    node --test tools/offline-lab/queue.test.mjs

A fila e os snapshots de aulas e alunos por academia usam SQLite real. O cache conserva a data da atualização; sua existência não confirma presença. O servidor didático usa memória para demonstrar as decisões. A concorrência e as transações do servidor de produção são verificadas separadamente pelos testes Go com PostgreSQL.

## O que estudar
1. Um evento recebe seu UUID antes do envio. Ele conserva esse UUID enquanto estiver pendente.
2. A interface informa "Presença pendente de sincronização"; ainda não mostra presença confirmada.
3. Se o servidor salva e a resposta se perde, o tablet reenvia o mesmo evento.
4. Eventos de dois tablets podem ter UUIDs diferentes. A restrição por academia/aula/aluno impede duas presenças.
5. Falhas de rede mantêm o evento pendente. Recusas de negócio deixam o evento disponível para revisão, com motivo.
6. O horário informado pelo aparelho é evidência auxiliar. O servidor registra também seu próprio horário; um relógio local não comprova presença.
7. Login inicial, autorização do tablet, cadastro, aprovação e abertura de aulas continuam exigindo internet.

## Política antes de ativar em produção
- Baixar previamente aulas e uma lista mínima de alunos autorizados, com data de atualização.
- Estabelecer validade do cache e limite do período offline com a academia.
- Confirmar no servidor autorização do dispositivo, vínculo do aluno e validade da aula.
- Manter registros recusados para revisão pelo gestor; não transformá-los silenciosamente em presença.
- Restringir a sincronização ao aparelho autorizado. Não levar a credencial pessoal do gestor para a fila.
- Sincronizar ao recuperar conexão com o app aberto e ao reabrir o app. Tarefas em segundo plano dependem do sistema operacional.
- Revisar fila e cache antes de trocar academia, sair do modo tablet ou limpar dados.

Para transferir o protótipo ao tablet, substitua node:sqlite por expo-sqlite, mantenha o UUID e as tabelas por academia e implemente uma rota restrita ao dispositivo para baixar o snapshot mínimo. A credencial do MVP ainda não permite baixar alunos; essa ampliação precisa de revisão antes de ativar o offline.

O laboratório não implementa validação criptográfica de QR offline, cache de alunos no app ou sincronização em segundo plano. Esses pontos pertencem à próxima versão, após os experimentos.
