import type { ItemFila, LinhaLog } from '../types';

const fila: ItemFila[] = [
  { id: 1, cargo: 'Desenvolvedor Backend Jr', empresa: 'Nuvemtec', plataforma: 'LinkedIn', horario: '14:38' },
  { id: 2, cargo: 'Analista de Suporte N2', empresa: 'Bitmarco', plataforma: 'Catho', horario: '14:53' },
  { id: 3, cargo: 'Dev Front-end Pleno', empresa: 'Codelab BR', plataforma: 'Gupy', horario: '15:08' },
  { id: 4, cargo: 'QA Automation Jr', empresa: 'Órion Sistemas', plataforma: 'LinkedIn', horario: '15:23' },
  { id: 5, cargo: 'Analista de Dados Jr', empresa: 'Datafiel', plataforma: 'Catho', horario: '15:38' },
  { id: 6, cargo: 'Estágio em TI', empresa: 'Sinapse Tech', plataforma: 'Gupy', horario: '15:53' },
  { id: 7, cargo: 'DevOps Júnior', empresa: 'Nuvemtec', plataforma: 'LinkedIn', horario: '16:08' },
  { id: 8, cargo: 'Suporte Técnico Pleno', empresa: 'Bitmarco', plataforma: 'Catho', horario: '16:23' },
];

// Mais recente no topo
const log: LinhaLog[] = [
  { hora: '14:32:04', msg: 'Formulário preenchido automaticamente (7 campos).', tipo: 'info' },
  { hora: '14:32:01', msg: "Vaga 'Analista de Sistemas Jr' enviada para LinkedIn com sucesso.", tipo: 'sucesso' },
  { hora: '14:17:22', msg: "Vaga 'Dev Front-end Pleno' enviada para Gupy com sucesso.", tipo: 'sucesso' },
  { hora: '14:02:10', msg: 'Aguardando intervalo de 15 minutos...', tipo: 'aguardo' },
  { hora: '13:47:55', msg: 'Falha ao enviar para InfoJobs: sessão expirada.', tipo: 'erro' },
  { hora: '13:47:52', msg: 'Tentando reconectar à plataforma InfoJobs...', tipo: 'alerta' },
  { hora: '13:32:31', msg: "Vaga 'Estágio em TI' enviada para Vagas.com com sucesso.", tipo: 'sucesso' },
];

export function getFila(): ItemFila[] {
  return fila;
}

export function getResumoFila() {
  return { naFila: 18, hoje: 6, comErro: 2 };
}

export function getLog(): LinhaLog[] {
  return log;
}
