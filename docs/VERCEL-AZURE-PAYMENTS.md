# Pagamentos com frontend Vercel e API Azure

O retorno do navegador deve ir ao portal. Webhooks devem ir diretamente a API.
As duas integracoes (mensalidades dos alunos e assinatura do software) usam:

```dotenv
PAYMENTS_PORTAL_URL=https://www.tatamemix.com.br
PAYMENTS_API_URL=https://tatamemix-api.mangopebble-47e5789a.brazilsouth.azurecontainerapps.io
ALLOWED_ORIGINS=https://www.tatamemix.com.br,https://tatamemix.com.br,https://app-jiujitsu-golang-mobile.vercel.app
PORT=8080
```

PAYMENTS_PUBLIC_URL e o fallback legado para instalacoes com uma unica origem.
As variaveis especificas acima prevalecem. Informe somente origens HTTPS, sem
caminho, query ou credenciais. Nao use a URL da InfinitePay nesses campos.

## Segredos e ativacao na Azure

- DATABASE_URL: conexao direta Neon com TLS, em Secret.
- PAYMENTS_MASTER_KEY: Secret base64 de 32 bytes. Preserve a chave existente
  quando o banco ja contiver credenciais cifradas.
- INFINITEPAY_ENABLED=true: habilita mensalidades dos alunos. Cada academia
  configura sua propria conexao InfinitePay em Mais > Recebimentos.
- TATAMEMIX_INFINITEPAY_API_KEY: Secret da conta recebedora da TatameMix.
- TATAMEMIX_INFINITEPAY_HANDLE: InfiniteTag da TatameMix, sem o cifrao.
- TATAMEMIX_BILLING_ENABLED=true: habilita assinatura e regras de acesso.

A assinatura implementada custa R$ 450/mes por academia (nao R$ 250), com
pagamento mensal iniciado pelo gestor, sem debito automatico. Ao ativar,
academias passam a ter vencimento inicial e cinco dias de tolerancia conforme
docs/SUBSCRIPTIONS.md. Nao confunda a conta da plataforma com as academias.

## Vercel

```dotenv
EXPO_PUBLIC_API_URL=https://tatamemix-api.mangopebble-47e5789a.brazilsouth.azurecontainerapps.io
EXPO_PUBLIC_PORTAL_URL=https://www.tatamemix.com.br
```

Republicar o frontend apos alterar variaveis EXPO_PUBLIC_*; elas sao incorporadas
no build. Nunca coloque chaves bancarias, chave mestra ou DATABASE_URL na Vercel.
O backend ja permite Authorization, Content-Type e Idempotency-Key via CORS.
Configure as origens explicitamente; nao use '*' nem caminhos em ALLOWED_ORIGINS.

## Publicacao e verificacao

1. Publique o codigo atualizado no GitHub, execute o workflow de imagem e
   selecione a nova tag no aplicativo Azure. Alterar somente as envs nao atualiza
   a imagem antiga. Tenha backup antes da inicializacao com migracoes.
2. Configure as origens, segredos e flags e salve uma nova revisao. Porta 8080.
3. Mantenha uma replica minima e maxima enquanto os workers internos sao usados.
   Escala zero interrompe a conciliacao em segundo plano ate o proximo despertar.
   Nao mantenha Render e Azure executando workers na mesma base de producao.
4. Verifique /healthz, login no dominio final e navegacao nas rotas /pay e
   /subscription (incluindo atualizar a pagina).
5. Valide primeiro o contrato com testes simulados em banco isolado. Em producao,
   confira que um novo checkout retorna ao dominio Vercel e aponta o webhook a
   Azure. Gerar checkout e pagar sao acoes explicitas do operador/cliente.
6. Confira retorno, confirmacao consultada no provedor, baixa unica, historico e
   liberacao da assinatura. A implantacao de codigo nao comprova um pagamento.

Links ja emitidos conservam os destinos antigos; as novas origens sao usadas
somente nos proximos checkouts. Testes automatizados nao enviam cobrancas reais.

Execute no backend: `go test ./internal/config ./internal/payments ./internal/subscriptions`
e, com TEST_DATABASE_URL apontando exclusivamente a uma base descartavel,
`go test ./internal/httpapi -run 'TestInfinitePayFlow|TestPlatformSubscription'`.
