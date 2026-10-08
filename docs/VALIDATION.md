# Verificação da entrega local

Os dados usados são de demonstração, em bancos locais separados de qualquer ambiente de produção.

## API

Verificados com Go e PostgreSQL 17 real:

- Cadastro, login e vínculo pendente sem acesso à academia.
- Criação de duas academias e aprovação de aluno e professor.
- Isolamento de consultas, histórico e ações entre academias.
- Criação de turma e horário; abertura repetida gera a mesma aula.
- Autorização do professor responsável, do gestor e do dispositivo.
- Provisionar tablet revoga a sessão pessoal usada no provisionamento.
- Reenvio com a mesma chave devolve a mesma presença.
- Reutilizar a chave com outro corpo é recusado.
- Doze registros simultâneos com chaves diferentes geram uma única presença.
- Vínculo bloqueado, aula encerrada ou cancelada e dispositivo revogado são recusados.
- O último gestor ativo não pode ser removido.
- O aluno não pode consultar o dashboard administrativo.
- Logout revoga a sessão; credencial expirada recebe 401.
- Decodificação recusa campos desconhecidos e JSON inválido ou concatenado.

Comandos: `go test ./...` com `TEST_DATABASE_URL` definido e `go vet ./...`. Os testes passaram.

## Aplicativo

Lint (npm run lint) passou sem erros ou avisos.

- 
pm run typecheck` passou.
- 
px expo-doctor` passou em 21/21 verificações.
- 
pm run export:web` gerou o bundle.
- Preview no navegador em largura de celular: login, seleção de academia, dashboard, QR do aluno, modo tablet, confirmação por código, histórico e lista do professor.
- A presença de João Silva apareceu na primeira academia; na segunda, o dashboard continuou com zero presenças.
- Sem erros JavaScript registrados pelo navegador nos fluxos verificados.
- Imagens da confirmação e do histórico estão em `artifacts`.
- O comando `scripts/start-dev.ps1` iniciou a API e disponibilizou o healthcheck.

O preview é uma ferramenta de validação das telas compartilhadas. O teste no navegador não substitui o teste do Android.

## Estudo offline

Sete testes com SQLite real passaram: perda de resposta, dois tablets, três tipos de recusa, persistência da fila após reinício e cache de alunos/aulas separado por academia. O aplicativo do MVP continua online.

## Conferir em celular e tablet

- Instalar o APK e verificar acesso à API pela rede local.
- Conceder acesso à câmera e ler o QR do aluno.
- Testar tamanhos, teclado, rotação, retorno do segundo plano e SecureStore.
- Desconectar a rede durante o envio: a tela deve apresentar erro, conservar a tentativa para reenvio e confirmar somente após a resposta.
- Validar professor, aluno e tablet em aparelhos diferentes.

Não havia aparelho Android conectado para essa verificação. Docker Compose e o build EAS também não foram executados; a API e o PostgreSQL foram executados com ferramentas portáteis locais.

## Dependências

O lockfile fixa as versões instaladas. 
pm audit` reportou 29 ocorrências (10 moderadas e 19 altas), incluindo dependências transitivas de Expo/Metro e bibliotecas usadas por elas. A correção automática com `--force` sugeriu retroceder Expo e React Native para versões incompatíveis com este projeto, por isso não foi aplicada. Essas ocorrências precisam de revisão e atualização compatível antes de uma publicação pública. O APK desta entrega se destina ao teste interno.

## Critério de aprovação do piloto

Os testes automatizados e o fluxo por código no preview passaram. A aprovação do piloto Android depende da conferência em aparelho físico descrita acima.

## APK gerado

Build Android local concluído com sucesso. O arquivo artifacts/Tatame-arm64.apk tem 53014285 bytes, arquitetura arm64-v8a e Android mínimo 7 (API 24). A assinatura APK v2/v3 e o alinhamento de 16 KiB foram verificados por apksigner. O endereço http://192.168.15.6:8080 foi confirmado no bundle. O hash SHA-256 está salvo junto do APK.

O bundle Hermes final foi gerado com Expo export:embed após os ajustes de lint. O APK foi realinhado e assinado novamente com Android SDK. Os 1286 arquivos nativos e assets mantiveram hashes idênticos aos do build Gradle; o bundle embutido corresponde ao código final.
