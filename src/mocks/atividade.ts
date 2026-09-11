import type { Periodo, PontoAtividade } from '../types';

const series: Record<Periodo, PontoAtividade[]> = {
  semana: [
    { rotulo: 'Seg', valor: 62 },
    { rotulo: 'Ter', valor: 88 },
    { rotulo: 'Qua', valor: 54 },
    { rotulo: 'Qui', valor: 120 },
    { rotulo: 'Sex', valor: 96 },
    { rotulo: 'Sáb', valor: 38 },
    { rotulo: 'Dom', valor: 22 },
  ],
  mes: [
    { rotulo: 'Sem 1', valor: 312 },
    { rotulo: 'Sem 2', valor: 405 },
    { rotulo: 'Sem 3', valor: 356 },
    { rotulo: 'Sem 4', valor: 441 },
  ],
  ano: [
    { rotulo: 'Jan', valor: 820 },
    { rotulo: 'Fev', valor: 910 },
    { rotulo: 'Mar', valor: 1040 },
    { rotulo: 'Abr', valor: 980 },
    { rotulo: 'Mai', valor: 1120 },
    { rotulo: 'Jun', valor: 1210 },
    { rotulo: 'Jul', valor: 1085 },
    { rotulo: 'Ago', valor: 1302 },
    { rotulo: 'Set', valor: 480 },
  ],
};

export function getAtividade(periodo: Periodo): PontoAtividade[] {
  return series[periodo];
}

export function getStats() {
  return [
    { id: 'enviados', valor: 328, unidade: '', label: 'Currículos enviados', labelCurto: 'Currículos enviados', delta: 12, sufixo: '% essa semana' },
    { id: 'compativeis', valor: 1247, unidade: '', label: 'Vagas compatíveis', labelCurto: 'Vagas compatíveis', delta: 8, sufixo: '% essa semana' },
    { id: 'respostas', valor: 24, unidade: '', label: 'Respostas recebidas', labelCurto: 'Respostas', delta: 3, sufixo: ' entrevistas' },
    { id: 'compatibilidade', valor: 78, unidade: '%', label: 'Compatibilidade média', labelCurto: 'Compatibilidade', delta: -2, sufixo: '% essa semana' },
  ];
}
