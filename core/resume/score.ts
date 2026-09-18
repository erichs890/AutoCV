import type { PerfilBusca, Vaga } from '../../src/types.ts';
import { normalizar, palavras } from './texto.ts';

/**
 * Compatibilidade 0–100 entre a vaga e o currículo, só com o que existe de fato nos dois:
 * 70% = skills da vaga que o currículo também tem; 30% = palavras do título da vaga presentes nos cargos do currículo.
 */
export function calcularScore(vaga: Pick<Vaga, 'titulo' | 'skills' | 'descricao'>, perfil: PerfilBusca): number {
  const skillsCv = new Set(perfil.skills);
  const comuns = vaga.skills.filter(s => skillsCv.has(s));
  const parteSkills = vaga.skills.length ? comuns.length / vaga.skills.length : 0;

  const titulo = new Set(palavras(vaga.titulo).filter(p => p.length > 2));
  const cargos = new Set(perfil.cargos.flatMap(c => palavras(c)).filter(p => p.length > 2));
  const comunsTitulo = [...titulo].filter(p => cargos.has(p));
  const parteTitulo = titulo.size ? comunsTitulo.length / titulo.size : 0;

  // Vaga que cita a área do currículo ganha um empurrão pequeno
  const areaNaVaga = perfil.area !== 'Não identificada' && normalizar(vaga.descricao).includes(normalizar(perfil.area.split(' ')[0]));

  return Math.min(100, Math.round(70 * parteSkills + 30 * parteTitulo + (areaNaVaga ? 5 : 0)));
}
