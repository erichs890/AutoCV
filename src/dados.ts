import type { Plataforma, StatusVaga } from './types.ts';

// Catálogo fixo do produto. InHire e Indeed têm adapter no núcleo; as outras ficam "Indisponível" até alguém
// escrever o adapter (ver agentlog.md §5). `site` e `nota` ficam reservados aqui para quando chegar a vez delas.
export const PLATAFORMAS: Plataforma[] = [
  {
    id: 'inhire',
    nome: 'InHire',
    sigla: 'ih',
    cor: 'bg-purple',
    disponivel: true,
    site: 'https://inhire.app',
    nota: 'Sem login: cada empresa publica em <empresa>.inhire.app/vagas e a API pública devolve vaga e formulário.',
  },

  // ─── Brasil, generalistas ───────────────────────────────────────────────
  {
    id: 'linkedin',
    nome: 'LinkedIn',
    sigla: 'in',
    cor: 'bg-blue-deep',
    disponivel: false,
    site: 'https://www.linkedin.com/jobs',
    nota: 'Exige sessão logada; candidatura simples ("Candidatura simplificada") é o caminho viável.',
  },
  {
    id: 'gupy',
    nome: 'Gupy',
    sigla: 'gu',
    cor: 'bg-blue-dark',
    disponivel: false,
    site: 'https://portal.gupy.io',
    nota: 'Conta única do candidato reaproveitada em todas as empresas; formulário longo com perguntas eliminatórias.',
  },
  { id: 'catho', nome: 'Catho', sigla: 'ca', cor: 'bg-orange-deep', disponivel: false, site: 'https://www.catho.com.br', nota: 'Assinatura paga para se candidatar.' },
  { id: 'infojobs', nome: 'InfoJobs', sigla: 'ij', cor: 'bg-blue-dark', disponivel: false, site: 'https://www.infojobs.com.br' },
  { id: 'vagas', nome: 'Vagas.com', sigla: 'vg', cor: 'bg-green-deep', disponivel: false, site: 'https://www.vagas.com.br' },
  {
    id: 'indeed',
    nome: 'Indeed',
    sigla: 'id',
    cor: 'bg-side-top',
    disponivel: true,
    site: 'https://br.indeed.com',
    nota: 'Exige login manual uma vez; a sessão fica no perfil do navegador do robô.',
  },
  { id: 'glassdoor', nome: 'Glassdoor', sigla: 'gd', cor: 'bg-green-deep', disponivel: false, site: 'https://www.glassdoor.com.br' },
  { id: 'trampos', nome: 'Trampos.co', sigla: 'tr', cor: 'bg-orange-deep', disponivel: false, site: 'https://trampos.co' },

  // ─── Reservadas em 20/09/2026 (lista do Erich): remoto e internacional ──
  // Ainda sem adapter. Ficam registradas para não se perderem e para a pesquisa de viabilidade começar daqui.
  {
    id: 'remoteok',
    nome: 'RemoteOK',
    sigla: 'ro',
    cor: 'bg-green-deep',
    disponivel: false,
    site: 'https://remoteok.com',
    nota: 'Vagas 100% remotas, em inglês. Tem feed público em JSON (remoteok.com/api) — provável caminho mais curto depois do InHire.',
  },
  {
    id: 'remotive',
    nome: 'Remotive',
    sigla: 'rv',
    cor: 'bg-blue-deep',
    disponivel: false,
    site: 'https://remotive.com',
    nota: 'Vagas remotas em inglês, com API pública de listagem. A candidatura em si sai do site (link externo da empresa).',
  },
  {
    id: 'wellfound',
    nome: 'Wellfound',
    sigla: 'wf',
    cor: 'bg-side-top',
    disponivel: false,
    site: 'https://wellfound.com',
    nota: 'Ex-AngelList Talent: startups, exige conta e perfil preenchido; a candidatura usa o perfil, não um PDF avulso.',
  },
  {
    id: 'workingnomads',
    nome: 'Working Nomads',
    sigla: 'wn',
    cor: 'bg-aqua',
    disponivel: false,
    site: 'https://www.workingnomads.com/jobs',
    nota: 'Curadoria de vagas remotas por e-mail/site; a maioria redireciona para o formulário da empresa.',
  },
  {
    id: 'jsremotely',
    nome: 'JS Remotely',
    sigla: 'js',
    cor: 'bg-amber',
    disponivel: false,
    site: 'https://jsremotely.com',
    nota: 'Nicho JavaScript remoto; volume pequeno, quase sempre redireciona para a empresa.',
  },
  { id: 'powertofly', nome: 'PowerToFly', sigla: 'pf', cor: 'bg-purple', disponivel: false, site: 'https://powertofly.com', nota: 'Foco em diversidade; exige conta e perfil completo.' },
  {
    id: 'flexjobs',
    nome: 'FlexJobs',
    sigla: 'fj',
    cor: 'bg-blue-dark',
    disponivel: false,
    site: 'https://www.flexjobs.com',
    nota: 'Assinatura paga para ver e se candidatar — automatizar depende de ter conta ativa.',
  },
  {
    id: 'toptal',
    nome: 'Toptal',
    sigla: 'tt',
    cor: 'bg-blue-deep',
    disponivel: false,
    site: 'https://www.toptal.com',
    nota: 'Não é mural de vagas: é um processo seletivo próprio (triagem, testes, entrevistas). Não dá para automatizar candidatura.',
  },
  {
    id: 'jobhunt',
    nome: 'Job Hunt',
    sigla: 'jh',
    cor: 'bg-ink-soft',
    disponivel: false,
    site: 'https://www.job-hunt.org',
    nota: 'Portal de conteúdo e orientação de carreira, não um mural com formulário de candidatura.',
  },
  {
    id: 'kickresume',
    nome: 'Kickresume',
    sigla: 'kr',
    cor: 'bg-orange-deep',
    disponivel: false,
    site: 'https://www.kickresume.com',
    nota: 'Ferramenta de montar currículo, não plataforma de candidatura. Só faria sentido como fonte de modelo de CV.',
  },
];

export const getPlataforma = (id: string): Plataforma => PLATAFORMAS.find(p => p.id === id) ?? PLATAFORMAS[0];

// ─── Modelos de IA ───────────────────────────────────────────────────────────
// Preços em dólares por 1 milhão de tokens, conferidos nas tabelas oficiais em 20/09/2026
// (ai.google.dev/gemini-api/docs/pricing e a referência da API da Anthropic). São a ordem de grandeza para
// comparar as opções, não uma cobrança: quem cobra é o provedor, com a sua própria chave.
export interface ModeloIA {
  id: string;
  situacao: 'recomendado' | 'estavel' | 'preview';
  entrada: number; // US$ por 1M tokens de entrada
  saida: number; // US$ por 1M tokens de saída
  nota: string;
}

export const MODELOS_IA: Record<'gemini' | 'anthropic', ModeloIA[]> = {
  gemini: [
    { id: 'gemini-3.8-flash', situacao: 'recomendado', entrada: 0.75, saida: 3.75, nota: 'O mais recente e capaz da linha Flash. Preço promocional até 31/12/2026 (depois dobra).' },
    { id: 'gemini-3.5-flash', situacao: 'estavel', entrada: 1.5, saida: 9, nota: 'Geração anterior; hoje custa mais que o 3.8 e rende menos.' },
    { id: 'gemini-3.5-flash-lite', situacao: 'estavel', entrada: 0.3, saida: 2.5, nota: 'Barato e rápido, para adaptar muitos currículos gastando pouco.' },
    { id: 'gemini-3.1-flash-lite', situacao: 'estavel', entrada: 0.25, saida: 1.5, nota: 'O mais barato da lista. Menos capaz em textos longos.' },
    { id: 'gemini-3.1-pro-preview', situacao: 'preview', entrada: 2, saida: 12, nota: 'O mais caro e o mais capaz do Gemini. Em preview: pode mudar ou sair do ar sem aviso.' },
    { id: 'gemini-2.5-flash', situacao: 'estavel', entrada: 0.3, saida: 2.5, nota: 'Geração antiga, ainda em pé e barata.' },
    { id: 'gemini-2.5-pro', situacao: 'estavel', entrada: 1.25, saida: 10, nota: 'Pro da geração antiga; caro para o que entrega hoje.' },
  ],
  anthropic: [
    { id: 'claude-opus-5', situacao: 'recomendado', entrada: 5, saida: 25, nota: 'O mais capaz do Claude — melhor para respeitar a regra de não inventar nada.' },
    { id: 'claude-sonnet-5', situacao: 'estavel', entrada: 2, saida: 10, nota: 'Equilíbrio entre custo e qualidade.' },
    { id: 'claude-haiku-4-5', situacao: 'estavel', entrada: 1, saida: 5, nota: 'O mais barato do Claude, para volume.' },
  ],
};

export const SITUACAO_MODELO: Record<ModeloIA['situacao'], { rotulo: string; classe: string }> = {
  recomendado: { rotulo: 'Recomendado', classe: 'bg-green-deep text-white' },
  estavel: { rotulo: 'Estável', classe: 'border border-panel-border bg-page-bg text-ink-soft' },
  preview: { rotulo: 'Preview', classe: 'bg-amber text-ink' },
};

/** Faixa de custo relativa ao resto da lista do provedor, pelo preço de saída (que é o que pesa na adaptação). */
export function faixaDeCusto(modelo: ModeloIA, lista: ModeloIA[]): { rotulo: string; classe: string } {
  const precos = [...lista.map(m => m.saida)].sort((a, b) => a - b);
  const posicao = precos.indexOf(modelo.saida) / Math.max(1, precos.length - 1);
  if (posicao <= 0.33) return { rotulo: 'Mais barato', classe: 'text-green-deep' };
  if (posicao <= 0.66) return { rotulo: 'Custo médio', classe: 'text-ink-soft' };
  return { rotulo: 'Mais caro', classe: 'text-orange-deep' };
}

export const precoPorMilhao = (v: number) => `US$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * A pergunta é sobre ESTA empresa/vaga e não faz sentido reaproveitar em outra?
 *
 * "Quais são as suas impressões sobre as nossas produções?" (Brasil Paralelo) respondida com "excelente" e
 * guardada para "perguntas parecidas" viraria a mesma resposta na vaga de outra empresa — sem sentido, e o
 * recrutador percebe. Nesses casos a caixa "guardar" nasce desmarcada; o usuário ainda pode marcar.
 */
export function perguntaSoDestaVaga(rotulo: string, empresa = ''): boolean {
  const limpar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const r = limpar(rotulo);
  // Fala da empresa como "nós": nossas produções, nosso produto, trabalhar conosco
  if (/\bnoss[ao]s?\b|\bconosco\b|\bda nossa\b|\bdaqui\b/.test(r)) return true;
  // Fala desta vaga em particular
  if (/\b(esta|essa|nesta|nessa)\s+(vaga|posicao|oportunidade|empresa)\b/.test(r)) return true;
  // Motivação/conhecimento sobre a empresa
  if (/por que (voce )?(quer|gostaria|deseja|escolheu|se interessou)/.test(r)) return true;
  if (/o que voce (sabe|conhece|pensa|acha)/.test(r)) return true;
  if (/\b(ja )?conhece\b/.test(r) && !/\b(ingles|espanhol|ferramenta|tecnologia|metodologia)\b/.test(r)) return true;
  // O nome da empresa aparece na pergunta
  const marcas = limpar(empresa)
    .replace(/\b(ltda|sa|s\/a|tecnologia|consultoria|solucoes|group|brasil|inc|me|eireli)\b/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 4);
  return marcas.some(t => r.includes(t));
}

export const NIVEIS = ['Estágio', 'Júnior', 'Pleno', 'Sênior', 'Liderança'];
export const AREAS = ['Tecnologia da Informação', 'Dados e Analytics', 'Suporte e Infraestrutura', 'Comercial e Vendas', 'Financeiro e Contábil', 'Recursos Humanos', 'Marketing', 'Administrativo'];
export const REGIMES = [
  ['remoto', 'Remoto'],
  ['hibrido', 'Híbrido'],
  ['presencial', 'Presencial'],
];

export const STATUS_VAGA: Record<StatusVaga, { rotulo: string; classe: string }> = {
  encontrada: { rotulo: 'Encontrada', classe: 'border border-panel-border bg-page-bg text-ink' },
  na_fila: { rotulo: 'Na fila', classe: 'bg-blue-dark text-white' },
  em_andamento: { rotulo: 'Em andamento', classe: 'bg-blue-deep text-white' },
  aguardando_pergunta: { rotulo: 'Aguardando resposta', classe: 'bg-amber text-ink' },
  aguardando_aprovacao: { rotulo: 'Aguardando aprovação', classe: 'bg-amber text-ink' },
  enviada: { rotulo: 'Enviada', classe: 'bg-green-deep text-white' },
  ensaio: { rotulo: 'Ensaio', classe: 'bg-purple text-white' },
  erro: { rotulo: 'Erro', classe: 'bg-orange-deep text-white' },
  ignorada: { rotulo: 'Baixa compatibilidade', classe: 'border border-panel-border bg-page-bg text-ink-soft' },
  encerrada: { rotulo: 'Encerrada', classe: 'border border-panel-border bg-page-bg text-ink-soft line-through' },
};

export const tempoAtras = (iso: string | null) => {
  if (!iso) return 'nunca';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
};

export const MODELO = { remoto: 'Remoto', hibrido: 'Híbrido', presencial: 'Presencial', indefinido: 'Modelo não informado' } as const;
export const REGIME_VAGA = { CLT: 'CLT', PJ: 'PJ', ambos: 'CLT ou PJ', indefinido: 'Regime não informado' } as const;

export const NOTIFICACOES = [
  { id: 'cada-envio', titulo: 'Notificar por e-mail a cada envio', descricao: 'Você recebe um e-mail sempre que o robô envia um currículo.', padrao: true },
  { id: 'resposta', titulo: 'Notificar quando houver resposta de empresa', descricao: 'Avisos de entrevistas e mensagens das plataformas.', padrao: true },
  { id: 'resumo', titulo: 'Resumo semanal por e-mail', descricao: 'Toda segunda-feira, com estatísticas da semana.', padrao: true },
  { id: 'erro-conexao', titulo: 'Alertas de erro de conexão', descricao: 'Quando uma plataforma desconectar ou expirar a sessão.', padrao: false },
  { id: 'novidades', titulo: 'Novidades e dicas do AutoCV', descricao: 'Novidades do produto e dicas de currículo.', padrao: false },
];

export const LIMITE_MB = 5;
export const EXTENSOES = /\.(pdf|docx)$/i;

export function validarCurriculo(arquivo: File): string {
  if (!EXTENSOES.test(arquivo.name)) return 'O currículo precisa ser um arquivo PDF ou DOCX.';
  if (arquivo.size > LIMITE_MB * 1024 * 1024) return `O arquivo passa de ${LIMITE_MB} MB.`;
  return '';
}

export const formatarTamanho = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export const iniciais = (nome: string) =>
  nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('') || '?';

export const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Aceita "empresa", "empresa.inhire.app" ou a URL completa da página de vagas. */
export function extrairTenant(entrada: string): string {
  const s = entrada.trim().toLowerCase();
  const m = s.match(/([a-z0-9-]+)\.inhire\.app/);
  return (m ? m[1] : s.replace(/^https?:\/\//, '').split(/[/?#.]/)[0]).replace(/[^a-z0-9-]/g, '');
}
