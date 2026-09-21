import type { PerfilBusca } from '../../src/types.ts';
import { extrairSkills, normalizar } from './texto.ts';

const AREAS: [string, string[]][] = [
  [
    'Tecnologia da Informação',
    ['javascript', 'typescript', 'python', 'java', 'c#', 'react', 'angular', 'vue', 'node.js', 'spring', 'docker', 'aws', 'sql', 'git', 'rest', 'html', 'css', 'php', 'kotlin', 'swift', 'dart'],
  ],
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

const CARGO =
  /\b(desenvolvedor[a]?|developer|programador[a]?|engenheir[oa]|analista|assistente|auxiliar|estagi[áa]ri[oa]|t[ée]cnic[oa]|coordenador[a]?|gerente|supervisor[a]?|consultor[a]?|especialista|designer|cientista|administrador[a]?|arquitet[oa]|suporte|qa|tester|scrum master|product owner|vendedor[a]?|recepcionista|operador[a]?)\b[^\n,.;|(]{0,40}/gi;

/**
 * Família de cargo: a FUNÇÃO exercida, não as palavras do título.
 *
 * Comparar títulos por similaridade de caracteres não distingue profissão: o cargo "Desenvolvedor Full Stack
 * há mais de 3 anos" dá 0,42 de similaridade com "Analista de Processos" só pelos bigramas de "a", " de ", "os"
 * — e uma vaga de BPM/RPA passava como "cargo parecido". A família resolve isso no nível certo: quem é de
 * desenvolvimento reconhece "Engenheiro de Software" como sua função e "Analista de Processos" como outra.
 * A ordem importa: o mais específico vem antes ("analista de dados" antes de qualquer regra genérica).
 */
export const FAMILIAS_CARGO: [string, RegExp][] = [
  [
    'IA e Machine Learning',
    /\b(intelig[êe]ncia artificial|engenheir[oa] de (ia|ai)|\b(ia|ai)\s+engineer|machine learning|\bml\b|deep learning|\bllm|\bnlp\b|vis[ãa]o computacional|mlops|data scientist)/i,
  ],
  ['Dados e Analytics', /\b(cientista de dados|analista de dados|engenheir[oa] de dados|data (scientist|engineer|analyst)|business intelligence|bi\b|analytics|machine learning|\betl\b)/i],
  ['Qualidade e Testes', /\b(qa\b|quality assurance|analista de testes?|tester|automa[çc][ãa]o de testes?)/i],
  ['Processos e Negócio', /\b(analista de processos|processos de neg[óo]cio|bpm\b|rpa\b|melhoria cont[íi]nua|analista de neg[óo]cios?|business analyst)/i],
  ['Projetos e Agilidade', /\b(gerente de projetos|scrum master|agilista|pmo\b|coordenador[a]? de projetos)/i],
  ['Produto', /\b(product (owner|manager|designer)|gerente de produto|\bpo\b)/i],
  ['Design', /\b(designer|\bux\b|\bui\b|experi[êe]ncia do usu[áa]rio|motion|dire[çc][ãa]o de arte)/i],
  [
    'Desenvolvimento',
    /\b(desenvolvedor[a]?|developer|programador[a]?|engenheir[oa] de software|software engineer|full ?stack|back-?end|front-?end|web ?developer|mobile|devops|sre\b|arquitet[oa] de software|tech ?lead|techleader)/i,
  ],
  ['Suporte e Infraestrutura', /\b(suporte t[ée]cnico|analista de suporte|help ?desk|service desk|infraestrutura|redes|analista de infra)/i],
  ['Segurança da Informação', /\b(seguran[çc]a da informa[çc][ãa]o|cyber|pentest|soc\b|appsec)/i],
  [
    'Financeiro e Contábil',
    /\b(financeir|cont[áa]bil|contador|fiscal|tribut|tesouraria|controladoria|risco de (liquidez|cr[ée]dito)|fundos de investimento|precifica[çc][ãa]o|concilia[çc][ãa]o|middle office|administra[çc][ãa]o fiduci[áa]ria)/i,
  ],
  ['Jurídico', /\b(advogad|jur[íi]dic|contencioso|compliance|societ[áa]rio)/i],
  ['Recursos Humanos', /\b(recursos humanos|\brh\b|recrutamento|recruiter|departamento pessoal|people|talent)/i],
  ['Comercial e Vendas', /\b(vendas|vendedor[a]?|comercial|\bsdr\b|closer|account (manager|executive)|representante|trainee comercial)/i],
  ['Marketing', /\b(marketing|growth|social media|conte[úu]do|\bseo\b|\bgeo\b)/i],
  ['Administrativo', /\b(administrativ|recepcion|secret[áa]ri|auxiliar administrativo|departamento pessoal)/i],
];

/**
 * Famílias que são vizinhas de porta: quem programa reconhece QA, IA e dados como o mesmo mundo, e uma vaga
 * dessas é tão relevante quanto uma de desenvolvimento puro. Sem isto, o filtro rígido (só a família exata)
 * descartaria "Engenheiro de IA" ou "QA Automation" para quem é Full Stack — o oposto do que se quer.
 * Família fora do grupo é que é outra profissão.
 */
export const AFINIDADE: string[][] = [
  ['Desenvolvimento', 'IA e Machine Learning', 'Qualidade e Testes', 'Dados e Analytics', 'Segurança da Informação'],
  ['Produto', 'Design', 'Projetos e Agilidade', 'Processos e Negócio'],
  ['Financeiro e Contábil', 'Jurídico', 'Administrativo'],
  ['Comercial e Vendas', 'Marketing'],
];

/** Mesma família ou famílias do mesmo grupo de afinidade. */
export function familiasAfins(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return AFINIDADE.some(grupo => grupo.includes(a) && grupo.includes(b));
}

/** Família do cargo/título, ou null quando não dá para dizer (aí o score cai na similaridade de texto). */
export function familiaDoCargo(texto: string): string | null {
  return FAMILIAS_CARGO.find(([, re]) => re.test(texto))?.[0] ?? null;
}

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

/**
 * Anos de carreira citados no currículo. Precisa ser tolerante à escrita real: "há mais de 3 anos",
 * "3+ anos de experiência", "atuo há 5 anos", "experiência de 4 anos". Só conta quando o trecho fala de
 * carreira — "3 anos de faculdade" ou "contrato de 2 anos" não entram.
 */
export function anosDeCarreira(markdown: string): number {
  const n = normalizar(markdown);
  const padroes = [
    /(\d{1,2})\s*\+?\s*anos?\s+(?:de\s+)?(?:experi|atua|carreira|mercado|desenvolv|trabalh|vivencia)/g,
    /h[a]\s+(?:mais de\s+|quase\s+|cerca de\s+)?(\d{1,2})\s*\+?\s*anos?/g,
    /(?:experiencia|atuando|atuo|trabalho|trabalhando)\s+(?:de\s+|por\s+|h[a]\s+)?(?:mais de\s+)?(\d{1,2})\s*\+?\s*anos?/g,
  ];
  const anos = padroes.flatMap(re => [...n.matchAll(re)].map(m => +m[1])).filter(a => a >= 1 && a <= 40);
  return Math.max(0, ...anos);
}

/**
 * Senioridade DO CANDIDATO a partir do currículo. Não pode reaproveitar `inferirSenioridade` (que é para vaga):
 * lá, citar vários níveis significa o MAIS BAIXO ("Pleno/Sênior" = Pleno); aqui, um currículo cita justamente os
 * cargos antigos, e o nível do candidato é o mais ALTO que ele alcançou.
 *
 * Caso real (20/09/2026): currículo com "Full Stack há mais de 3 anos" e "TechLeader", mas também "Estagiário
 * líder", era classificado como Estágio — e vaga de estagiário passava a pontuar como compatível.
 * "Estágio" só vale quando NÃO há nenhum outro sinal de experiência.
 */
export function inferirSenioridadeDoCurriculo(markdown: string): Nivel {
  const n = normalizar(markdown);
  const anos = anosDeCarreira(markdown);
  const porAnos: Nivel | null = anos >= 6 ? 'Sênior' : anos >= 3 ? 'Pleno' : anos >= 1 ? 'Júnior' : null;
  const explicito: Nivel | null = /\b(senior|sr)\b/.test(n) ? 'Sênior' : /\bpleno\b/.test(n) ? 'Pleno' : /\b(junior|jr)\b/.test(n) ? 'Júnior' : null;

  // Vale o mais alto entre os sinais; sem nenhum, "estagiário/estudante" decide, senão Júnior
  const candidatos: Nivel[] = [porAnos, explicito].filter(x => x !== null);
  if (candidatos.length) return candidatos.reduce((a, b) => (NIVEIS.indexOf(a) >= NIVEIS.indexOf(b) ? a : b));
  return /\b(estagi|estudante|trainee|aprendiz)/.test(n) ? 'Estágio' : 'Júnior';
}

/** Monta o perfil de busca (área, cargos, skills, senioridade) a partir do currículo em Markdown. */
export function analisarCurriculo(markdown: string): PerfilBusca {
  const skills = extrairSkills(markdown);
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

  const senioridade = inferirSenioridadeDoCurriculo(markdown);

  return { area, cargos, skills, senioridade };
}
