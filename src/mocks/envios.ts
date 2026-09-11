import type { Envio } from '../types';

const envios: Envio[] = [
  { id: 1, vaga: 'Desenvolvedor Backend Jr', empresa: 'Nuvemtec', plataforma: 'linkedin', data: '06/09', hora: '14:22', status: 'Visualizado' },
  { id: 2, vaga: 'Analista de Suporte N2', empresa: 'Bitmarco', plataforma: 'catho', data: '06/09', hora: '14:07', status: 'Enviado' },
  { id: 3, vaga: 'Dev Front-end Pleno', empresa: 'Codelab BR', plataforma: 'gupy', data: '06/09', hora: '13:52', status: 'Enviado' },
  { id: 4, vaga: 'Analista de Dados Jr', empresa: 'Datafiel', plataforma: 'infojobs', data: '06/09', hora: '13:37', status: 'Erro' },
  { id: 5, vaga: 'Estágio em TI', empresa: 'Sinapse Tech', plataforma: 'vagas', data: '06/09', hora: '13:22', status: 'Enviado' },
  { id: 6, vaga: 'QA Automation Jr', empresa: 'Nuvemtec', plataforma: 'linkedin', data: '06/09', hora: '13:07', status: 'Pendente' },
  { id: 7, vaga: 'Analista de Sistemas Jr', empresa: 'Órion Sistemas', plataforma: 'indeed', data: '06/09', hora: '12:52', status: 'Visualizado' },
];

export const TOTAL_ENVIOS = 328;
export const POR_PAGINA = envios.length;

// ponytail: o mock devolve a mesma página para qualquer número; a API pagina de verdade
export function getEnvios(_pagina: number): Envio[] {
  return envios;
}
