# Demonstração TatameMix: um container + PostgreSQL separado

A publicação principal usa uma única imagem Docker com o portal web Expo compilado e a API Go. O banco fica no Neon. Site e API compartilham um endereço HTTPS.

    Navegador → Container TatameMix (site + API Go) → PostgreSQL Neon

O Dockerfile da raiz instala e compila o frontend em uma etapa Node, compila a API em outra etapa Go e copia os dois resultados para uma imagem final Alpine. Ao executar, apenas a API Go fica em funcionamento: ela entrega tanto as páginas quanto os endpoints /v1. Não é necessário iniciar Expo ou um servidor Node na hospedagem.

| Recurso | Onde fica |
| --- | --- |
| Site e API | Um Web Service Docker no Render |
| Banco persistente | PostgreSQL no Neon |
| Código | Mesmo repositório GitHub, branch master |
| Pasta raiz do deploy | Raiz do repositório, sem restringir a backend ou mobile |

A Vercel deixa de ser necessária para este formato. mobile/vercel.json e backend/Dockerfile continuam disponíveis para a alternativa de publicar separadamente.

## 1. Enviar os arquivos para o GitHub

No VS Code, revise as alterações, faça o commit e envie para VitorVargass/app-jiujitsu-golang, branch master. Inclua Dockerfile e .dockerignore da raiz, render.yaml e as alterações do frontend.

Não envie .env, credenciais bancárias, certificados ou backups. O Dockerfile não usa o .env local: a versão web acessa a API pelo mesmo endereço do site.

## 2. Preparar o PostgreSQL Neon

1. Crie um projeto tatamemix-demo no plano Free do Neon.
2. Escolha uma região próxima à região do Render. Confira a compatibilidade da versão do PostgreSQL se importar dados locais.
3. Em Connect, selecione database e usuário.
4. Desative Connection pooling para esta primeira configuração. Use a conexão direta, pois a API também aplica migrações e configuração por sessão.
5. Preserve a configuração SSL da connection string.

A connection string vai exclusivamente na variável DATABASE_URL do serviço Render. Ela contém uma senha: não a coloque no GitHub, no frontend ou em mensagens.

Se quiser conservar a academia local e os exemplos, faça a importação descrita na etapa 5 antes de iniciar a API.

## 3. Subir o container no Render

O render.yaml da raiz configura um único serviço Docker Free com healthcheck /healthz. Ele não cria banco no Render.

### Usando o Blueprint

1. Render → New → Blueprint.
2. Conecte VitorVargass/app-jiujitsu-golang e selecione a branch master.
3. Use o render.yaml da raiz.
4. Quando solicitado, preencha DATABASE_URL com a conexão Neon.
5. Confira que o serviço é Free e aplique.

### Usando o formulário manual

Render → New → Web Service → conectar o mesmo repositório:

| Campo | Valor |
| --- | --- |
| Name | tatamemix-demo |
| Branch | master |
| Language / Runtime | Docker |
| Root Directory | Deixe vazio: raiz do repositório |
| Dockerfile Path | ./Dockerfile |
| Docker Build Context | . |
| Instance Type | Free |
| Health Check Path | /healthz |
| DATABASE_URL | Conexão direta Neon com SSL |

Não use backend/Dockerfile neste deploy: esse arquivo contém somente a API. O Dockerfile da raiz precisa enxergar backend e mobile juntos.

A API usa a PORT da hospedagem quando HTTP_ADDR não está definido. O Dockerfile já define WEB_DIST_DIR=/app/web. Não configure HTTP_ADDR nem substitua WEB_DIST_DIR. Deixe ASAAS_CONNECTIONS_FILE sem configuração nesta demonstração.

### Atualizar o serviço que já existe

Não é necessário criar outro Web Service nem recriar o banco Neon.

1. Envie todas as alterações para o GitHub, incluindo os arquivos novos de Go, TypeScript e migrações SQL, além de Dockerfile, .dockerignore e render.yaml da raiz.
2. No serviço existente, confira Runtime Docker, Root Directory vazio, Dockerfile Path ./Dockerfile e contexto de build na raiz.
3. Preserve DATABASE_URL com a conexão Neon. Deixe Docker Command vazio para usar a inicialização da imagem. Não defina HTTP_ADDR nem uma URL local do Expo no Render.
4. Use Manual Deploy → Deploy latest commit, caso o deploy automático não esteja habilitado.
5. Confira os logs e depois /healthz e /finance no endereço do serviço.

O build faz a exportação web e a verificação TypeScript, verifica os módulos Go e compila a API Linux. A imagem final contém somente o executável, os arquivos web, certificados raiz e fusos horários; Expo, Node e as ferramentas de desenvolvimento ficam nas etapas de compilação. Configurações .env, backups e diretórios .tools, inclusive dentro de backend, são excluídos do contexto.

A API aplica as migrações SQL incorporadas ao iniciar. Nesta atualização, a migração 012 padroniza os números antigos dos alunos em cinco dígitos, preservando QR Codes e históricos. Salve um backup do Neon antes desse deploy. Não é necessário executar seed nem importar novamente os dados.

## 4. Abrir e conferir

Após o deploy, o Render fornece um endereço HTTPS. Abra esse endereço seguido de /healthz e aguarde status ok. Depois abra o endereço principal para entrar no TatameMix.

Não é necessário configurar EXPO_PUBLIC_API_URL no painel: a imagem já é compilada com same-origin, e as chamadas usam /v1 no próprio domínio. Convites usam a origem do navegador. ALLOWED_ORIGINS só precisa de configuração adicional se outro site em domínio diferente for chamar essa API.

Confira:

- Login e dados do painel.
- Recarregar /login e uma página interna.
- Alunos, turmas, mensalidades, evolução e histórico.
- Check-in pelo número de 5 dígitos do aluno e QR.
- Troca entre câmera frontal/traseira em aparelho com HTTPS.
- Links de convite e mensalidade apontando ao domínio público.

O envio de código não importa dados automaticamente. Se a conta local não existir na hospedagem, verifique se você restaurou a base correta ou cadastre uma nova conta.

## 5. Manter a academia e os exemplos locais

Importe uma cópia completa do PostgreSQL local para um database Neon novo e vazio antes de iniciar o serviço Render:

1. Salve um backup atualizado de tatame pelo pgAdmin, formato Custom. O backup anterior à carga dos exemplos não os contém.
2. Cadastre o servidor Neon no pgAdmin usando os dados da conexão direta com SSL.
3. Restaure somente no database remoto novo e vazio, ignorando proprietário e privilégios do usuário local.
4. Mantenha API e worker parados durante a importação.
5. Configure DATABASE_URL para esse database e inicie o serviço.
6. Confira academia, alunos, histórico e financeiro. O login local é mantido pela cópia.
7. Revogue os acessos antigos de tablet na cópia e autorize novamente o aparelho usado na apresentação. Revise cobranças e datas: o worker também roda na nuvem.

Se o Neon já tem a estrutura criada pela API e não tem registros de negócio, é possível importar somente os dados no mesmo database. Não é necessário criar outro banco. Não use a restauração completa por cima das tabelas existentes.

Para a cópia local de 20/10/2026, foi preparado o arquivo privado .tools/backups/tatamemix-dados-para-neon.sql, excluído do Git. Ele contém 1 academia, 20 alunos, 67 mensalidades e 556 presenças, além dos demais vínculos e históricos.

No pgAdmin, abra o **Query Tool do neondb no servidor Neon**, abra esse arquivo pelo ícone de pasta e execute o arquivo completo, sem selecionar trechos. Mantenha o aplicativo sem uso durante a importação. A saída final mostra as contagens importadas. Depois abra o app publicado e entre com a conta local.

O arquivo exige a estrutura na versão 11 e tabelas de negócio vazias. Não apaga registros nem importa goose_db_version. Usa uma transação, conserva identificadores e sequências, suspende somente os triggers de histórico durante a carga e os restaura antes de confirmar. Uma diferença nas colunas, erro de vínculo ou destino ocupado cancela a importação. Se ocorrer um erro, use Rollback no Query Tool antes de tentar novamente e examine a mensagem.

Essa cópia foi validada em PostgreSQL isolado com usuário proprietário sem superusuário: 29 tabelas verificadas por contagem e conteúdo, migrações preservadas, 8 triggers restaurados e teste de reenvio recusado sem alterações. A execução no Neon precisa ser feita na conexão do usuário; preparar o arquivo não envia dados ao destino. O arquivo contém dados privados: não publique no GitHub.

Mantenha Asaas sem credenciais reais nesta demonstração. Dados fictícios e baixas manuais não movimentam dinheiro.

## 6. Limites do plano gratuito

Docker simplifica a publicação, mas não muda os limites da hospedagem. Render Free pausa o serviço após 15 minutos sem acesso e pode levar aproximadamente um minuto para retornar. Antes de apresentar, abra /healthz e aguarde ok. Se o login falhar durante a inicialização, espere e tente novamente.

Enquanto o processo estiver suspenso, as rotinas de mensalidades e reconciliação também param. Para uso contínuo, será necessário hospedar o processo sem suspensão ou adaptar essas rotinas a agendamento apropriado. Neon Free tem cotas de armazenamento e processamento; confira-as no painel.

O banco permanece no Neon quando o container reinicia. Não grave o PostgreSQL nem dados persistentes dentro da imagem.

## Execução local e outros clientes

compose.yaml agora compila o Dockerfile da raiz e mantém o PostgreSQL em um serviço separado, com o volume local já existente. Não precisa dele para hospedar no Render. Se for usá-lo no computador, confira se a porta 5432 está ocupada pelo PostgreSQL instalado antes de iniciar; não altere o serviço local automaticamente.

Para publicar o frontend separado na Vercel, use Root Directory mobile e EXPO_PUBLIC_API_URL HTTPS completa, como antes. Para Android/iOS, o aplicativo continua precisando de URL HTTPS completa da API. same-origin é exclusivo da versão web; o container não gera APK.

A imagem Docker completa ainda precisa ser compilada e iniciada em um ambiente com Docker disponível. A validação local verificou as etapas de compilação e o portal exportado servido pelo Go, com API e banco isolado.

Referências: [Docker multi-stage](https://docs.docker.com/build/building/multi-stage/), [Expo web](https://docs.expo.dev/guides/publishing-websites/), [Docker no Render](https://render.com/docs/docker), [Render Free](https://render.com/docs/free), [Neon Free](https://neon.com/pricing), [importação PostgreSQL](https://neon.com/docs/import/migrate-from-postgres).
