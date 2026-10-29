# InfinitePay — mensalidades

Cada academia conecta a propria conta em **Mais > Recebimentos**. O aluno paga no checkout hospedado da InfinitePay; o TatameMix nunca recebe para depois repassar. A assinatura do software tem implementação separada; consulte [SUBSCRIPTIONS.md](SUBSCRIPTIONS.md).

## Configuracao do servidor

- `PAYMENTS_MASTER_KEY`: 32 bytes aleatorios codificados em base64, fornecidos pelo cofre de segredos do servidor. Mantenha backup seguro: perder ou trocar essa chave sem recriptografar as conexoes impede consultar pagamentos antigos.
- `PAYMENTS_PUBLIC_URL`: origem HTTPS publica do portal e da API, sem caminho ou query.
- `INFINITEPAY_ENABLED=false`: padrao de publicacao. Somente configurar como `true` apos validar o contrato e autorizar o teste controlado. O bloqueio global suspende tambem consultas; a suspensao por academia bloqueia somente novas emissoes.

Nao colocar esses valores em EXPO_PUBLIC_*, no Git ou no Dockerfile. Credenciais por academia ficam em `payment_connections`, com AES-GCM e dados associados academy_id + connection_id. A API nunca as retorna. Chaves antigas sao preservadas para conferir as tentativas antigas. A migracao 013 e aditiva e executada na inicializacao normal da API; faca backup antes de publicar. Nenhuma migracao desta implementacao foi aplicada no Neon.

## Uso pelo gestor

No app InfinitePay: Vendas > Checkout > Configuracoes > Habilitar Checkout Integrado > criar API Key. No TatameMix, informar a InfiniteTag e a chave, conferir a conta e confirmar. A chave autentica a conta recebedora; informar a tag por si so nao comprova titularidade. Salvar nao emite cobranca, nao prova titularidade e nao valida a conta. O estado validado aparece depois de um recebimento confirmado na API bancaria. A substituicao exige informar a nova chave; nao existe leitura da chave antiga pela interface.

## Emissao e confirmacao

POST /links usa X-Api-Key, order_nsu aleatorio persistido antes da chamada, preco em centavos, options.single_payment=true, validade de 24 horas e webhook HTTPS por conexao. Nao adiciona descontos por metodo, taxas proprias ou juros. QR Pix e Copia e Cola sao apresentados pela InfinitePay, nao por uma API Pix nativa do TatameMix. O cartao pode aparecer e tem as condicoes do provedor.

Apenas o pedido do aluno ou gestor emite checkout. A geracao mensal nao cria links bancarios. Tentativas simultaneas compartilham a lease financeira existente. Perda de resposta fica em conferencia e nao autoriza nova emissao. Respostas definitivas HTTP 400/401/403/422 permitem corrigir a configuracao e tentar novamente; 429, 5xx, timeout ou resposta invalida nao.

O webhook e uma notificacao nao confiavel, sem assinatura inventada. Payloads normalizados sao persistidos em checkout_inbox e respondidos antes de qualquer consulta externa. O worker consulta POST /payment_check com a chave da conexao original, confere referencia, valor e meio, e grava recibo e baixa numa transacao. Retorno do navegador so fornece identificadores para a mesma conferencia autenticada. Valor pago pode diferir do valor do pedido por condicoes do cartao; o valor do pedido deve coincidir exatamente com a mensalidade, e o total pago nao pode ser inferior.

Notificacoes repetidas nao duplicam recibos. Valor divergente, transacao reutilizada, recebimento apos outro fechamento, estorno ou cancelamento exigem conferencia, sem estorno automatico. Falhas transitórias sao repetidas a cada minuto, por ate 20 tentativas por evento; depois ficam retidas para conferencia. O worker recupera jobs interrompidos. A tela da mensalidade mostra o estado de conferencia. Sem webhook nem identificadores do retorno, a documentacao nao oferece uma busca de todos os pagamentos por referencia: a academia precisa conferir na InfinitePay; nao prometemos recuperacao automatica nesse caso.

## Limites que precisam ser validados antes de producao

A Central de Ajuda atual documenta API Key, options e webhook como objeto; a pagina interativa antiga ainda apresenta handle e webhook_url. Foi adotado o contrato atual da Central de Ajuda. Validar formato real da resposta /links (URL), dominio checkout.infinitepay.io, payload do webhook e semantica de payment_check numa conta autorizada antes de liberar alunos. Nao existe sandbox presumido, e nao foi criado checkout real durante o desenvolvimento.

A documentacao consultada nao define API de invalidacao de link, busca sem transaction_nsu/slug ou consulta conclusiva de estorno. Por isso, checkout emitido/ambiguo bloqueia desconto, cancelamento, baixa manual e reemissao, inclusive apos expirar. A interface nao oferece botao que apenas declare o link cancelado. Resolver esses casos exige conferencia e um procedimento bancario comprovavel antes de qualquer correcao; nao ha desbloqueio automatico nesta versao. Suspender ou trocar a conexao nao inutiliza links anteriores.

Cobranças Asaas existentes mantem o fluxo antigo; as tentativas InfinitePay nao sao convertidas nem os historicos reescritos.

## Validacao

Testes Go unitarios de AES-GCM, isolamento da credencial e contrato HTTP; TestInfinitePayFlow com PostgreSQL real dedicado via TEST_DATABASE_URL e servidor bancario simulado. Nao usar a URL do banco da academia para esses testes. Cobrir notificacao falsa/repetida, credencial antiga, concorrencia, expiracao, divergencia e emissoes incertas. Validar web/celular e a abertura do checkout; sem credenciais reais, a ativacao bancaria continua pendente.

Referencias: https://ajuda.infinitepay.io/pt-BR/articles/10766888-como-usar-o-checkout-integrado-da-infinitepay e https://www.infinitepay.io/checkout-documentacao.

## Preenchimento dos dados do comprador

Ao emitir **novos links**, o backend envia `customer.name`, `customer.email` e `customer.phone_number` quando esses dados estão disponíveis e correspondem ao pagador da mensalidade. O nome vem da mensalidade. Para pagamento do próprio aluno, usa o e-mail da identidade do aluno e os contatos do cadastro. Para outro pagador, usa o e-mail de um responsável com vínculo de acesso ativo e CPF correspondente ao pagador da mensalidade; o telefone é o contato informado no cadastro do aluno. Não usa o e-mail do gestor que clicou em pagar.

Em cadastros antigos de menores sem vínculo confirmado do responsável, envia apenas o nome do pagador conhecido. Não combina o nome do responsável com e-mail/telefone da criança. Nesse caso, os dados faltantes ainda serão pedidos no checkout. Telefones brasileiros são normalizados para `+55DDDNUMERO`; telefone alternativo válido é usado se o principal for inválido. E-mail e telefone inválidos são omitidos, sem impedir o pagamento.

Não envia CPF nem endereço nesta alteração. A opção de endereço de entrega continua desativada. Esses dados são enviados somente no corpo da requisição do servidor à InfinitePay, nunca como parâmetros públicos do link. Não há novas variáveis de ambiente nem nova migração específica para este preenchimento; o código utiliza os vínculos familiares da migração 014 já incluída no projeto.

A InfinitePay documenta o preenchimento antecipado, sem garantir que a etapa de contato será completamente pulada. Links emitidos anteriormente continuam sendo reutilizados para evitar cobrança duplicada: publicar esta atualização não modifica os dados desses links. Teste a melhoria com uma mensalidade que ainda não tenha checkout emitido. A suíte utiliza um servidor bancário simulado, sem emitir cobranças reais.

## Ação Pagar na mensalidade

O botão principal **Pagar** emite ou recupera o checkout e abre diretamente a InfinitePay, tanto para gestor quanto para aluno. No navegador, o checkout abre na mesma aba para evitar bloqueio de pop-up após a resposta da API. Erros permanecem visíveis na mensalidade e casos em conferência abrem os detalhes, sem confirmar recebimento antecipadamente.

A opção **Registrar pagamento recebido por fora** fica no menu de três pontos, junto de desconto, histórico e cancelamento. Ela continua sendo uma baixa manual, sujeita às proteções de cobranças já emitidas. Abrir ou voltar do checkout não marca a mensalidade como paga.

## Retomar pagamento e alterar mensalidade após checkout emitido

A mensalidade exibe o link emitido, com Continuar pagamento e Copiar link. Reabrir a tela ou copiar não emite outro checkout. Se a validade local terminou, o endereço original continua disponível para consulta, com aviso de que o provedor determina se ainda aceita pagamento. Não há promessa de reemissão automática.

Em Mais ações → Gerenciar checkout, gestores consultam URLs e referências antigas. Antes de alterar desconto, cancelar ou registrar recebimento externo, devem conferir no provedor que não houve pagamento e que o link antigo foi inutilizado. A ação Registrar conferência exige confirmação explícita e evidência/protocolo de 10 a 500 caracteres. Ela não cancela um link na InfinitePay. Se o painel não permitir inutilizar, é necessário confirmar com o suporte do provedor; não marque a confirmação apenas porque não houve pagamento.

A migração 016 conserva as tentativas antigas, adiciona autor/data/evidência da conferência e permite uma tentativa atual por mensalidade. Não foi aplicada pela assistência no banco local de uso nem no Neon; a API a aplica na próxima inicialização normal após atualização. Faça backup antes de publicar.

Após a conferência registrada, o gestor edita o desconto e solicita novo checkout. O novo link usa o novo valor e outra referência. Notificações antigas continuam rastreáveis: se aparecer pagamento em link substituído, o sistema avisa o gestor sem dar baixa indevida na mensalidade atual. Gestores veem esse alerta na mensalidade e no histórico de checkouts.

A API pública consultada não documenta cancelamento/inutilização de checkout. Expiração, exclusão local e uma resposta paid=false não são prova de inutilização. Emissões sem URL por perda de resposta continuam em conferência; não inventamos uma URL nem uma API de busca por referência.
