import type { PerfilBusca, Vaga } from '../../src/types.ts';
import { SOFT, normalizar, similaridade } from './texto.ts';
import { inferirArea, inferirSenioridade, NIVEIS, type Nivel } from './analyzer.ts';

export interface FiltrosScore {
  area?: string; // área escolhida na Automação (sobrepõe a do currículo)
  cargo?: string; // cargo escolhido na Automação (entra junto com os do currículo)
  senioridade?: string; // senioridade escolhida na Automação (sobrepõe a do currículo)
  local?: string; // cidade/UF do candidato: só pesa em vaga presencial
}

const UFS = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
const PAIS = new Set(['br', 'brasil', 'brazil']);
const ESTADOS: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE', 'distrito federal': 'DF', 'espirito santo': 'ES', goias: 'GO', maranhao: 'MA',
  'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG', para: 'PA', paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI', 'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO', roraima: 'RR', 'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
};

/** "Campinas - SP", "São Paulo/SP", "Belo Horizonte, Minas Gerais" → { cidade, uf }; o que não der para ler fica vazio. */
export function lerLocal(texto: string): { cidade: string; uf: string } {
  const partes = texto.split(/\s*[-,/|]\s*/).map(p => p.trim()).filter(Boolean);
  const ufExplicita = partes.map(p => p.toUpperCase()).find(p => UFS.has(p)) ?? '';
  const candidatos = partes.map(normalizar).filter(p => !UFS.has(p.toUpperCase()) && !PAIS.has(p)); // o InHire manda "Cidade, UF, BR"
  // Com UF explícita, a primeira parte é a cidade mesmo que tenha nome de estado ("São Paulo, SP");
  // sem UF, "Minas Gerais" sozinho é estado e "São Paulo" sozinho é a cidade (que também resolve o estado)
  const ambigua = candidatos.length === 1 && (candidatos[0] === 'sao paulo' || candidatos[0] === 'rio de janeiro');
  const cidade = ufExplicita || ambigua ? candidatos[0] ?? '' : candidatos.find(p => !ESTADOS[p]) ?? '';
  const uf = ufExplicita || ESTADOS[candidatos.find(p => ESTADOS[p]) ?? ''] || '';
  return { cidade, uf };
}

/** 1 = mesma cidade ou sem dados; 0,6 = mesmo estado; 0,2 = outro estado. */
export function fatorLocal(vagaLocal: string, meuLocal: string): { fator: number; motivo: string | null } {
  const v = lerLocal(vagaLocal);
  const m = lerLocal(meuLocal);
  if (!v.cidade && !v.uf) return { fator: 1, motivo: null };
  if (!m.cidade && !m.uf) return { fator: 1, motivo: 'presencial; preencha sua cidade em Configurações' };
  if (v.cidade && v.cidade === m.cidade) return { fator: 1, motivo: `presencial na sua cidade` };
  if (v.uf && v.uf === m.uf) return { fator: v.cidade && m.cidade ? 0.6 : 1, motivo: v.cidade && m.cidade ? `presencial em ${vagaLocal}, outra cidade do seu estado` : 'presencial no seu estado' };
  if (v.uf && m.uf) return { fator: 0.2, motivo: `presencial em ${vagaLocal}, fora do seu estado` };
  return { fator: 1, motivo: null };
}

/**
 * Compatibilidade léxica 0–100, só com o que existe de fato nos dois lados:
 *  - 60% competências: técnicas pesam 85%, comportamentais 15% (toda vaga pede "comunicação")
 *  - 40% cargo: similaridade entre o título da vaga e os cargos do currículo (ou o cargo configurado)
 *  - área diferente da do currículo corta o resultado pela metade; área igual dá um empurrão
 *  - vaga um nível acima da senioridade do candidato perde 30%; dois ou mais níveis acima, 65%
 *  - vaga PRESENCIAL fora da cidade do candidato: mesmo estado perde 40%, outro estado perde 80% (remoto e híbrido não mudam)
 * Com IA configurada, a busca substitui isto pela avaliação do modelo (core/ia.ts → avaliarVagas).
 */
export function calcularScore(vaga: Pick<Vaga, 'titulo' | 'skills' | 'descricao'> & Partial<Pick<Vaga, 'modelo' | 'local'>>, perfil: PerfilBusca, filtros: FiltrosScore = {}): { score: number; motivo: string } {
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

  const local = vaga.modelo === 'presencial' ? fatorLocal(vaga.local ?? '', filtros.local ?? '') : { fator: 1, motivo: null };

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
