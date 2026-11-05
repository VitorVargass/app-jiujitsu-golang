import { useState } from "react";
import { Link } from "expo-router";
import Head from "expo-router/head";
import { Brand } from "../../components/Brand";
import { Icon, IconName } from "../../components/Icon";
import { brandMarkPaths } from "../../theme/mark";
import { landingStyles } from "./landing-styles";

const features: {
  icon: IconName;
  title: string;
  description: string;
  number: string;
}[] = [
  {
    icon: "users",
    title: "Cada aluno. Cada evolução.",
    description:
      "Matrículas, graduações, responsáveis e histórico reunidos. Conheça quem está com você dentro e fora do tatame.",
    number: "01",
  },
  {
    icon: "wallet",
    title: "Financeiro sem adivinhação.",
    description:
      "Acompanhe mensalidades e recebimentos. Ofereça Pix ou cartão com a conexão InfinitePay da sua academia.",
    number: "02",
  },
  {
    icon: "qr",
    title: "Chegou. Registrou. Treinou.",
    description:
      "Check-in por código ou QR no tablet, com horários vinculados às turmas e histórico de presenças para consultar.",
    number: "03",
  },
  {
    icon: "calendar",
    title: "Uma rotina que faz sentido.",
    description:
      "Organize modalidades, turmas e horários. Sua equipe e seus alunos acessam o que precisam, cada um no seu perfil.",
    number: "04",
  },
];
const plans = [
  {
    name: "Essencial",
    range: "Até 200 alunos ativos",
    price: 150,
    note: "O próximo passo para a sua academia.",
  },
  {
    name: "Profissional",
    range: "De 201 a 999 alunos ativos",
    price: 250,
    note: "Sua operação crescendo. Tudo no lugar.",
  },
  {
    name: "Grande academia",
    range: "A partir de 1.000 alunos ativos",
    price: 450,
    note: "Mais alunos. A mesma clareza na gestão.",
  },
];
const questions = [
  [
    "Preciso instalar alguma coisa?",
    "Para usar no computador, basta acessar pelo navegador. O aluno também pode acessar seu portal pelo celular. O tablet de check-in é configurado pela própria academia.",
  ],
  [
    "Como funciona a cobrança do TatameMix?",
    "Você escolhe um plano ao criar cada academia e testa grátis por 5 dias. Depois, o gestor inicia o pagamento mensal por Pix ou cartão, sem débito automático. O plano escolhido é o mínimo; ultrapassar sua faixa de alunos ativos não arquivados aumenta o enquadramento antes da próxima emissão. Links já emitidos preservam seu valor.",
  ],
  [
    "Tenho duas academias. Como funciona?",
    "Você pode alternar entre as academias na mesma conta. Cada academia mantém seus alunos, acessos, dados financeiros e assinatura separados.",
  ],
  [
    "Os pagamentos dos alunos vão para quem?",
    "Para a conta InfinitePay conectada pela sua academia. A mensalidade do software é uma cobrança separada. A disponibilidade dos meios de pagamento e eventuais tarifas dependem do provedor.",
  ],
  [
    "Posso usar uma catraca?",
    "A integração com catracas ainda não está disponível. Hoje o TatameMix registra check-in por código ou QR no tablet, conforme a configuração das turmas.",
  ],
];

function Action({
  children,
  secondary = false,
}: {
  children: React.ReactNode;
  secondary?: boolean;
}) {
  return (
    <Link
      className={`tm-button ${secondary ? "tm-button-secondary" : ""}`}
      href={secondary ? "/login" : "/register"}
    >
      {children}
      <Icon name="arrow-right" size={17} color="currentColor" />
    </Link>
  );
}

function ProductPreview() {
  const [tab, setTab] = useState<"overview" | "students" | "finance">(
    "overview",
  );
  return (
    <div
      className="tm-product"
      id="produto"
      aria-label="Prévia ilustrativa do TatameMix, com dados de demonstração"
    >
      <div className="tm-window">
        <span />
        <span />
        <span />
        <p>tatamemix / academia</p>
        <span className="tm-demo">DEMONSTRAÇÃO</span>
      </div>
      <div className="tm-product-body">
        <aside className="tm-preview-nav">
          <Brand compact />
          <p>SEU ESPAÇO DE GESTÃO</p>
          {(
            [
              ["overview", "Visão geral", "home"],
              ["students", "Alunos", "users"],
              ["finance", "Financeiro", "wallet"],
            ] as const
          ).map(([key, title, icon]) => (
            <button
              key={key}
              type="button"
              aria-pressed={tab === key}
              className={tab === key ? "active" : ""}
              onClick={() => setTab(key)}
            >
              <Icon name={icon} size={17} color="currentColor" />
              {title}
            </button>
          ))}
          <div className="tm-preview-stamp">
            TM<span>Academia demonstração</span>
          </div>
        </aside>
        <div className="tm-preview-main">
          <div className="tm-preview-heading">
            <div>
              <small>ACADEMIA DEMONSTRAÇÃO</small>
              <h3>
                {tab === "overview"
                  ? "Sua academia, em movimento."
                  : tab === "students"
                    ? "Gente que faz parte."
                    : "Clareza em cada recebimento."}
              </h3>
            </div>
            <span className="tm-avatar">TM</span>
          </div>
          <div className="tm-preview-metrics">
            {[
              ["Alunos ativos", "128", "users"],
              ["Recebido no mês", "R$ 12.450", "wallet"],
              ["Presenças hoje", "42", "check-circle"],
            ].map(([label, value, icon]) => (
              <div key={label}>
                <span>
                  {label}
                  <Icon name={icon as IconName} size={15} />
                </span>
                <strong>{value}</strong>
                <small>Dados ilustrativos</small>
              </div>
            ))}
          </div>
          {tab === "overview" ? (
            <div className="tm-preview-grid">
              <div className="tm-chart">
                <div className="tm-mini-heading">
                  <b>Presenças na semana</b>
                  <span>Últimos 7 dias</span>
                </div>
                <div className="tm-bars">
                  {[45, 72, 58, 93, 78, 36, 16].map((height, i) => (
                    <div key={i}>
                      <div style={{ height: `${height}%` }} />
                      <small>{["S", "T", "Q", "Q", "S", "S", "D"][i]}</small>
                    </div>
                  ))}
                </div>
              </div>
              <div className="tm-next-class">
                <span className="tm-live">NA AGENDA</span>
                <h4>
                  Hora de ir
                  <br />
                  para o tatame.
                </h4>
                <p>19:00 · Jiu-Jitsu</p>
                <span>Turma adulto · Demonstração</span>
                <div>
                  <Icon name="qr" size={22} />
                  <span>Check-in por código ou QR</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="tm-preview-table">
              <div className="tm-mini-heading">
                <b>
                  {tab === "students"
                    ? "Alunos da academia"
                    : "Mensalidades do mês"}
                </b>
                <span>Exemplo de visualização</span>
              </div>
              {["Marina Alves", "Rafael Costa", "Lucas Ferreira"].map(
                (name, i) => (
                  <div className="tm-demo-row" key={name}>
                    <span className="tm-demo-initial">
                      {name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                    <div>
                      <b>{name}</b>
                      <small>
                        {tab === "students"
                          ? ["Faixa branca", "Faixa azul", "Faixa roxa"][i]
                          : "Mensalidade · Demonstração"}
                      </small>
                    </div>
                    <span
                      className={
                        i === 2 && tab === "finance" ? "tm-open" : "tm-status"
                      }
                    >
                      {tab === "students"
                        ? "Ativo"
                        : i === 2
                          ? "Em aberto"
                          : "Pago"}
                    </span>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LandingScreen() {
  return (
    <div className="tm-marketing">
      <Head>
        <title>TatameMix — Menos gestão. Mais tatame.</title>
        <meta
          name="description"
          content="Gestão de academias de artes marciais: alunos, turmas, presenças e mensalidades em um só lugar. Conheça o TatameMix e os planos a partir de R$ 150 por mês."
        />
        <meta
          property="og:title"
          content="TatameMix — Menos gestão. Mais tatame."
        />
        <meta
          property="og:description"
          content="Sua academia organizada. Seu foco no tatame. Conheça os recursos e planos do TatameMix."
        />
      </Head>
      <style>{landingStyles}</style>
      <a className="tm-skip" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="tm-header">
        <Link href="/" aria-label="TatameMix, início">
          <Brand />
        </Link>
        <nav aria-label="Navegação principal">
          <a href="#recursos">O sistema</a>
          <a href="#planos">Planos</a>
          <a href="#duvidas">Dúvidas</a>
        </nav>
        <Link href="/login" className="tm-login">
          Entrar no sistema <Icon name="arrow-right" size={17} />
        </Link>
      </header>
      <main id="conteudo">
        <section className="tm-hero">
          <div className="tm-hero-grid" aria-hidden="true" />
          <svg className="tm-hero-mark" viewBox="0 0 64 64" aria-hidden="true">
            <path d={brandMarkPaths.light} />
            <path d={brandMarkPaths.accent} />
          </svg>
          <div className="tm-container tm-hero-content">
            <span className="tm-eyebrow">
              <i /> FEITO PARA QUEM VIVE O TATAME
            </span>
            <h1>
              Menos gestão.
              <br />
              <em>Mais tatame.</em>
            </h1>
            <div className="tm-hero-bottom">
              <div>
                <p>
                  Você cuida da evolução dos seus alunos.
                  <br className="tm-desktop-break" /> A gente ajuda a organizar
                  todo o resto.
                </p>
                <div className="tm-actions">
                  <Action>Começar minha academia</Action>
                  <a className="tm-text-link" href="#produto">
                    Conhecer o sistema <span>↘</span>
                  </a>
                </div>
                <small>Alunos, turmas, presenças e mensalidades. Juntos.</small>
              </div>
              <div className="tm-hero-note">
                <span>01 / FOCO NO QUE IMPORTA</span>
                <p>
                  A disciplina do tatame.
                  <br />
                  Agora, na sua gestão.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section
          className="tm-showcase tm-container"
          aria-label="Conheça o produto"
        >
          <ProductPreview />
          <div className="tm-preview-caption">
            <span>O VISUAL DO SEU PRÓXIMO PASSO</span>
            <p>
              Uma prévia do produto com dados ilustrativos. Explore as abas
              acima.
            </p>
          </div>
        </section>
        <div className="tm-disciplines">
          <span>DA PRIMEIRA AULA À PRÓXIMA FAIXA.</span>
          <p>
            JIU-JITSU <i /> MUAY THAI <i /> BOXE <i /> MMA <i /> ARTES MARCIAIS
          </p>
        </div>
        <section className="tm-section tm-container" id="recursos">
          <div className="tm-section-title">
            <div>
              <span className="tm-eyebrow">SUA OPERAÇÃO, CONECTADA</span>
              <h2>
                A academia inteira.
                <br />
                Um só lugar.
              </h2>
            </div>
            <p>
              Mais clareza para decidir.
              <br />
              Menos tarefas espalhadas pelo caminho.
            </p>
          </div>
          <div className="tm-feature-grid">
            {features.map((f) => (
              <article className="tm-feature" key={f.number}>
                <div>
                  <span className="tm-feature-icon">
                    <Icon name={f.icon} size={25} color="#FF6975" />
                  </span>
                  <span className="tm-number">{f.number}</span>
                </div>
                <h3>{f.title}</h3>
                <p>{f.description}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="tm-routine">
          <div className="tm-container tm-routine-grid">
            <div>
              <span className="tm-eyebrow">
                NO COMPUTADOR. NO CELULAR. NO TATAME.
              </span>
              <h2>
                Cada pessoa.
                <br />
                Seu próprio espaço.
              </h2>
              <p>
                Uma gestão conectada, com acessos organizados por academia e
                perfil.
              </p>
              <Link href="/register" className="tm-text-link">
                Organizar minha academia <span>↗</span>
              </Link>
            </div>
            <div className="tm-roles">
              {[
                [
                  "01",
                  "Para quem gere",
                  "Alunos, financeiro, turmas e equipe. Uma visão organizada para conduzir sua academia.",
                ],
                [
                  "02",
                  "Para quem treina",
                  "Mensalidades, presenças e identificação. O aluno acompanha sua rotina no próprio portal.",
                ],
                [
                  "03",
                  "Para quem chega",
                  "Check-in no tablet com código ou QR, vinculado aos horários das turmas.",
                ],
              ].map(([n, title, body]) => (
                <article key={n}>
                  <span>{n}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                  <Icon name="arrow-right" color="#FF6975" size={20} />
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="tm-section tm-container" id="planos">
          <div className="tm-section-title">
            <div>
              <span className="tm-eyebrow">SEU TAMANHO. SEU MOMENTO.</span>
              <h2>Cresça no seu ritmo.</h2>
            </div>
            <p>
              Todos os recursos em todos os planos.
              <br />A faixa acompanha seus alunos ativos.
            </p>
          </div>
          <div className="tm-plan-grid">
            {plans.map((p, i) => (
              <article
                className={`tm-plan ${i === 1 ? "tm-plan-featured" : ""}`}
                key={p.name}
              >
                {i === 1 && (
                  <span className="tm-plan-tag">
                    PARA ACADEMIAS EM EXPANSÃO
                  </span>
                )}
                <span className="tm-eyebrow">
                  PLANO {String(i + 1).padStart(2, "0")}
                </span>
                <h3>{p.name}</h3>
                <p>{p.range}</p>
                <div className="tm-price">
                  <span>R$</span> {p.price}
                  <small>/mês</small>
                </div>
                <p className="tm-plan-note">{p.note}</p>
                <Action>Começar agora</Action>
                <ul>
                  {[
                    "Gestão de alunos e turmas",
                    "Mensalidades e recebimentos",
                    "Presenças e graduações",
                    "Portal do aluno",
                    "Acesso para a equipe",
                  ].map((item) => (
                    <li key={item}>
                      <Icon name="check-circle" size={16} color="#FF6975" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <p className="tm-pricing-note">
            Assinatura por academia. Contam apenas alunos ativos e não
            arquivados. Teste grátis de 5 dias por nova academia. O plano
            escolhido é o mínimo contratado; ultrapassar a faixa aumenta o
            próximo enquadramento. Pagamento mensal iniciado pelo gestor, sem
            débito automático. Tarifas de processamento de pagamentos são
            definidas pelo provedor e não estão incluídas na assinatura.
          </p>
        </section>
        <section className="tm-section tm-container tm-faq" id="duvidas">
          <div>
            <span className="tm-eyebrow">SEM COMPLICAÇÃO</span>
            <h2>
              Antes de entrar
              <br />
              no tatame.
            </h2>
            <p>
              O que você precisa saber
              <br />
              para dar o próximo passo.
            </p>
          </div>
          <div>
            {questions.map(([title, body]) => (
              <details key={title}>
                <summary>
                  {title}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{body}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="tm-container tm-final">
          <div>
            <span className="tm-eyebrow">GESTÃO COM A SUA IDENTIDADE</span>
            <h2>
              Sua próxima evolução
              <br />
              começa fora do tatame.
            </h2>
            <p>Coloque a rotina em ordem. Volte para o que move você.</p>
          </div>
          <Action>Começar minha academia</Action>
        </section>
      </main>
      <footer className="tm-container tm-footer">
        <div>
          <Brand compact />
          <p>Menos gestão. Mais tatame.</p>
        </div>
        <div>
          <a href="#recursos">O sistema</a>
          <a href="#planos">Planos</a>
          <Link href="/login">Entrar no sistema</Link>
          <Link href="/privacy">Privacidade</Link>
          <Link href="/terms">Termos de Uso</Link>
        </div>
        <small>© {new Date().getFullYear()} TatameMix</small>
      </footer>
    </div>
  );
}
