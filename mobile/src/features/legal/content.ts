export const LEGAL_VERSION = "2026-11-05";
export const privacyContact =
  process.env.EXPO_PUBLIC_PRIVACY_EMAIL?.trim() ||
  "vitorrodriguesvargas@gmail.com";
export const legalResponsible =
  process.env.EXPO_PUBLIC_LEGAL_RESPONSIBLE?.trim() || "TatameMix";

export const privacySections = [
  [
    "Exclusão de conta e dados",
    `Solicite em Minha conta → Excluir minha conta, em Mais → Excluir minha conta ou na página pública /delete-account, inclusive após desinstalar o aplicativo. Sem login, envie o pedido para ${privacyContact}; o atendimento confirma o recebimento e verifica sua identidade pelo controle do e-mail cadastrado ou por alternativa proporcional. Dentro do app, a senha atual confirma o pedido e a API registra um protocolo. O atendimento manual abrange todas as academias e separa credenciais de registros mantidos por cada academia. Dados sem finalidade de conservação são apagados ou anonimizados; registros financeiros, contratuais e de segurança com justificativa aplicável são minimizados e conservados somente enquanto a finalidade persistir. O atendimento informa quais registros foram conservados, finalidade e prazo ou critério de término em cada caso. Não há prazo operacional fixo publicado. O protocolo mínimo permanece enquanto necessário para acompanhar e comprovar o atendimento, com revisão na conclusão. Gestores combinam transferência explícita ou encerramento separado da academia com o suporte. Na conclusão são removidas credenciais, sessões e acessos pessoais; dispositivos compartilhados da academia são preservados. O pedido não cancela cobranças externas, não gera reembolso e não equivale a arquivar aluno ou encerrar renovação.`,
  ],
  [
    "Quem trata seus dados",
    `${legalResponsible} mantém o TatameMix e trata os dados de conta, acesso e assinatura do software. Cada academia define as finalidades dos dados de seus alunos e responsáveis; o TatameMix fornece a tecnologia para operar essa gestão. Solicitações sobre matrículas e dados escolares/esportivos devem identificar a academia responsável.`,
  ],
  [
    "Quais dados e para quê",
    "Usamos nome, e-mail e credenciais protegidas para criar a conta e controlar acessos. Conforme os recursos usados, a academia registra identificação, contato, CPF, nascimento, responsáveis, matrícula, graduação, presenças e cobranças. Esses dados servem à gestão contratada, segurança, identificação e cumprimento de obrigações aplicáveis. Não é necessário fornecer dados de saúde para criar uma conta.",
  ],
  [
    "Bases e escolhas",
    "Os tratamentos necessários ao serviço podem se apoiar na execução do contrato, obrigações legais e exercício regular de direitos, conforme a finalidade. A ciência deste aviso não autoriza uso irrestrito dos dados, publicidade ou finalidades incompatíveis. Quando uma finalidade exigir consentimento específico, ele deverá ser solicitado separadamente. A academia deve avaliar as bases aplicáveis a cada cadastro, inclusive de crianças e adolescentes, observando seu melhor interesse.",
  ],
  [
    "Serviços envolvidos",
    "A operação utiliza Azure para a API, Neon para o banco e Vercel para o portal web. Pagamentos são processados pela InfinitePay na conta conectada da academia ou da TatameMix, conforme a cobrança. Dados necessários podem ser tratados por esses fornecedores, inclusive fora do Brasil, sujeitos às condições e mecanismos de proteção aplicáveis. O TatameMix não recebe nem armazena os dados completos do cartão digitados no checkout.",
  ],
  [
    "Proteção e conservação",
    "O acesso é separado por academia e perfil, e senhas são armazenadas como hash. Nenhum serviço elimina todos os riscos. Dados são mantidos enquanto necessários à prestação, obrigações e defesa de direitos. Encerrar uma assinatura não apaga automaticamente registros financeiros ou dados sujeitos a conservação. Pedidos de exclusão são avaliados por finalidade e obrigação aplicável.",
  ],
  [
    "Seus direitos",
    "Você pode solicitar confirmação e acesso, correção, informações sobre compartilhamento, portabilidade nos termos aplicáveis e avaliação de anonimização, bloqueio ou eliminação. Pode questionar finalidades, revogar consentimentos específicos e peticionar à ANPD. A eliminação pode ter exceções legais. Para proteger a conta, podemos pedir comprovação proporcional de identidade; não envie sua senha.",
  ],
  [
    "Sessão e armazenamento local",
    "O portal guarda informações necessárias para manter sua sessão e preferências de acesso. Sair da conta encerra a sessão utilizada pelo aplicativo. Este aviso não equivale a consentimento para rastreamento publicitário.",
  ],
];
export const termsSections = [
  [
    "Conta e uso",
    "Use dados corretos, proteja sua senha e acesse somente academias e perfis autorizados. Não compartilhe credenciais, tente acessar dados de terceiros ou use o serviço para finalidades ilícitas. O responsável por crianças deve usar sua própria conta quando o fluxo exigir um responsável.",
  ],
  [
    "Academia e responsabilidade pelos dados",
    "O gestor administra equipe, matrículas, turmas e financeiro da sua academia. Deve ter autorização e base apropriada para cadastrar e compartilhar dados, especialmente de menores, manter os registros corretos e atender solicitações dos titulares. A mesma conta pode administrar mais de uma academia; os dados e assinaturas são separados.",
  ],
  [
    "Planos e teste gratuito",
    "Cada nova academia seleciona um plano antes de começar: Essencial até 200 alunos ativos por R$ 150/mês; Profissional até 999 por R$ 250/mês; Grande academia por R$ 450/mês. Há 5 dias gratuitos contados da criação. O plano escolhido é o compromisso mínimo; se os alunos ativos não arquivados ultrapassarem a faixa, o enquadramento sobe automaticamente antes da próxima emissão. Não há cobrança retroativa nem alteração de links já emitidos. Redução abaixo do plano escolhido não altera o compromisso automaticamente.",
  ],
  [
    "Pagamento e acesso",
    "O gestor inicia o pagamento mensal por Pix ou cartão no checkout InfinitePay; não há débito automático. Se pagar durante o teste, o mês contratado começa após o término dos 5 dias. Encerrado o teste sem pagamento confirmado, novas operações ficam restritas, mas consultas e regularização continuam acessíveis. Assinaturas já pagas mantêm suas regras de vencimento e tolerância informadas na área Minha assinatura.",
  ],
  [
    "Pagamentos de alunos",
    "As mensalidades dos alunos são distintas da assinatura TatameMix. O recebedor é a conta conectada pela academia. Tarifas, meios disponíveis e processamento dependem do provedor. Abrir um checkout ou retornar ao portal não comprova pagamento: é necessária confirmação do provedor.",
  ],
  [
    "Encerramento, suporte e condições legais",
    "O gestor pode encerrar a renovação em Minha assinatura. O acesso pago permanece até o fim do período; links bancários já emitidos podem continuar disponíveis. Pedidos de cancelamento, reembolso ou exercício de direitos legais são analisados pelo canal de atendimento, preservados os direitos previstos na legislação, inclusive de arrependimento quando aplicáveis. Não há promessa de disponibilidade ininterrupta nem de recursos que ainda não foram disponibilizados.",
  ],
];
