import type { Plataforma } from '../types';

const plataformas: Plataforma[] = [
  { id: 'linkedin', nome: 'LinkedIn', sigla: 'in', cor: 'bg-blue-deep', estado: 'conectada', vagasSemana: 134, sync: 'há 2 horas' },
  { id: 'catho', nome: 'Catho', sigla: 'ca', cor: 'bg-orange-deep', estado: 'conectada', vagasSemana: 86, sync: 'há 40 minutos' },
  { id: 'gupy', nome: 'Gupy', sigla: 'gu', cor: 'bg-purple', estado: 'conectada', vagasSemana: 52, sync: 'há 5 horas' },
  { id: 'infojobs', nome: 'InfoJobs', sigla: 'ij', cor: 'bg-blue-dark', estado: 'erro', vagasSemana: 0, sync: 'ontem 19:12' },
  { id: 'vagas', nome: 'Vagas.com', sigla: 'vg', cor: 'bg-green-deep', estado: 'disponivel', vagasSemana: 0, sync: '' },
  { id: 'indeed', nome: 'Indeed', sigla: 'id', cor: 'bg-side-top', estado: 'disponivel', vagasSemana: 0, sync: '' },
  { id: 'glassdoor', nome: 'Glassdoor', sigla: 'gd', cor: 'bg-green-deep', estado: 'disponivel', vagasSemana: 0, sync: '' },
  { id: 'trampos', nome: 'Trampos.co', sigla: 'tr', cor: 'bg-orange-deep', estado: 'disponivel', vagasSemana: 0, sync: '' },
];

export const emBreve = ['Empregos.com.br', 'Solides', 'Kenoby', 'Workana'];

export function getPlataformas(): Plataforma[] {
  return plataformas;
}

export function getPlataforma(id: string): Plataforma {
  return plataformas.find(p => p.id === id) ?? plataformas[0];
}
