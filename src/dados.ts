import type { Plataforma, StatusVaga } from './types';

// Catálogo fixo do produto. InHire e Indeed têm adapter no núcleo; as outras ficam "Indisponível".
export const PLATAFORMAS: Plataforma[] = [
  { id: 'inhire', nome: 'InHire', sigla: 'ih', cor: 'bg-purple', disponivel: true },
  { id: 'linkedin', nome: 'LinkedIn', sigla: 'in', cor: 'bg-blue-deep', disponivel: false },
  { id: 'gupy', nome: 'Gupy', sigla: 'gu', cor: 'bg-blue-dark', disponivel: false },
  { id: 'catho', nome: 'Catho', sigla: 'ca', cor: 'bg-orange-deep', disponivel: false },
  { id: 'infojobs', nome: 'InfoJobs', sigla: 'ij', cor: 'bg-blue-dark', disponivel: false },
  { id: 'vagas', nome: 'Vagas.com', sigla: 'vg', cor: 'bg-green-deep', disponivel: false },
  { id: 'indeed', nome: 'Indeed', sigla: 'id', cor: 'bg-side-top', disponivel: true },
  { id: 'glassdoor', nome: 'Glassdoor', sigla: 'gd', cor: 'bg-green-deep', disponivel: false },
  { id: 'trampos', nome: 'Trampos.co', sigla: 'tr', cor: 'bg-orange-deep', disponivel: false },
];

export const getPlataforma = (id: string): Plataforma => PLATAFORMAS.find(p => p.id === id) ?? PLATAFORMAS[0];

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
