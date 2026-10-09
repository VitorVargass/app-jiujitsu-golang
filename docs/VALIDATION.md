# Validação da versão de gestão da academia

Verificação local em 8 de outubro de 2026. A integração de pagamentos desta entrega usa Asaas.

## Preservação dos dados

- Backup do PostgreSQL local original salvo em artifacts/backups/tatame-before-academy-20261008-170815.dump.
- Backup restaurado em uma base separada e migração 002 aplicada com sucesso.
- Teste de migração desde 001 em outro banco vazio confirmou preservação de presença, código numérico, QR e vínculo da conta.
- Alunos migrados não recebem cobranças retroativas nem ativação automática de mensalidades.
- Na implementação inicial, o banco original não recebeu o seed ou os dados de validação. Na revisão de conexão e navegação, ele já estava na migração 002. Um novo backup foi salvo em artifacts/backups/tatame-before-navigation-20261008-213854.dump antes dessa revisão; os testes de interface continuaram na cópia separada.

## Backend

go test ./... -count=1 e go vet ./... passaram. Os testes de integração usaram PostgreSQL 17 real, em bancos exclusivos de testes; as chamadas Asaas usaram servidor HTTP simulado.

Cobertura verificada:

- Cadastro independente de aluno, várias modalidades, plano opcional e dados do pagador.
- Primeira mensalidade, alteração de valores sem modificar cobrança emitida e vencimentos limitados ao último dia do mês.
- Execuções simultâneas da geração mensal sem duplicação por aluno/academia/competência.
- Convite individual, aceitação única, revogação, titularidade e isolamento entre academias.
- Emissão Pix com perda da resposta e recuperação pela referência sem criar outro pagamento.
- Conferência de tipo PIX, valor, identificador e referência consultados no provedor.
- Webhook com token inválido recusado, valor divergente sem baixa e eventos repetidos produzindo um único recebimento.
- Reconciliação independente do webhook.
- Aluno inativo conserva mensalidades e histórico; retomada da geração exige competência atual ou futura.
- Turma com modalidade e sem professor obrigatório.
- Check-in exclusivamente por dispositivo autorizado, inclusive para aluno ainda sem conta.
- Doze registros simultâneos, reenvio após perda de resposta e conflito de Idempotency-Key.
- Dispositivo revogado, aluno inativo e aula encerrada recusados.
- Portal Go com fallback para links de convite/pagamento; rotas da API e arquivos ausentes preservam seus erros.

O teste específico de migração foi executado com MIGRATION_DATABASE_URL apontando para banco novo. Sem essa variável, ele é explicitamente ignorado. Nunca aponte os testes ao banco principal.

## Frontend e fluxo no navegador

npm run typecheck e npm run lint passaram sem erros ou avisos. O export web foi gerado com sucesso.

Em navegador com largura de celular foram verificados:

1. Login do gestor, seleção da academia e financeiro.
2. Cadastro de Maria Validação, sem conta, com duas modalidades e mensalidade de R$ 210,50.
3. Geração do convite, cadastro da conta em sessão separada e aceitação do vínculo.
4. Portal do aluno exibindo somente sua mensalidade e seu QR/código.
5. Link direto de mensalidade no portal servido pelo Go, com retorno à cobrança após login.
6. Habilitação do tablet, substituindo a sessão pessoal pela credencial do dispositivo.
7. Check-in pelo código numérico, confirmação e presença no histórico pessoal.

Não foram registrados erros JavaScript pelo navegador nesse fluxo. Imagem da interface final: artifacts/validation/historico-aluno.png.

Os testes automatizados verificam a confirmação bancária simulada. A configuração local não contém credenciais reais de pagamento.

## Arquivos de entrega

- artifacts/tatame-api.exe: executável Windows da API.
- mobile/dist e artifacts/tatame-web.zip: portal web exportado.
- artifacts/Tatame-arm64.apk: Android interno, arm64-v8a, com API de desenvolvimento em http://192.168.15.5:8080.
- artifacts/Tatame-arm64.apk.sha256: hash da versão final.

O build Android local Gradle terminou com sucesso, incluindo Expo Clipboard e fontes locais. Após os últimos ajustes de interface, o bundle Hermes foi gerado pelo Expo, incorporado ao APK, alinhado e assinado novamente. A assinatura v2/v3 e o alinhamento de 16 KiB foram verificados com as ferramentas Android SDK.

SHA-256 do APK:

    85406e9fcda9b07d9074bc6c85f069191119da83d7693ffcfc07d2ef99df31ad

O APK usa assinatura de desenvolvimento e se destina ao teste interno. A API local e a versão web devem ser reiniciadas para utilizar o código atualizado.

## Revisão da interface

O cabeçalho agora reúne o nome e o perfil junto de Trocar, fora do conteúdo das telas. A navegação inferior usa ícones, rótulos pequenos e destaque da seção, inclusive nas rotas de detalhe.

A tela de alunos apresenta Novo aluno junto do título, busca com ícone, filtros de modalidade recolhidos, estados em abas e linhas clicáveis no lugar de botões repetidos. A paginação aparece somente quando há mais de uma página. O dashboard tem menos ações repetidas e cartões com alturas uniformes.

Verificados no navegador: larguras de 320 e 390 pixels, busca, limpeza da busca, filtros, estado vazio, abertura de cadastro existente, Novo aluno, navegação do gestor e do aluno. TypeScript e lint passaram. A versão web e o APK foram atualizados após essa revisão; assinatura v2/v3 e alinhamento de 16 KiB do APK passaram.

Prévias: artifacts/validation/alunos-design.png, artifacts/validation/alunos-design-320.png e artifacts/validation/aluno-navegacao-design.png.

## Revisão de conexão e navegação

Após a queda de energia, o computador passou de 192.168.15.6 para 192.168.15.5. O frontend estava com o endereço antigo na inspeção inicial; mobile/.env agora aponta para o novo IP. O PostgreSQL 18 local responde na porta 5432 e a API responde em /healthz por localhost e pelo IP da rede. O endpoint de login retorna invalid_credentials para uma conta diagnóstica inexistente, confirmando que a requisição alcança a API e o banco; a senha da conta pessoal não foi utilizada.

O cliente aceita EXPO_PUBLIC_API_URL=auto no desenvolvimento pelo Expo, preservando URLs explícitas. Foram verificados descoberta após mudança de IP, navegador, fallback do emulador e manutenção da URL explícita em builds. O inicializador passou na análise sintática PowerShell e foi executado com os serviços existentes, sem iniciar um segundo PostgreSQL.

A navegação usa um carrossel de três páginas reais: anterior, atual e próxima. A página acompanha o deslocamento horizontal do dedo em proporção 1:1, e a vizinha entra pelo mesmo lado. Arrastar para a direita avança Início → Alunos → Financeiro → Turmas → Mais → Início; para a esquerda, percorre o sentido contrário. O aluno segue Mensalidades → Presenças → Meu código → Mensalidades.

A troca exige soltar após percorrer pelo menos 55% da largura da página. A velocidade não confirma um arraste curto. Segurar, mesmo depois do limite, não altera a rota. Recuar antes de soltar cancela a troca. Ao soltar, uma animação entre 110 e 200 ms termina o encaixe ou retorna ao centro; a rota só é substituída depois do encaixe. O cabeçalho e a navegação inferior permanecem fixos. O botão Voltar e o gesto de dismiss do Stack continuam removidos, com replace e animation: none nas rotas principais.

Com API e PostgreSQL separados dos dados pessoais, eventos de toque via Chrome DevTools verificaram:

- Arraste rápido de 60 pixels e arraste de 165 pixels cancelados numa página de 390 pixels.
- Deslocamento acompanhando o dedo e página vizinha posicionada ao lado da atual.
- Pausa de 700 ms com arraste de 305 pixels sem mudar a rota antes de soltar.
- Arraste que atravessa o limite e volta para 60 pixels cancelado.
- Segundo toque durante o retorno ou durante a substituição da rota sem causar uma troca adicional.
- Ciclo completo do gestor e do aluno nos dois sentidos, sem crescimento do histórico.
- Rolagem vertical e interação em campo de texto sem trocar a seção; dois dedos cancelam a tentativa.
- Arraste sobre linha de aluno sem abrir o cadastro; toque no cadastro após o encaixe abre o detalhe.
- Mudança de largura durante o arraste cancelando e recentralizando o conteúdo; navegação funcionando também em 320 pixels.
- Rotas de detalhe fora do carrossel e ausência do botão Voltar.

TypeScript e lint passaram sem erros ou avisos. Nenhum erro JavaScript foi registrado nas sessões de validação. A medição no navegador verifica o comportamento funcional; não mede a fluidez num aparelho físico.

A versão web foi exportada novamente. O APK conserva seus módulos nativos e atualiza o bundle Hermes, sem novas dependências nativas. A comparação com nomes sensíveis a maiúsculas e minúsculas confirmou 1.215 arquivos nativos e de mídia inalterados, desconsiderando bundle e assinatura. A assinatura v2/v3 e o alinhamento de 16 KiB foram verificados. O APK anterior foi preservado em artifacts/Tatame-before-pager-20261008.apk. O endereço embutido permanece http://192.168.15.5:8080.

Os Stacks de autenticação e aplicação desabilitam gestureEnabled e a animação de transição. Não houve teste em aparelho iOS ou Android físico.

Prévias desta revisão: artifacts/validation/pager-held.png e artifacts/validation/pager-student.png.

## Verificações ainda necessárias

- Homologar Pix com credenciais sandbox reais da academia e webhook HTTPS acessível.
- Conferir confirmação, vencimento e reemissão com eventos reais do Asaas antes de produção.
- Instalar o APK em celular/tablet Android e verificar câmera, QR, teclado, rotação, retorno do segundo plano e gestos.
- Testar a navegação circular e a remoção do retorno por gesto em iPhone físico com Expo Go ou desenvolvimento iOS.
- Testar queda de rede durante envio no aparelho, incluindo conservação da tentativa e ausência de confirmação antecipada.
- Configurar endereço público estável, HTTPS e credenciais de produção antes de publicação.

Não houve aparelho Android conectado nem credenciais reais do Asaas disponíveis. A validação no navegador e no servidor simulado não substitui essas etapas.
