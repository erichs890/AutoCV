import type { PerfilBusca, Vaga } from '../../src/types.ts';
import { SOFT, similaridade } from './texto.ts';
import { vagaCompativelComLocalizacao } from '../localizacao.ts';
import type { PreferenciasLocalizacao } from '../../src/paises.ts';
import { inferirArea, inferirSenioridade, NIVEIS, type Nivel } from './analyzer.ts';

export interface FiltrosScore {
  area?: string; // área escolhida na Automação (sobrepõe a do currículo)
  cargo?: string; // cargo escolhido na Automação (entra junto com os do currículo)
  senioridade?: string; // senioridade escolhida na Automação (sobrepõe a do currículo)
  localizacao?: PreferenciasLocalizacao; // cidade (presencial/híbrida) e países (remota) que a pessoa aceita
}

// Leitura de cidade/UF/país e a regra de compatibilidade moram em core/localizacao.ts (todas as plataformas usam)
export { lerLocal } from '../localizacao.ts';

/**
 * Compatibilidade léxica 0–100, só com o que existe de fato nos dois lados:
 *  - 60% competências: técnicas pesam 85%, comportamentais 15% (toda vaga pede "comunicação")
 *  - 40% cargo: similaridade entre o título da vaga e os cargos do currículo (ou o cargo configurado)
 *  - área diferente da do currículo corta o resultado pela metade; área igual dá um empurrão
 *  - vaga um nível acima da senioridade do candidato perde 30%; dois ou mais níveis acima, 65%
 *  - localização (core/localizacao.ts): presencial/híbrida em outra cidade do estado perde 40%, em outro estado/país zera;
 *    remota restrita a um país que a pessoa não escolheu zera
 * Com IA configurada, a busca substitui isto pela avaliação do modelo (core/ia.ts → avaliarVagas).
 */
export function calcularScore(vaga: Pick<Vaga, 'titulo' | 'skills' | 'descricao'> & Partial<Pick<Vaga, 'modelo' | 'local' | 'pais'>>, perfil: PerfilBusca, filtros: FiltrosScore = {}): { score: number; motivo: string } {
  const cv = new Set(perfil.skills);
  const tecnicas = vaga.skills.filter(s => !SOFT.has(s));
  const soft = vaga.skills.filter(s => SOFT.has(s));
  const temTec = tecnicas.filter(s => cv.has(s));
  const temSoft = soft.filter(s => cv.has(s));
  const pTec = tecnicas.length ? temTec.length / tecnicas.length : 0;
  const pSoft = soft.length ? temSoft.length / soft.length : 0;
  const parteSkills = tecnicas.length ? 0.85 * pTec + 0.15 * pSoft : 0.3 * pSoft;

  const cargos = [...perfil.cargos, filtros.cargo ?? ''].filter(c => c.trim());
  const parteTitulo = cargos.length ? Math.max(...cargos.map(c => similaridade(c, vaga.titulo))) : 0;

  const areaVaga = inferirArea(vaga.skills, `${vaga.titulo}\n${vaga.descricao.slice(0, 800)}`);
  const areaCv = filtros.area?.trim() || perfil.area;
  const areaConhecida = areaVaga !== 'Não identificada' && areaCv !== 'Não identificada';
  const fatorArea = !areaConhecida ? 1 : areaVaga === areaCv ? 1.1 : 0.45;

  const nivelVaga = inferirSenioridade(vaga.titulo, vaga.descricao);
  const nivelCv = filtros.senioridade?.trim() || perfil.senioridade;
  const degraus = NIVEIS.indexOf(nivelVaga as Nivel) - NIVEIS.indexOf(nivelCv as Nivel);
  const senioridadeConhecida = nivelVaga !== 'Indefinida' && NIVEIS.includes(nivelCv as Nivel);
  const fatorSenioridade = !senioridadeConhecida ? 1 : degraus >= 2 ? 0.35 : degraus === 1 ? 0.7 : 1;

  const local = filtros.localizacao ? vagaCompativelComLocalizacao(vaga, filtros.localizacao) : { fator: 1, motivo: null };

  const score = Math.max(0, Math.min(100, Math.round((60 * parteSkills + 40 * parteTitulo) * fatorArea * fatorSenioridade * local.fator)));
  const motivo = [
    tecnicas.length ? `${temTec.length}/${tecnicas.length} competências técnicas` : 'vaga sem competência técnica reconhecida',
    parteTitulo >= 0.5 ? 'cargo parecido' : 'cargo diferente',
    areaConhecida ? (areaVaga === areaCv ? `mesma área (${areaVaga})` : `área diferente (${areaVaga})`) : null,
    senioridadeConhecida ? (degraus > 0 ? `pede ${nivelVaga}, acima do seu nível (${nivelCv})` : `senioridade ok (${nivelVaga})`) : null,
    local.motivo,
  ]
    .filter(Boolean)
    .join(' · ');
  return { score, motivo };
}
