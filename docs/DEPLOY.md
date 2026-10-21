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

## 4. Abrir e conferir

Após o deploy, o Render fornece um endereço HTTPS. Abra esse endereço seguido de /healthz e aguarde status ok. Depois abra o endereço principal para entrar no TatameMix.

Não é necessário configurar EXPO_PUBLIC_API_URL no painel: a imagem já é compilada com same-origin, e as chamadas usam /v1 no próprio domínio. Convites usam a origem do navegador. ALLOWED_ORIGINS só precisa de configuração adicional se outro site em domínio diferente for chamar essa API.

Confira:

- Login e dados do painel.
- Recarregar /login e uma página interna.
- Alunos, turmas, mensalidades, evolução e histórico.
- Check-in por CPF e QR.
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

Se o destino já tem tabelas ou dados, prepare outro database vazio para a importação. Não sobreponha um banco em uso.

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
