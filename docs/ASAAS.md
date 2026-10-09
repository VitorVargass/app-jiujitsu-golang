# Pix com Asaas

Cada academia recebe em sua própria conta Asaas. O Tatame gera cobranças PIX e consulta seu pagamento; não faz transferências ou repasses automáticos.

## Configuração no servidor

1. Crie/libere uma conta Asaas da academia e comece pelo sandbox. Cadastre uma chave Pix nessa conta.
2. Copie backend/asaas-connections.example.json para backend/asaas-connections.json, que está ignorado pelo Git.
3. Informe uma conexão por academia: id UUID próprio, academy_id retornado pela API, environment, base_url, api_key e webhook_token aleatório entre 32 e 255 caracteres.
4. Defina ASAAS_CONNECTIONS_FILE como o caminho desse arquivo no processo da API. Reinicie a API. Sem essa configuração o sistema funciona, mas o botão Pix informa que a academia ainda não habilitou pagamentos.
5. No painel Asaas, configure o webhook HTTPS público: /v1/webhooks/asaas/{id-da-conexao}/pix. O token configurado no webhook deve ser o mesmo webhook_token, enviado pelo Asaas em asaas-access-token.
6. Habilite eventos PAYMENT_CREATED, PAYMENT_UPDATED, PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE, PAYMENT_DELETED e eventos de estorno. O sistema consulta o estado atual no provedor mesmo quando recebe avisos fora de ordem.

Sandbox: https://api-sandbox.asaas.com/v3. Produção: https://api.asaas.com/v3. A configuração exige correspondência entre endereço e ambiente. Nunca coloque chaves em EXPO_PUBLIC_* ou no aplicativo. Restrinja as permissões do arquivo às contas do servidor.

O aplicativo mostra somente o estado da integração. Credenciais e tokens não aparecem nas respostas ou nos logs.

## Emissão e confirmação

A mensalidade é local, com valor em centavos e dados do pagador preservados na emissão. O Pix é emitido sob demanda ao abrir o pagamento. O worker gera mensalidades e reconcilia cobranças a cada minuto e na inicialização.

Antes de chamar o Asaas, a API reserva uma referência única no PostgreSQL. Se perder a resposta de criação, procura a mesma externalReference antes de emitir novamente. Se o resultado continuar incerto, mantém a emissão em conferência e não faz outra criação. Uma rejeição definitiva do provedor permite nova tentativa. Uma operação interrompida libera seu bloqueio após dois minutos; a referência continua preservada.

Quando a emissão permanece incerta e não existe cobrança consultável, o operador precisa conferir essa referência no Asaas antes de autorizar uma nova emissão. Não há reset automático de resultado desconhecido: evita cobrar duas vezes quando o provedor ainda está processando.

Avisos são autenticados e tratados como gatilho para consultar o pagamento, não como comprovante. A API confere conta da academia, identificação PIX, referência e valor exato. RECEIVED ou CONFIRMED dão baixa; a restrição por academia/identificador impede duplicação. Uma reconciliação periódica cobre ausência de webhook. Estorno integral confirmado cancela a mensalidade; estornos parciais precisam de conferência financeira e não são realizados pela interface.

O Pix expira na data informada pelo Asaas. Antes da reemissão, a API consulta a cobrança anterior e cancela seu pagamento pendente. Um pagamento confirmado impede reemissão/cancelamento. Mensalidade vencida não bloqueia presença.

## Homologação pendente

Os testes do repositório usam um servidor HTTP simulado e PostgreSQL real. Eles não enviam dinheiro ou criam cobranças bancárias reais. Para liberar produção ainda é necessário testar com credenciais sandbox da academia, URL HTTPS acessível, eventos reais e pagamento de homologação. Confirme também as tarifas e condições da conta diretamente no Asaas.

Referências oficiais: [Pix e QR dinâmico](https://docs.asaas.com/docs/cobrancas-via-pix), [eventos de cobrança](https://docs.asaas.com/docs/webhook-para-cobrancas), [criação de webhook](https://docs.asaas.com/docs/create-new-webhook-via-api).
