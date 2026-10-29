# Assinatura TatameMix — R$ 450 por academia/mês

A cobrança do software é separada das mensalidades dos alunos. Cada academia tem uma única assinatura, compartilhada pelos seus gestores. O recebedor é a conta InfinitePay da TatameMix, configurada pelo operador no servidor. Nunca é usada a chave bancária cadastrada pela academia em Recebimentos.

## Experiência

Mais → Assinatura TatameMix, no navegador ou no aplicativo:

- Plano mensal fixo: R$ 450. Sem descontos e sem plano anual nesta entrega.
- Próximo vencimento, período de acesso, histórico paginado e conferência.
- Pagar por Pix ou cartão no checkout hospedado.
- Encerrar ao fim do período pago ou retomar.
- Aviso nos sete dias anteriores ao vencimento, durante a tolerância e após restrição.

O backend define o valor (45000 centavos) e o banco impõe esse valor. O frontend não escolhe o preço. Não armazenamos dados de cartão nem implementamos débito automático. Renovação significa gerar/pagar o próximo mês por ação do gestor; não é autorização de cartão recorrente.

## Ativação no servidor

A migração 015 é aditiva e será aplicada na inicialização normal da API após publicar/reiniciar. Os testes usam PostgreSQL temporário; esta implementação não executou a migração no banco local de uso nem no Neon.

Antes de ativar em produção, faça backup, configure:

    TATAMEMIX_BILLING_ENABLED=false
    TATAMEMIX_INFINITEPAY_API_KEY=chave_da_conta_da_TatameMix
    TATAMEMIX_INFINITEPAY_HANDLE=sua_infinite_tag_sem_cifrao
    PAYMENTS_PUBLIC_URL=https://seu-endereco-publico-do-TatameMix

Na configuração do Checkout InfinitePay da TatameMix, mantenha descontos por método desativados. O nosso link não configura descontos; valor recebido divergente vai para conferência.

Cadastre API key como Secret na hospedagem. Não envie chaves pelo chat, GitHub, frontend ou EXPO_PUBLIC_*. PAYMENTS_PUBLIC_URL é a origem do TatameMix, não o endereço da sua InfinitePay. Pode ser compartilhada com o fluxo de mensalidades, mas as credenciais e tabelas dos dois fluxos são independentes. INFINITEPAY_ENABLED controla mensalidades dos alunos; TATAMEMIX_BILLING_ENABLED controla a assinatura do software.

Habilitar TATAMEMIX_BILLING_ENABLED=true exige chave, InfiniteTag e origem HTTPS válida. Confira que os três pertencem ao ambiente correto. Não altere a conta recebedora enquanto existirem cobranças pendentes; tentativas da conta anterior vão para conferência.

Com a flag false, a tela explica que a cobrança ainda não foi liberada e não restringe academias. Nenhuma configuração real foi modificada por esta implementação.

## Calendário e acesso

Ao primeiro acesso/uso de uma academia com a cobrança habilitada, o sistema registra o início da assinatura e vencimento inicial imediato. Há cinco dias de tolerância. Portanto, ativar a flag começa a implantação comercial nas academias existentes à medida que forem usadas; combine essa ativação com os clientes.

- Pagamento em dia: acesso até o fim do período pago.
- Vencimento até menos de cinco dias: aviso, operações liberadas.
- Cinco dias ou mais: novas operações administrativas, novas matrículas e check-ins ficam restritos pela API (HTTP 402).
- Leitura/consulta e histórico continuam acessíveis. Login, seleção de academia, pagamentos de alunos e assinatura continuam disponíveis.
- Webhooks e conciliação continuam processando recebimentos.
- Pagamento confirmado libera operações pela verificação dinâmica do período pago.

Pagamento antecipado acrescenta um mês ao período já pago. Se houver interrupção, o pagamento reativa por um mês a partir da confirmação, sem criar automaticamente uma dívida retroativa de todos os meses sem uso. Dias que não existem no mês são ajustados ao último dia; em renovação antecipada o dia original é conservado.

Encerrar não remove dados, não estorna valores e não revoga links bancários já emitidos. Depois do período pago, acesso de escrita fica restrito sem nova tolerância de renovação. Retomar permite pagar novamente e não gera cobrança real sozinho. Alterações de renovação são auditadas com gestor e data.

## Segurança do recebimento

1. Status/histórico não emitem link; existe somente um período aberto esperado.
2. O gestor solicita checkout explicitamente com cycle_id.
3. Tentativa/referência são persistidas antes da chamada externa; a unicidade serializa pedidos concorrentes.
4. O checkout é de pagamento único, válido inicialmente por 24 horas, com valor fixo e sem descontos.
5. Resposta desconhecida/expiração local não autorizam outro link. O caso fica em conferência.
6. O webhook é persistido e recebe HTTP 200; seu conteúdo não comprova pagamento.
7. A API consulta /payment_check com a chave da plataforma e confere referência, valor, transação e meio.
8. Recibo, período pago e baixa são gravados na mesma transação. Repetições não estendem acesso novamente.
9. Divergências e sinais de estorno exigem conferência; não há estorno automático.
10. Retorno do navegador exige login de gestor da academia correta e consulta independente ao provedor.

O worker interno processa até 30 eventos e 30 tentativas elegíveis por ciclo, no início e a cada minuto. Falhas transitórias são tentadas novamente; eventos sem confirmação após 20 tentativas ficam em conferência. A conciliação automática depende de identificadores suficientes. Sem transaction_nsu/slug, não inventamos uma consulta de busca por referência: é necessário retorno/webhook válido ou suporte. Se o container parar em escala zero, o worker só retoma quando o processo voltar.

Um webhook de estorno não apaga recebimentos. O retorno bancário divergente abre um alerta de conferência. A versão atual não faz revogação automática de período já concedido por chargeback; atendimento financeiro deve revisar esses casos.

## API

Base: /v1/academies/{academy}/subscription. Exige gestor ativo:

| Método | Caminho | Finalidade |
| --- | --- | --- |
| GET | /subscription | Estado, preço e período atual |
| PATCH | /subscription | enabled: manter ou encerrar renovação |
| GET | /subscription/history | Histórico com page/page_size |
| POST | /subscription/checkout | cycle_id: gerar ou recuperar checkout |
| POST | /subscription/payment-check | attempt_id ou event.order_nsu + identificadores do retorno |
| POST público | /v1/webhooks/tatamemix/infinitepay | Persistir aviso; confirmação via provedor |

Tabelas: platform_subscriptions, platform_subscription_cycles, platform_subscription_attempts, platform_subscription_receipts, platform_subscription_inbox, platform_subscription_events. Não se misturam com invoices, checkout_attempts ou conexões da academia.

## Validação

Os testes simulam InfinitePay e usam banco isolado: preço, calendário, tolerância, múltiplos gestores, permissões entre academias, concorrência, webhook falso/repetido, resposta perdida, divergência de valor, retomada e cancelamento. O teste controlado real só deve acontecer após configuração e autorização do responsável. Não houve cobrança real nesta entrega.

[Contrato oficial de checkout consultado](https://ajuda.infinitepay.io/pt-BR/articles/10766888-como-usar-o-checkout-integrado-da-infinitepay).
