import type { ConfigAutomacao, PerfilBusca, PerguntaExtra, Vaga } from '../../src/types.ts';

export type Log = (tipo: 'sucesso' | 'info' | 'aguardo' | 'erro' | 'alerta', msg: string) => void;

export interface DadosCandidatura {
  nome: string;
  email: string;
  celular: string;
  linkedin: string;
  pretensao: string;
  regime: 'CLT' | 'PJ' | null; // null = a plataforma não pediu ou ficou indefinido
  curriculoPdf: string; // caminho do PDF a anexar (original ou adaptado)
  /** Resposta salva para uma pergunta extra; null = não sabemos, pausar e perguntar ao usuário */
  responder: (pergunta: PerguntaExtra) => string | null;
  ensaio: boolean; // preenche tudo mas não envia
  mostrarNavegador: boolean;
}

export type ResultadoCandidatura =
  | { status: 'enviada' }
  | { status: 'ensaio'; captura: string; pronto: boolean; observacao?: string } // pronto = a plataforma liberou o botão de envio
  | { status: 'pergunta'; pergunta: PerguntaExtra }
  | { status: 'erro'; motivo: string; captura?: string };

// Cada plataforma implementa isto. O núcleo (fila, currículo, confirmação) não sabe nada de InHire.
export interface PlatformAdapter {
  id: string;
  nome: string;
  buscarVagas(perfil: PerfilBusca, cfg: ConfigAutomacao, log: Log): Promise<Vaga[]>;
  candidatar(vaga: Vaga, dados: DadosCandidatura, log: Log): Promise<ResultadoCandidatura>;
}

export const adapters: Record<string, PlatformAdapter> = {};
export const registrarAdapter = (a: PlatformAdapter) => {
  adapters[a.id] = a;
};
