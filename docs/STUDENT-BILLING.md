# Cadastro e mensalidades do aluno

O cadastro administrativo confere CPF, e-mail e telefones ao digitar, com uma pausa de 450 ms. O endpoint POST /v1/academies/{id}/students/check-identity exige gestor ativo, exclui o próprio cadastro em edições e não revela dados de outra pessoa. A conferência antecipada não substitui as restrições transacionais do salvamento. Contatos telefônicos compartilhados geram aviso para permitir famílias.

A primeira cobrança ativada não pode nascer vencida: 28/10 com vencimento dia 15 começa em 15/11. Um mês futuro explicitamente escolhido é preservado. Os meses curtos usam seu último dia. Mensalidades já emitidas não são apagadas nem alteradas por essa correção.

A mensalidade tem o atalho Ver aluno, exclusivo da gestão. O cadastro do aluno apresenta a aba Mensalidades com todos os meses, filtros por situação e paginação de 12 itens. A seção de próximos seis meses é uma previsão do contrato atual; não cria dívidas nem links de pagamento. Cobranças futuras já emitidas continuam na listagem principal.

## Identidade única

CPF e e-mail identificam uma única pessoa no sistema. A criação administrativa de aluno não pode reutilizar um e-mail existente, mesmo com os campos antigos reuse_existing_identity ou use_my_account. A edição do próprio registro mantém seus identificadores; contatos telefônicos compartilhados são permitidos. A tela não apresenta opções de confirmar/reutilizar identidade.

A migração 017 verifica conflitos de CPF entre pessoas diferentes e instala uma proteção transacional global, inclusive para SQL direto e gravações simultâneas em academias distintas. Não apaga, não une e não corrige registros automaticamente. Conflitos existentes interrompem a migração para revisão. Participações históricas da mesma identidade em academias diferentes são preservadas; isso não cria outra conta ou outra pessoa. Login e aceite de convite continuam usando a conta original.

A migração deve ser testada em uma cópia do banco antes da publicação. Nenhum banco real foi atualizado na implementação desta mudança.
