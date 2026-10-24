# Gestores da academia

Em **Mais > Gestores**, um gestor ativo pode adicionar outra pessoa à gestão da academia selecionada.

- **Nova conta:** informar nome, e-mail e senha de acesso. A conta e o vínculo são criados na mesma transação.
- **Conta existente:** informar o e-mail e confirmar o vínculo. O nome e a senha existentes são preservados.
- Cada pessoa entra com suas próprias credenciais e administra os mesmos dados da academia. Não é criado cadastro financeiro de aluno nem enviada mensagem automática.
- O formulário começa vazio. Nenhuma conta é criada pela instalação desta funcionalidade.

## API

`GET /v1/academies/{academy_id}/managers` lista os gestores.

`POST /v1/academies/{academy_id}/managers` recebe `name`, `email` e `password` para uma conta nova, ou `email` e `link_existing: true` para uma conta existente.

As duas rotas exigem sessão pessoal de gestor ativo daquela academia. A API verifica novamente a permissão dentro da transação, normaliza o e-mail e conserva a identidade única. Não retorna senha ou sessão do novo gestor. A proteção existente contra remoção do último gestor permanece ativa.

Não há alteração de esquema nem migração de banco nesta entrega. O teste de integração `TestAcademyManagers` usa exclusivamente o PostgreSQL dedicado indicado por `TEST_DATABASE_URL`.
