import type { PerfilBusca } from '../../src/types.ts';
import { extrairSkills, normalizar } from './texto.ts';

const AREAS: [string, string[]][] = [
  ['Tecnologia da Informação', ['javascript', 'typescript', 'python', 'java', 'c#', 'react', 'angular', 'vue', 'node.js', 'spring', 'docker', 'aws', 'sql', 'git', 'rest', 'html', 'css', 'php', 'kotlin', 'swift', 'dart']],
  ['Dados e Analytics', ['power bi', 'data science', 'machine learning', 'pandas', 'etl', 'big data', 'tableau']],
  ['Suporte e Infraestrutura', ['suporte técnico', 'redes', 'active directory', 'windows', 'linux', 'itil']],
  ['Comercial e Vendas', ['vendas', 'negociação', 'crm', 'atendimento']],
  ['Financeiro e Contábil', ['financeiro', 'contabilidade', 'fiscal', 'excel', 'sap', 'protheus', 'erp']],
  ['Recursos Humanos', ['recursos humanos']],
  ['Marketing', ['marketing', 'redes sociais']],
  ['Administrativo', ['administrativo', 'pacote office', 'logística']],
];

// Palavras de título/descrição que denunciam a área quando as skills não bastam
const AREA_POR_TERMO: [string, RegExp][] = [
  ['Tecnologia da Informação', /\b(desenvolvedor|developer|programador|software|back-?end|front-?end|full-?stack|devops|engenheir[oa] de software|dados|ti\b)/i],
  ['Dados e Analytics', /\b(cientista de dados|analista de dados|data|bi\b|analytics)/i],
  ['Suporte e Infraestrutura', /\b(suporte|infraestrutura|help ?desk|service desk|redes)/i],
  ['Comercial e Vendas', /\b(vendas|vendedor|comercial|consultor comercial|sdr|closer|representante)/i],
  ['Financeiro e Contábil', /\b(financeir|cont[aá]bil|contador|fiscal|tribut|tesouraria|controladoria)/i],
  ['Recursos Humanos', /\b(recursos humanos|rh\b|recrutamento|departamento pessoal|people)/i],
  ['Marketing', /\b(marketing|social media|conte[úu]do|growth)/i],
  ['Administrativo', /\b(administrativ|recepcion|assistente|auxiliar|secret[aá]ri)/i],
];

/** Área mais provável a partir das skills (dicionário) e, se empatar ou faltar, do texto (título/descrição). */
export function inferirArea(skills: string[], texto = ''): string {
  let area = 'Não identificada';
  let melhor = 0;
  for (const [nome, chaves] of AREAS) {
    const pontos = chaves.filter(k => skills.includes(k)).length;
    if (pontos > melhor) {
      melhor = pontos;
      area = nome;
    }
  }
  if (melhor <= 1) for (const [nome, re] of AREA_POR_TERMO) if (re.test(texto)) return nome;
  return area;
}

const CARGO = /\b(desenvolvedor[a]?|developer|programador[a]?|engenheir[oa]|analista|assistente|auxiliar|estagi[áa]ri[oa]|t[ée]cnic[oa]|coordenador[a]?|gerente|supervisor[a]?|consultor[a]?|especialista|designer|cientista|administrador[a]?|arquitet[oa]|suporte|qa|tester|scrum master|product owner|vendedor[a]?|recepcionista|operador[a]?)\b[^\n,.;|(]{0,40}/gi;

/** Do mais baixo ao mais alto; 'Indefinida' fica fora da escala. */
export const NIVEIS = ['Estágio', 'Júnior', 'Pleno', 'Sênior', 'Liderança'] as const;
export type Nivel = (typeof NIVEIS)[number];

/**
 * Senioridade que a vaga pede. O título manda ("Analista Fiscal Pleno"); quando ele cita mais de um nível
 * ("Pleno/Sênior") vale o mais baixo. Sem nível no título, tenta "N anos de experiência" na descrição.
 */
export function inferirSenioridade(titulo: string, descricao: string): Nivel | 'Indefinida' {
  const t = normalizar(titulo);
  const noTitulo: Nivel[] = [];
  if (/\b(estagi\w*|trainee|aprendiz)\b/.test(t)) noTitulo.push('Estágio');
  if (/\b(junior|jr|i)\b/.test(t)) noTitulo.push('Júnior');
  if (/\b(pleno|pl|mid|ii)\b/.test(t)) noTitulo.push('Pleno');
  if (/\b(senior|sr|especialista|iii|staff|principal)\b/.test(t)) noTitulo.push('Sênior');
  if (/\b(coordenador\w*|gerente|gestor\w*|supervisor\w*|head|lead|lider|diretor\w*|manager|cto|cfo|ceo)\b/.test(t)) noTitulo.push('Liderança');
  if (noTitulo.length) return NIVEIS.find(n => noTitulo.includes(n))!;
  const anos = [...normalizar(descricao).matchAll(/(\d{1,2})\s*\+?\s*anos? (?:de )?experi/g)].map(m => +m[1]);
  if (!anos.length) return 'Indefinida';
  const min = Math.min(...anos);
  return min >= 5 ? 'Sênior' : min >= 2 ? 'Pleno' : 'Júnior';
}

/** Monta o perfil de busca (área, cargos, skills, senioridade) a partir do currículo em Markdown. */
export function analisarCurriculo(markdown: string): PerfilBusca {
  const skills = extrairSkills(markdown);
  const n = normalizar(markdown);
  const area = inferirArea(skills, markdown.slice(0, 1500));

  const contagem = new Map<string, number>();
  for (const m of markdown.matchAll(CARGO)) {
    const cargo = m[0]
      .replace(/\s+/g, ' ')
      .split(/\s(?:com|em|na|no|para|at|—|–|-)\s/i)[0]
      .replace(/\s+(de|da|do|e)\s*$/i, '')
      .trim();
    if (cargo.length < 4 || cargo.length > 60) continue;
    const chave = normalizar(cargo);
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }
  const cargos = [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([c]) => c.replace(/\b\w/g, ch => ch.toUpperCase()));

  const anos = [...n.matchAll(/(\d{1,2})\s*\+?\s*anos? de experi/g)].map(m => +m[1]);
  const maxAnos = Math.max(0, ...anos);
  const senioridade = /\b(senior|sênior|sr\.?)\b/.test(n) || maxAnos >= 6 ? 'Sênior' : /\bpleno\b/.test(n) || maxAnos >= 3 ? 'Pleno' : /\b(estagi|estágio|estudante)/.test(n) && !/\b(junior|júnior|jr)\b/.test(n) ? 'Estágio' : 'Júnior';

  return { area, cargos, skills, senioridade };
}
