# Cadastro, privacidade e início da assinatura

## Entrega

- Cadastro público exige senha repetida idêntica e versões atuais de Termos de Uso e Aviso de Privacidade. A API valida antes de gravar usuário ou hash. Senha repetida não é persistida.
- `account_legal_acceptances` registra usuário, versões e data do servidor na mesma transação. Não registra senha, IP adicional nem autorização de marketing. Contas existentes não recebem aceite retroativo fictício.
- `/privacy` e `/terms` são públicas. Os mesmos textos abrem em modal no cadastro, preservando o formulário. Ciência do aviso não equivale a consentimento genérico para qualquer tratamento.
- Nova academia exige `plan_id` e `terms_version`. Plano, aceite comercial e cinco dias de teste são persistidos na transação de criação. Teste não é renovado no login e não vira tolerância extra após expirar.
- O plano escolhido é um piso comercial. Quantidade real de matrículas ativas não arquivadas determina subida automática. Não se inventa quantidade para encaixar o plano. Cada academia tem assinatura independente.
- Assinatura legada e cobranças já emitidas mantêm seus valores. Não há cobrança real automática na criação ou mudança de faixa.

## Antes da publicação

O canal público confirmado é `vitorrodriguesvargas@gmail.com`. Os documentos identificam o serviço como TatameMix; não foi inventada razão social ou CNPJ. Para substituir os dados no build do frontend:

```dotenv
EXPO_PUBLIC_PRIVACY_EMAIL=canal_publico_real
EXPO_PUBLIC_LEGAL_RESPONSIBLE=nome_ou_razao_social
```

O e-mail confirmado é o padrão quando não há variável configurada. A organização deve validar os textos com seu responsável jurídico, bases por finalidade, retenção, atendimento de titulares, contratos com fornecedores e mecanismos de transferência internacional. A interface e o registro do aceite, isoladamente, não certificam conformidade com a LGPD.

Fontes primárias consultadas: [ANPD — perguntas frequentes](https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes) e [ANPD — direitos dos titulares](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares).

Publique a API com a migração 019 antes do frontend. A API nova rejeita cadastros de clientes antigos que não enviem confirmação de senha ou aceite versionado, e novas academias sem plano. No desenvolvimento reinicie o Go e o Expo. Em produção gere nova imagem do backend e novo build da Vercel. Não aplique testes de integração no Neon ou no banco local de uso.
