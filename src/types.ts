// Tipos compartilhados entre o front (src/) e o núcleo (core/)

export type StatusEnvio = 'Enviado' | 'Visualizado' | 'Pendente' | 'Erro';
export type EstadoRobo = 'ativo' | 'pausado' | 'erro';

export interface Plataforma {
  id: string;
  nome: string;
  sigla: string;
  cor: string; // classe Tailwind de fundo do logo
  disponivel: boolean; // só o InHire por enquanto
}

export interface Envio {
  id: number;
  vaga: string;
  empresa: string;
  plataforma: string; // Plataforma.id
  data: string; // DD/MM
  hora: string; // HH:MM
  status: StatusEnvio;
}

export interface PontoAtividade {
  rotulo: string;
  valor: number;
}

export interface LinhaLog {
  hora: string;
  msg: string;
  tipo: 'sucesso' | 'info' | 'aguardo' | 'erro' | 'alerta';
}

export interface Pergunta {
  id: number;
  icone: string;
  pergunta: string;
  resposta: string;
  personalizada: boolean;
}

// ─── Currículo ───────────────────────────────────────────────
export interface PerfilBusca {
  area: string;
  cargos: string[];
  skills: string[];
  senioridade: string;
}

export interface Arquivo {
  id: number;
  nome: string;
  tamanho: number;
  enviadoEm: string; // ISO
  caminho?: string; // no disco (núcleo)
  markdown?: string; // texto extraído do PDF
  perfilBusca?: PerfilBusca;
}

// ─── Usuário ─────────────────────────────────────────────────
export interface Perfil {
  nome: string;
  email: string;
  telefone: string;
  cargo?: string;
  cidade?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  endereco?: string;
  cpf?: string;
  nascimento?: string;
  disponibilidade?: string;
  pcd?: string;
  escolaridade?: string;
  idiomas?: string;
  pretensao?: string;
}

export interface Conexao {
  conectadaEm: string; // ISO
  usuario?: string;
}

export interface ConfigAutomacao {
  configurada: boolean;
  plataformas: string[];
  curriculo: number | null;
  area: string;
  cargo: string;
  local: string;
  salarioMin: number;
  salarioMax: number;
  regimes: string[]; // remoto | hibrido | presencial
  intervalo: number; // minutos entre candidaturas
  limiteDiario: number;
  janela: string; // "08:00-20:00"
  modo: 'automatico' | 'manual';
  adaptar: boolean; // adaptar o currículo por vaga
  preview: 'mostrar' | 'direto';
  regimePreferido: 'CLT' | 'PJ' | 'perguntar'; // quando a vaga aceita os dois
  ensaio: boolean; // preenche tudo, não envia
  mostrarNavegador: boolean;
  scoreMinimo: number; // 0–100
  tenants: string[]; // empresas do InHire (slug de <slug>.inhire.app)
}

// ─── IA (adaptação de currículo) ─────────────────────────────
export type ProvedorIA = 'nenhum' | 'gemini' | 'anthropic';
export interface ConfigIA {
  provedor: ProvedorIA;
  modelo: string;
  chaveDefinida: boolean; // a chave em si nunca sai do núcleo
  chaveFinal: string; // últimos 4 caracteres, para reconhecer
}

// ─── Vagas e candidaturas ────────────────────────────────────
export type StatusVaga = 'encontrada' | 'na_fila' | 'em_andamento' | 'aguardando_pergunta' | 'aguardando_aprovacao' | 'enviada' | 'ensaio' | 'erro' | 'ignorada';
export type Regime = 'CLT' | 'PJ' | 'ambos' | 'indefinido';

export interface PerguntaExtra {
  rotulo: string;
  tipo: 'texto' | 'opcoes' | 'arquivo';
  opcoes?: string[];
}

export type Pendencia =
  | { tipo: 'pergunta'; pergunta: PerguntaExtra }
  | { tipo: 'aprovacao'; original: string; adaptado: string; diff: string[] };

export interface Vaga {
  id: string;
  plataforma: string;
  tenant: string;
  titulo: string;
  empresa: string;
  descricao: string;
  requisitos: string;
  regime: Regime;
  modelo: 'remoto' | 'hibrido' | 'presencial' | 'indefinido';
  local: string;
  url: string;
  skills: string[];
  camposConhecidos: string[];
  score: number;
  status: StatusVaga;
  posicao?: number;
  pendencia?: Pendencia;
  erro?: string;
  captura?: string; // captura de tela (ensaio/erro)
  decisaoPreview?: 'adaptado' | 'original';
  respostaTemporaria?: string; // rótulo da pergunta cuja resposta não deve ser guardada
  encontradaEm: string;
  atualizadaEm: string;
}

export interface Candidatura {
  id: number;
  vagaId: string;
  titulo: string;
  empresa: string;
  plataforma: string;
  url: string;
  enviadaEm: string;
  nome: string;
  email: string;
  celular: string;
  curriculo: string; // caminho do PDF enviado
  versao: 'original' | 'adaptada';
  regime: string;
  resultado: 'enviada' | 'ensaio';
}

// ─── Estado completo (o que o núcleo entrega ao front) ──────
export interface Estado {
  perfil: Perfil | null;
  curriculos: Arquivo[]; // o primeiro é o principal
  conexoes: Record<string, Conexao>;
  automacao: ConfigAutomacao;
  ia: ConfigIA;
  robo: EstadoRobo;
  envios: Envio[];
  candidaturas: Candidatura[];
  vagas: Vaga[];
  fila: Vaga[];
  log: LinhaLog[];
  perguntas: Pergunta[];
  notificacoes: Record<string, boolean>;
  proximoEnvioEm: string | null;
  ultimaBusca: string | null;
}
