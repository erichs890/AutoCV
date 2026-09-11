export type StatusEnvio = 'Enviado' | 'Visualizado' | 'Pendente' | 'Erro';
export type EstadoRobo = 'ativo' | 'pausado' | 'erro';
export type EstadoPlataforma = 'conectada' | 'erro' | 'disponivel';
export type Periodo = 'semana' | 'mes' | 'ano';

export interface Plataforma {
  id: string;
  nome: string;
  sigla: string;
  cor: string; // classe Tailwind de fundo do logo
  estado: EstadoPlataforma;
  vagasSemana: number;
  sync: string;
}

export interface Envio {
  id: number;
  vaga: string;
  empresa: string;
  plataforma: string; // Plataforma.id
  data: string;
  hora: string;
  status: StatusEnvio;
}

export interface ItemFila {
  id: number;
  cargo: string;
  empresa: string;
  plataforma: string;
  horario: string;
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
