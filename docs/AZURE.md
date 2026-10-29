# Azure produção e Render teste

A mesma imagem reúne o Expo web compilado e a API Go. PostgreSQL continua externo, no Neon. Nenhum servidor Expo/Node permanece executando na imagem final.

## Construir a imagem

Use o Dockerfile **da raiz**, com contexto na raiz. backend/Dockerfile é uma alternativa somente para a API.

```powershell
docker build --platform linux/amd64 -t tatamemix:azure-v1 .
```

Execute na pasta App-jiujitsu, com Docker Desktop em modo Linux. O build verifica TypeScript, lint, testes frontend, exportação web e módulos Go, e compila a API. Não acessa o Neon nem aplica migrações.

Dockerfile é a receita; imagem é o resultado com o código daquele momento; container é a imagem em execução. Alterar telas normalmente exige reconstruir a imagem, não alterar a receita. As etapas de cache aceleram recompilações quando o builder preserva o cache.

Para o Azure executar a imagem, publique-a em um registry acessível, como ACR ou GHCR, e configure a autorização de leitura. Git push sozinho não publica imagem sem automação configurada. Use uma tag nova por entrega. Este trabalho não cria registry, pipeline nem recursos Azure.

## Configuração no Azure Container Apps

1. Selecione a imagem Linux amd64 publicada no registry. Para ACR, prefira identidade gerenciada com permissão de leitura apropriada.
2. Habilite ingress HTTP externo, HTTPS e **target port 8080**.
3. Deixe command/args vazios: a imagem inicia /app/api como usuário sem privilégios.
4. Cadastre os segredos e variáveis abaixo.
5. Comece com máximo de uma réplica por revisão e modo de revisão única. Isso limita duplicação de trabalho de fundo, mas pode haver sobreposição temporária em atualizações/manutenção. Antes de escalar, revisar migrações e workers.
6. Configure probes: readiness HTTP /healthz na porta 8080; liveness TCP 8080; startup com tolerância ao tempo de migrações e despertar do Neon. /healthz consulta o banco; usá-lo como liveness pode causar reinícios durante falhas do PostgreSQL.
7. Valide /healthz, /login, /students e atualização de página numa rota de detalhe.

O Go serve arquivos estáticos e fallback para index.html em rotas do portal. /v1/* continua sendo API. Não precisa de Nginx nem servidor Node na imagem. HTTPS termina no ingress; internamente a API usa HTTP.

### Variáveis por ambiente

| Variável | Configuração |
| --- | --- |
| DATABASE_URL | Secret: conexão PostgreSQL de produção com TLS. Na arquitetura atual, use conexão direta: o processo também aplica migrações e configuração de sessão. |
| PAYMENTS_MASTER_KEY | Secret: Base64 de exatamente 32 bytes. Preserve a chave que cifrou as credenciais já existentes ao transferir uma base. |
| PAYMENTS_PUBLIC_URL | Origem HTTPS pública do TatameMix em produção, sem caminho: URL gerada pelo Azure ou https://tatamemix.com.br depois que DNS/domínio/certificado estiverem funcionando. |
| INFINITEPAY_ENABLED | false na primeira publicação; true quando você validar o endereço e decidir liberar os pagamentos reais. |
| PORT | 8080, já definido na imagem; igual ao target port. |
| WEB_DIST_DIR | /app/web, já definido na imagem. |
| ALLOWED_ORIGINS | Origens HTTPS explicitamente permitidas caso exista frontend em outra origem; site e API da mesma imagem usam mesma origem. Não use auto em produção. |

Não configure HTTP_ADDR herdado como localhost:8080: ele prevalece sobre PORT e pode impedir acesso pelo ingress.

EXPO_PUBLIC_API_URL=same-origin é fixada durante o build web. O navegador chama a API no endereço onde abriu o site. A mesma imagem pode rodar no Render e Azure. Isso não configura um APK/Expo Go distribuído separadamente.

Não copie .env, credenciais ou backups para a imagem. A .dockerignore já os exclui. As chaves InfinitePay por academia são cadastradas no aplicativo e ficam cifradas no banco; não são EXPO_PUBLIC_*.

### Assinatura do software

Para receber os R$ 450 da academia na conta da TatameMix, configure separadamente TATAMEMIX_INFINITEPAY_API_KEY (Secret), TATAMEMIX_INFINITEPAY_HANDLE e TATAMEMIX_BILLING_ENABLED. A flag começa false. Consulte [SUBSCRIPTIONS.md](SUBSCRIPTIONS.md) antes de habilitar: há migração 015 e a tolerância começa no primeiro uso da academia após ativação. Estas credenciais não são as da academia em Recebimentos.

### Teste e produção separados

| Item | Render: teste | Azure: produção |
| --- | --- | --- |
| Imagem | Versão em teste | Versão validada |
| DATABASE_URL | Banco/branch de teste | Banco/branch de produção |
| PAYMENTS_PUBLIC_URL | HTTPS do Render | HTTPS do Azure/domínio ativo |
| Pagamentos | Preferencialmente desabilitados | Habilitar após teste controlado |
| Dados | Exemplos apropriados para teste | Cadastros e recebimentos reais |

Usar o mesmo banco nos dois serviços não separa ambientes: testes, migrações e rotinas de cobrança atingiriam produção. Uma cópia contendo credenciais cifradas depende da chave mestra antiga; gerar outra chave não recifra dados existentes. Para teste sem recebimento real, desative a integração e prepare dados/configurações de teste. Não presumir sandbox da InfinitePay.

### Inicialização, escala e transição

Ao iniciar, main.go lê configuração, aplica migrações Goose, abre o pool, carrega pagamentos, inicia worker e atende HTTP. Antes de iniciar na base de produção, tenha backup e revise migrações pendentes. O Docker build não toca no banco.

Mínimo zero permite parada por inatividade e cold start; workers internos também param e retomam ao iniciar. Mínimo 1 mantém uma réplica solicitada, com custo possível. Confira custos de execução, registry e logs; não há garantia de serviço sempre disponível e gratuito.

Novos checkouts usarão PAYMENTS_PUBLIC_URL atualizado. Links antigos podem conservar callback/endereço anterior no provedor. Planeje essa transição antes de desligar o endereço antigo. Não aponte o Render de teste à base de produção como solução.

### Depois de publicar

- Logs mostram migrações concluídas e Tatame API ready.
- /healthz responde 200 com status ok.
- Links diretos e atualização de detalhes funcionam.
- Login e permissões de academia funcionam.
- Novo checkout aponta para o ambiente correto; confirmação é consultada no provedor.
- Banco teste e banco produção são diferentes.
- CPU, memória, latência e reinícios são observados antes de ampliar escala.

## Referências oficiais

- [Containers Linux amd64 e registries](https://learn.microsoft.com/en-us/azure/container-apps/containers)
- [Ingress e porta](https://learn.microsoft.com/en-us/azure/container-apps/ingress-how-to)
- [Secrets e reinício após alterações](https://learn.microsoft.com/en-us/azure/container-apps/manage-secrets)
- [Health probes](https://learn.microsoft.com/en-us/azure/container-apps/health-probes)
- [Escala e réplicas mínimas](https://learn.microsoft.com/en-us/azure/container-apps/scale-app)
