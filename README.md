# TatameMix — gestão de academias de luta

API Go, PostgreSQL e aplicativo React Native/Expo com portal web do aluno. Esta versão inclui alunos independentes de contas, modalidades, planos opcionais, geração mensal, Pix Asaas e presenças pelo tablet ou lançadas pelo gestor. A identidade TatameMix usa preto, branco e vermelho, com tipografia Inter. Os fluxos da academia, do aluno e do tablet são compartilhados entre o aplicativo e a versão web.

## Começar com seu PostgreSQL local

O backend precisa de Go, PostgreSQL funcionando e um banco criado. Neste computador você já criou o banco tatame e o usuário tatame. O pgAdmin administra esse servidor; a API conecta diretamente ao PostgreSQL.

Configure a conexão uma única vez em backend/.env, usando backend/.env.example como modelo. O arquivo local deste computador já está configurado. Depois, no terminal CMD:

    cd /d C:\Users\vitor\Documents\App-jiujitsu\backend
    go run ./cmd/api

Use sua senha real se ela for diferente. Senhas com caracteres especiais na URL precisam ser codificadas. A API inicia em http://localhost:8080 e /healthz informa o estado.

go run compila e executa o pacote indicado. ./cmd/api contém main.go. Você executa o comando a partir de backend, onde está go.mod; não precisa manter o terminal na pasta do main.go. go run sozinho não indica o que executar. As migrações SQL estão incorporadas no programa e são aplicadas ao iniciar.

A API e o seed carregam backend/.env quando iniciados na pasta backend. Variáveis já definidas no terminal têm prioridade sobre o arquivo. DATABASE_URL usa localhost:5432 para o PostgreSQL instalado no mesmo computador; HTTP_ADDR=:8080 permite acesso pela rede local. ALLOWED_ORIGINS=auto identifica as origens web locais do Expo ao iniciar a API. Em produção, configure as origens explicitamente. Deixe o terminal aberto enquanto a API estiver rodando; após atualizar o backend, pare e execute novamente.

Antes da primeira execução desta versão em uma base existente, conserve o backup e siga [MIGRATION.md](docs/MIGRATION.md). A nova migração conserva históricos e não ativa cobranças para alunos antigos.

## Controlar o PostgreSQL no Windows

Neste computador, o PostgreSQL esta configurado com inicializacao Manual. Para controlar pelo proprio Windows, abra Servicos, encontre postgresql-x64-18 e use Iniciar ou Parar. A coluna Status mostra se o servico esta em execucao. Abrir ou fechar o pgAdmin nao liga nem desliga o banco.

Antes de rodar o backend, inicie o PostgreSQL em Servicos. Ao terminar de usar o TatameMix, pare o servico se desejar. Os dados continuam salvos. Nao ha script adicional nem inicio automatico do servico pelo projeto.

## Rodar o frontend

Em outro terminal:

    cd /d C:\Users\vitor\Documents\App-jiujitsu\mobile
    npm install
    npx expo start --lan

O frontend está em mobile. O arquivo mobile/.env já usa EXPO_PUBLIC_API_URL=auto: no Expo Go, o app identifica o computador que serve o projeto e conecta à API na porta 8080. No navegador, usa o hostname da página. O endereço da rede pode mudar sem editar o arquivo. O PostgreSQL continua acessível somente pelo backend; o celular nunca precisa da senha do banco.

Para desenvolvimento na mesma rede, EXPO_PUBLIC_API_URL=auto descobre o computador pelo endereço do Expo Go; no navegador, usa o hostname da página e a porta 8080. Isso acompanha mudanças de IP após reiniciar o roteador. Uma URL explícita sempre tem prioridade. O túnel do Expo não publica a API; ambos os aparelhos precisam alcançar o servidor na rede local. APKs e exports de produção precisam de uma URL explícita, preferencialmente HTTPS.

O PostgreSQL instalado e a API ficam neste computador, então DATABASE_URL usa localhost:5432. Esse endereço independe do IP da rede. Após uma queda de energia, confirme que o PostgreSQL, a API e o Expo voltaram a funcionar. Também é possível reservar o IP do computador no DHCP do roteador.

Para iniciar com menos etapas no Windows, abra a pasta scripts e dê dois cliques em start-dev.cmd. O auxiliar confere a API, inicia Go e Expo quando necessário e mostra o endereço atual para o Expo Go. Ele respeita -DatabaseUrl, DATABASE_URL ou a conexão em backend/.env, nessa ordem, e reutiliza o PostgreSQL instalado. Sem -ApiUrl, o Expo lê mobile/.env, incluindo auto. Serviços já abertos são reutilizados; depois de editar uma configuração, reinicie o serviço correspondente. Um processo Expo iniciado com uma variável antiga no terminal pode exigir reinício para limpar esse valor.

Para testar no navegador, use npx expo start --web. Após mudar uma configuração do frontend, faça um Reload completo no Expo Go; se o processo mantiver uma variável antiga, reinicie o Expo. Abra o projeto pelo QR/endereço atual, com celular e computador na mesma rede. A API e o Expo devem rodar ao mesmo tempo. npx expo run:android compila um aplicativo Android local; expo start é o comando para usar Expo Go.

## Identidade única e participação nos treinos

O e-mail fica somente em people, com unicidade e normalização de maiúsculas/espaços. users representa o login, academy_participants representa a participação na academia e students representa a matrícula opcional com modalidades e cobrança. Uma mesma pessoa pode ser gestor e aluno sem outro e-mail, CPF/QR ou histórico duplicado.

Em Mais → Minha participação, o gestor informa o próprio CPF e consulta seu QR e presenças sem criar matrícula ou mensalidade. Se também quiser uma matrícula, Novo aluno → Usar minha própria conta reaproveita sua identidade. A participação sem matrícula não gera cobranças. No formulário de nova matrícula, a cobrança mensal começa marcada: revise valor e mês de início ou desmarque antes de concluir.

Ao cadastrar outro aluno com e-mail já existente, confirme que é a mesma pessoa para reutilizar a identidade. Isso não libera acesso à academia: o titular precisa aceitar seu convite. Conta de e-mail diferente não aceita o convite. E-mail associado a login ou a mais de uma academia fica protegido contra edição pelo cadastro do aluno.

A migração 008 exige revisão de coincidências antigas de e-mail antes de unir identidades. Ela recusa alterações ambíguas e reverte toda a transação. Consulte [MIGRATION.md](docs/MIGRATION.md) antes de iniciar esta versão sobre uma base antiga.

## Baixa manual e desconto da mensalidade

Em Financeiro, abra uma mensalidade e use Marcar como paga para registrar um recebimento em dinheiro, Pix recebido fora do app, cartão, transferência ou outro meio. Confira o valor e confirme; a observação é opcional. A baixa registra a data atual e o gestor, aparece para o aluno e atualiza o total recebido no painel. Não movimenta dinheiro.

Aplicar desconto informa um abatimento em reais e o motivo somente para a cobrança aberta escolhida. O detalhe apresenta valor original, desconto e total a pagar. Editar desconto permite alterar ou remover o abatimento com valor 0. O desconto deve deixar um total positivo; não altera o plano, o contrato ou as próximas mensalidades.

Somente gestores ativos da própria academia podem usar essas ações ou consultar o histórico de ajustes. Cobranças pagas/canceladas não aceitam alterações. Confirmações repetidas não duplicam o lançamento; uma tela com valor antigo exige atualização.

Se houver Pix emitido, a API primeiro confere o Asaas e confirma o encerramento da cobrança pendente. Pagamento já confirmado impede a alteração manual. Falha ou emissão incerta mantém o valor e a situação locais; tente novamente após a conferência. Depois de um desconto, Pagar com Pix gera uma nova cobrança pelo total atualizado.

A migração 009 é aplicada ao reiniciar a API e preserva as mensalidades anteriores. Conserve um backup da base antes de atualizar. A validação foi feita em bancos isolados; o banco principal deste computador não foi atualizado durante a implementação.

## Marca e tela de acesso

TatameMix é o nome adotado, seguindo a referência visual escolhida: símbolo T em branco e vermelho, assinatura TatameMix e tipografia Inter. A mudança preserva os cadastros e os fluxos existentes.

O login e o cadastro mantêm formulário direto no celular e apresentação em duas colunas no computador. A identidade usa vermelho #E11D2E nos botões principais, fundo #0F0F10, painéis #18181B e texto #F8FAFC. Cores discretas identificam estados e modalidades; as faixas conservam suas cores. Os campos têm ícones, destaque de foco e mostrar/ocultar senha dentro do campo. Entrar é a ação principal; criar conta tem contorno e menor destaque. O formulário permite avançar pelo teclado e apresenta validação, carregamento e falhas sem descartar os campos.

mobile/src/theme/brand.ts concentra nome e cores; mark.ts define o símbolo vetorial e Brand.tsx compartilha a assinatura nos cabeçalhos. As variações SVG ficam em mobile/assets/brand; o ícone, favicon e camadas do ícone adaptativo Android ficam em mobile/assets. O nome de exibição do Expo foi atualizado. Identificadores técnicos, esquema dos links, sessões salvas e QR Codes existentes continuam compatíveis.

Recarregue o projeto no Expo Go para visualizar. A versão web pode ser exportada pelo comando já documentado; um APK anteriormente instalado precisa de uma nova compilação para receber as alterações.

## Evolução, datas e mensalidades futuras

A ficha do aluno separa Matrícula, Presenças, Evolução e Dados. Evolução mostra faixa/graus por modalidade, alterações com dia e gestor responsável, data do cadastro e dias ativos registrados. Inativar ou arquivar pausa a contagem; restaurar inicia outro período, conservando o acumulado. Alterações feitas pelo cadastro completo também entram no histórico, sem duplicar edições que mantêm a graduação.

Cadastros anteriores à migração 010 conservam a graduação atual como ponto inicial, sem presumir a data da conquista. Sua data original de cadastro permanece visível; os períodos ativos passam a ser registrados a partir da atualização. O aplicativo não decide promoções automaticamente.

A primeira mensalidade aparece imediatamente ao ativar a cobrança, mesmo que vença no dia 10 do mês seguinte. O vencimento escolhido é conservado. As seguintes são emitidas no início de cada mês; execuções repetidas não antecipam mais meses nem duplicam cobranças. O gerador também recupera cadastros antigos com primeira cobrança futura ainda não emitida.

Cadastro e edição financeira usam seleção visual de mês e dia, com prévia do primeiro vencimento. O filtro do Financeiro oferece Todos, Este mês e Próximo mês, além do seletor de mês/ano. Na mensalidade, recebimento e link ficam numa barra compacta; o menu reúne desconto, Pix, histórico e cancelamento.

## Entrada direta e academias

O login é único, com e-mail e senha. A API informa os acessos da conta: com uma única opção, o gestor entra no painel e o aluno nas mensalidades. Quando houver dois perfis ou várias academias e nenhuma escolha anterior válida, a seleção acontece depois da autenticação.

Quando houver mais de um acesso, a primeira entrada mostra uma seleção compacta. A última academia/perfil fica lembrada por conta neste aparelho (na web, por aba/sessão do navegador) e é conferida novamente com a API antes de restaurar. Recarregar uma seção conserva a academia; uma preferência antiga, bloqueada ou sem permissão não concede acesso.

Trocar, no cabeçalho, abre Academias e perfis apenas quando solicitado. Outras unidades são cadastradas em Mais → Nova academia. Contas sem academia recebem orientação para abrir o convite de aluno e podem escolher cadastrar sua primeira academia. Os links de convite e pagamento mantêm seu destino após o login. /onboarding permanece como redirecionamento de compatibilidade, sem formulário ou etapa adicional.

## Navegação

As seções principais formam uma navegação circular. Arraste para a direita para avançar: Início → Alunos → Financeiro → Turmas → Mais → Início. Arraste para a esquerda para percorrer o sentido contrário, inclusive de Início para Mais. O portal do aluno segue Mensalidades → Presenças → Meu código → Mensalidades.

O botão Voltar e o gesto de retorno do Stack foram removidos. O conteúdo acompanha o dedo na mesma direção, mostrando a página vizinha durante o arraste. Segurar o dedo não muda a rota: é necessário soltar após percorrer pelo menos 55% da largura da página. Arrastes curtos ou desfeitos voltam à posição inicial; a velocidade sozinha não confirma a troca. Uma animação curta termina o encaixe. As trocas substituem a rota atual, mantendo o histórico limitado mesmo depois de várias voltas. Os ícones inferiores continuam oferecendo acesso direto.

Campos de texto e rolagem vertical não trocam a seção. Cadastros e mensalidades de detalhe não participam do ciclo; use os ícones inferiores para abrir a lista desejada.

## Visual e atalhos

Os cards do início são clicáveis por toda a sua área: alunos ativos abrem Alunos; valores recebidos e em aberto abrem Financeiro; presenças e gráfico abrem o histórico da academia; as aulas da agenda de hoje levam à lista de presenças. O card Novo aluno inicia o cadastro por etapas.

A navegação inferior acompanha a cor de cada seção. Situações financeiras e de dispositivos usam texto e cores; os filtros de mês/aluno ficam no botão de filtros do Financeiro. A versão web permite ativar os cards pelo teclado; as páginas vizinhas do carrossel ficam fora da ordem de Tab.

## Fluxo do gestor e do aluno

1. Entre com e-mail e senha. Seu acesso é identificado automaticamente; havendo vários, escolha após o login ou retome a última seleção válida. Contas novas podem abrir o convite da academia ou escolher Cadastrar minha academia. Outras unidades ficam em Mais → Nova academia.
2. Em Alunos → Novo aluno, avance por Identificação, Modalidades, Mensalidade e Revisão. Nome, CPF do próprio aluno, data de nascimento, e-mail, celular e telefone alternativo ficam na primeira etapa; a faixa e seus graus são escolhidos visualmente para cada modalidade. Para menores de 18 anos, há uma etapa adicional de Responsável financeiro antes da revisão. Adultos usam o próprio nome e CPF para pagar.
3. Escolha cobrança por modalidades ou por plano. Por modalidades, os valores individuais são somados em uma mensalidade; por plano, o pacote preenche as modalidades incluídas e o valor combinado. A cobrança mensal já vem marcada no novo cadastro e pode ser desmarcada. Escolha o dia do vencimento e o mês de início da cobrança nos seletores; para menores, informe também o responsável financeiro. A gravação ocorre somente na confirmação da revisão. A primeira cobrança é gerada ao ativar e as seguintes no início de cada mês, enquanto a API estiver funcionando.
4. Gere o convite e envie o link ao aluno pelo canal de sua escolha. O convite dura sete dias e é aceito uma única vez.
5. O aluno abre o link no navegador, cria uma conta ou faz login com o e-mail convidado, confere seu nome e a academia e confirma o vínculo. O token determina a academia e o aluno; nem o navegador nem outra conta podem escolher outro cadastro. Se o CPF estiver ausente, poderá preenchê-lo nessa confirmação. Um CPF já cadastrado só pode ser corrigido pelo gestor. Seu portal mostra somente suas mensalidades, presenças e CPF/QR de identificação.
6. Após configurar o Asaas, o aluno abre a mensalidade e usa Pix. A confirmação depende de consulta ao provedor, webhook e reconciliação.
7. Em Turmas → Nova turma, escolha a modalidade, marque vários dias e informe todos os horários separados por vírgula. Professor vinculado é opcional. A grade semanal libera automaticamente o check-in: não é necessário abrir ou encerrar aulas.
8. No aparelho da recepção, entre como gestor e abra Mais → Check-in da academia → Preparar este aparelho. Confira o nome e confirme a ativação; este aparelho troca a gestão pela tela de check-in. O tablet identifica a aula pelo horário. Se houver mais de uma opção, o aluno escolhe; depois, lê o QR ou digita o CPF. O código anterior continua disponível para cadastros legados.
9. Confira a presença no tablet, na lista da aula e no histórico do aluno. Débito financeiro não bloqueia treino automaticamente.

Inativar um aluno interrompe futuras mensalidades e check-ins. Históricos e débitos permanecem. Para retomar a cobrança, indique o mês atual ou um mês futuro como início da cobrança. Dias 29, 30 e 31 são limitados ao último dia disponível do mês.

## Presença por horário e lançamento pelo gestor

O tablet usa o dia e horário do servidor no fuso da academia. O check-in fica disponível de 15 minutos antes do início até o fim da aula. Uma aula na janela é identificada automaticamente; se houver sobreposição, a tela pede a escolha e a API recusa selecionar arbitrariamente. Fora da janela, a tela orienta conferir a grade em Turmas. Aulas que atravessam meia-noite são reconhecidas.

A ocorrência da aula é criada junto com a primeira presença, na mesma transação; nenhum processo de abertura manual é necessário. Turmas pausadas/excluídas, horários removidos, aulas canceladas e dispositivos revogados são recusados. Reenvios usam a mesma chave e duas tentativas para a mesma pessoa/aula retornam a presença já existente.

O gestor pode usar Alunos → aluno → Presenças → Lançar presença, Presenças da academia ou a lista da aula. Escolhe a data em que o aluno treinou e o horário da grade. O lançamento aceita a data atual ou passada e permite completar uma aula encerrada; aula futura, cancelada e aluno inativo/arquivado são recusados. Uma presença já registrada pelo tablet não é duplicada nem troca de origem.

O histórico mostra a origem (gestor/tablet), a data da aula e o momento real do registro. Filtros mensais e dashboard usam o dia do treino, para um lançamento retroativo não aumentar a frequência de hoje. A versão 2.9 não adiciona migração ao banco; clientes antigos mantêm o endpoint legado de aula explícita, enquanto o aplicativo atual usa check-in por horário.

## CPF, arquivamento e exclusão de turmas

O CPF do próprio aluno é obrigatório para novos cadastros, validado e único dentro de cada academia, inclusive entre arquivados. Ele não é copiado do CPF/CNPJ do pagador. Alunos antigos ficam com CPF pendente até o gestor preencher na edição ou o próprio aluno completar ao aceitar seu convite; seus QR Codes e códigos anteriores permanecem válidos. No tablet, a opção principal é CPF, com QR disponível. A confirmação depende da resposta da API.

Em Alunos, use Arquivar aluno para retirar o cadastro da lista principal, interromper novas cobranças e bloquear check-ins. CPF, QR, graduações, presenças e débitos permanecem. A aba Arquivados permite restaurar o mesmo cadastro. A busca por CPF completo sem filtro de situação também encontra arquivados. O tablet pede que o gestor restaure o aluno; ele não restaura automaticamente. Restaurar libera presença e mantém cobrança desativada até o gestor revisar o mês de início e ativá-la.

Em Turmas, Excluir turma pede confirmação, retira a turma da operação e cancela suas aulas abertas. A exclusão é lógica: histórico e presenças antigos continuam consultáveis. A turma não aceita novos horários, aulas ou check-ins.

A migração 005 foi aplicada ao banco local em 15 de outubro de 2026 após backup e teste em cópia. Ela não preenche CPFs, arquiva alunos nem exclui turmas automaticamente.

## Cadastros por etapas

O componente FormWizard mantém os campos ao avançar e voltar, valida cada etapa e apresenta uma revisão antes de salvar. Ele é usado em alunos, planos e modalidades. Turmas usam um formulário único de agenda semanal; o arraste entre seções fica desativado enquanto o formulário ou menu estiver aberto.

Em Mais → Modalidades e planos, configure o valor mensal avulso e o sistema de graduação de cada modalidade. Há modelos de Jiu-Jitsu adulto, infantil e completo, além de lista personalizada com até três cores por graduação e opção sem faixas. Jiu-Jitsu e No-Gi guardam faixas e graus independentes. Nesta versão, cada faixa pode ter de zero a quatro graus, com marcações visuais na ponta. Ao trocar a faixa, o seletor inicia os graus em zero; os alunos existentes começam sem graus e podem ser ajustados pelo gestor. Os modelos podem ser adaptados pela academia; referência visual: [graduações IBJJF](https://ibjjf.com/graduation-system).

Na cobrança por modalidades, a API calcula o total dos valores contratados, em centavos. Alterações no catálogo não reajustam contratos salvos ou mensalidades emitidas automaticamente. Por plano, prevalece o valor combinado para o pacote. Contratos antigos permanecem em “Manter valor atual” até o gestor escolher como reorganizá-los.

A migração 003 acrescenta faixa/valor por modalidade, telefone alternativo e forma de cobrança. Ela foi testada em bancos isolados e numa cópia restaurada do PostgreSQL 18 local. Após autorização explícita, foi aplicada ao banco local em 15 de outubro de 2026, com novo backup e comparação dos dados anteriores de dez tabelas. A API foi reiniciada e está saudável; no Expo Go, recarregue o projeto para usar os novos cadastros.

## Turmas e agenda semanal

Crie a turma e sua grade inteira em uma única operação. Exemplo: marque Seg/Qua/Sex, informe 19:00, 20:00 e duração de 60 minutos. Isso gera seis horários semanais. Para outros horários no sábado, adicione uma linha, marque Sáb e informe 09:00, 10:30. O nome da turma é opcional no formulário; se vazio, usa o nome da modalidade.

A lista resume dias e horários por turma e usa duas colunas em telas largas. O menu de três pontos reúne Editar turma e agenda, Pausar/Reativar e Excluir. Ver aulas mostra somente as aulas do dia para abrir uma aula ou consultar suas presenças.

Turma e horários são gravados na mesma transação. Horários repetidos são recusados. Ao editar, horários removidos saem da grade futura e continuam associados às aulas antigas; aulas já abertas e presenças são mantidas. A migração 006 preserva todas as agendas existentes. As rotas anteriores de cadastro individual continuam disponíveis para compatibilidade.

## Perfil do aluno e edições diretas

Ao abrir um aluno, o perfil apresenta as abas Matrícula, Presenças e Dados. Matrícula e mensalidade mostra as modalidades incluídas no plano ou os valores individuais que formam o total mensal, junto de vencimento e emissão automática. Alterar contratação muda plano/modalidades; Valor e vencimento ajusta os valores. Graduação tem edição direta de faixa/graus, sem regravar o contrato financeiro.

Presenças mostra o total de check-ins, o último registro e a lista das aulas com modalidade, data e hora, filtro mensal e paginação. O histórico permanece disponível para alunos arquivados e turmas excluídas. Os registros continuam sendo feitos exclusivamente pelo tablet autorizado.

Responsável financeiro aparece apenas para menores de 18 anos, conforme a data de nascimento no fuso da academia. Para adultos, a API usa nome e CPF do próprio aluno, inclusive nas novas emissões após completar 18 anos. Mensalidades já emitidas mantêm o pagador original. Cadastros anteriores à migração 007 ficam com nascimento pendente, sem idade presumida ou mudança automática de débitos; informe a data ao revisar o cadastro.

Alterar modalidades ou plano abre o cadastro na etapa correspondente, com revisão antes de salvar. O menu de opções reúne edição completa e arquivamento. Arquivados continuam consultáveis e podem ser restaurados pelo gestor.

## Aparelhos de check-in

Mais → Check-in da academia explica o funcionamento e lista os acessos autorizados e encerrados, com nome e data de ativação. Autorizado significa permissão para registrar presença; não indica conexão em tempo real.

Para preparar a recepção, faça login como gestor no próprio aparelho que ficará para os alunos. Escolha Preparar este aparelho, dê um nome e confirme. Esse aplicativo ou aba passa a exibir somente check-in por CPF/QR; o aluno não precisa entrar na conta do gestor. A tela concentra CPF e QR Code em um painel; a aula é identificada automaticamente quando há apenas uma opção. Opções do check-in (ícone de três pontos) reúne atualização dos horários, uso do código antigo e encerramento. Para voltar à gestão, abra esse menu, escolha Encerrar check-in, confirme Encerrar e sair e faça login novamente.

Encerrar e sair desautoriza somente esse acesso no servidor e apaga a sessão local. Se o servidor estiver indisponível, a tela permite tentar novamente sem afirmar que encerrou. O gestor também pode encerrar um acesso remotamente pela lista, com confirmação. Presenças registradas são mantidas.

No navegador, use uma aba dedicada: fechar a aba pode exigir nova ativação e deixar um acesso anterior na lista. Encerre os acessos antigos que não serão mais usados. A autorização é do acesso do aplicativo/aba; ela não identifica o equipamento físico.

## Pix com Asaas

A integração usa a conta Asaas da própria academia. Leia [ASAAS.md](docs/ASAAS.md) para habilitar sandbox e configurar o webhook. Sem credenciais, o sistema continua utilizável e informa que Pix não está habilitado. Chaves e tokens ficam exclusivamente no servidor.

Os testes automatizados simulam o Asaas. Recebimento real exige credenciais de produção, conta liberada e webhook HTTPS público. Homologação com credenciais reais ainda precisa ser feita.

## Portal web e links

    cd mobile
    npm run export:web

O export fica em mobile/dist. Ao iniciar o Go a partir de backend, a API detecta ../mobile/dist e serve o portal automaticamente. WEB_DIST_DIR permite escolher outro diretório. EXPO_PUBLIC_API_URL deve apontar para a API e EXPO_PUBLIC_PORTAL_URL para o endereço web público usado nos convites e links de mensalidade. Configure essas URLs antes de exportar.

O servidor Go entrega a página inicial para /invite/{token} e /pay/{academy}/{invoice}, preservando os links após login. Também é possível hospedar o export em outro servidor com fallback para index.html. Publicação pública não foi realizada nesta entrega.

## Dados de demonstração

Em uma base de desenvolvimento, execute go run ./cmd/seed dentro de backend. Isso adiciona duas academias, alunos, modalidades, plano Essencial, mensalidades locais e uma aula do dia. Não faz chamadas ao Asaas.

| Conta | Acesso |
|---|---|
| gestor@tatame.demo | Gestor das duas academias |
| aluno@tatame.demo | Aluno nas duas academias |
| ana@tatame.demo | Aluna nas duas academias |

CPFs de demonstração: aluno@tatame.demo → 529.982.247-25; ana@tatame.demo → 111.444.777-35. Use somente em desenvolvimento.

Senha de demonstração: Tatame123!. O seed pode ser repetido e preserva cadastros e mensalidades já configurados. Use somente em desenvolvimento. Alunos migrados comuns continuam sem cobrança automática; a ativação feita pelo seed se restringe às contas de demonstração.

## Android

O APK interno está em [artifacts/Tatame-arm64.apk](artifacts/Tatame-arm64.apk). A API de desenvolvimento embutida é http://192.168.15.6:8080. Mantenha o servidor ativo e o celular/tablet na mesma rede. A instalação, a câmera e os fluxos em aparelhos físicos ainda precisam ser verificados.

Para recompilar com as ferramentas preparadas neste computador:

    powershell -ExecutionPolicy Bypass -File scripts/build-apk.ps1 -ApiUrl http://IP_DO_COMPUTADOR:8080

Alternativa com conta Expo: npx eas-cli build --platform android --profile preview dentro de mobile. HTTPS e uma URL estável são necessários para distribuição pública.

## Arquitetura e verificações

- backend/cmd/api: inicialização, migrações e worker de cobrança/reconciliação.
- backend/internal/students: alunos, modalidades, planos e convites.
- backend/internal/billing: geração mensal e snapshots das mensalidades.
- backend/internal/payments: cliente Asaas, emissão, webhook e reconciliação.
- backend/internal/attendance: check-in transacional e históricos.
- mobile/src/app: rotas Expo Router; mobile/src/features: telas e lógica.
- [OpenAPI](docs/openapi.json), [arquitetura](docs/ARCHITECTURE.md), [migração](docs/MIGRATION.md), [validação](docs/VALIDATION.md).

No backend, go test ./... e go vet ./.... TEST_DATABASE_URL habilita os testes com um banco PostgreSQL exclusivo de testes. MIGRATION_DATABASE_URL deve apontar para uma base nova e vazia para testar a conversão desde a versão 001. Nunca use seu banco principal para esses testes.

No mobile, npm run typecheck, npm run lint, npm run test:access e npm run export:web. Os testes de acesso verificam seleção automática, perfil escolhido, múltiplas academias e preferências sem permissão. O laboratório offline permanece separado em tools/offline-lab.

Cartão, boleto, débito automático, contratos, WhatsApp automático, área de professor, offline, iOS e publicação nas lojas continuam fora desta versão.

## Início do aluno na academia

O cadastro de aluno inclui Data de início na academia, preenchida com hoje por padrão e ajustável para uma data anterior. Em Evolução, o ícone de edição em Tempo na academia permite corrigir essa data. O período desde a entrada aparece em anos, meses ou dias; a criação do cadastro no aplicativo continua identificada separadamente.

A atividade acompanhada continua somando somente períodos registrados, excluindo pausas. Informar uma data antiga não reconstitui presenças, conquistas de graduação nem mensalidades. Datas inválidas, futuras e anteriores ao nascimento são recusadas. A edição é exclusiva do gestor; cadastros arquivados precisam ser restaurados.

Reinicie a API para aplicar a migração 011 e recarregue o aplicativo. O esquema e os dados foram validados em bases isoladas; o banco principal não foi alterado durante a implementação.

## Exemplos na academia existente

backend/cmd/demo é uma ferramenta local que consulta as academias e, com -apply, cria um conjunto fictício na academia indicada por -academy. Exige um novo arquivo -backup e o caminho do pg_dump quando ele não estiver no PATH. O backup é salvo antes da transação. O comando sem -apply apenas consulta dados; não migra o banco, cria outra academia nem chama serviços bancários.

O conjunto inclui 18 alunos identificados com Demo •, contatos em example.test, documentos sintéticos, responsáveis de menores, planos Essencial/Combinado, mensalidades locais de quatro meses, descontos e recebimentos manuais fictícios, evolução e presenças nos horários existentes. Conserva as turmas e preços do catálogo. Repetições preservam os exemplos já encontrados e não duplicam registros; confira sempre a academia e utilize somente bancos de demonstração.
