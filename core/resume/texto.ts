// Utilidades de texto usadas por análise, score e adaptação (sem IA: só dicionário e comparação).

export const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Palavras com 2+ caracteres; mantém "node.js"/"c#"/"c++", descarta pontuação final
export const palavras = (s: string) => (normalizar(s).match(/[a-z0-9+#]+(?:\.[a-z0-9]+)*/g) ?? []).filter(p => p.length >= 2);

// Dicionário de competências (técnicas e comportamentais). Chave = forma canônica; valores = variações.
export const SKILLS: Record<string, string[]> = {
  javascript: ['javascript', 'js'], typescript: ['typescript', 'ts'], python: ['python'], java: ['java'], 'c#': ['c#', 'csharp', '.net', 'dotnet'], 'c++': ['c++'], go: ['golang', 'go'], php: ['php'], ruby: ['ruby', 'rails'], kotlin: ['kotlin'], swift: ['swift'], dart: ['dart', 'flutter'],
  react: ['react', 'reactjs', 'react.js'], angular: ['angular'], vue: ['vue', 'vuejs'], 'next.js': ['next.js', 'nextjs'], 'node.js': ['node', 'nodejs', 'node.js'], spring: ['spring', 'spring boot'], django: ['django'], flask: ['flask'], laravel: ['laravel'], 'react native': ['react native'],
  html: ['html', 'html5'], css: ['css', 'css3', 'tailwind', 'sass'], sql: ['sql'], mysql: ['mysql'], postgresql: ['postgresql', 'postgres'], 'sql server': ['sql server', 'mssql'], oracle: ['oracle'], mongodb: ['mongodb', 'mongo'], redis: ['redis'], nosql: ['nosql'],
  docker: ['docker'], kubernetes: ['kubernetes', 'k8s'], aws: ['aws', 'amazon web services'], azure: ['azure'], gcp: ['gcp', 'google cloud'], linux: ['linux'], git: ['git', 'github', 'gitlab'], 'ci/cd': ['ci/cd', 'ci cd', 'jenkins', 'github actions'], terraform: ['terraform'],
  rest: ['rest', 'restful', 'api rest', 'apis'], graphql: ['graphql'], microsserviços: ['microsservicos', 'microservices', 'microsserviços'], testes: ['testes', 'tdd', 'jest', 'junit', 'cypress', 'selenium', 'playwright', 'qa'], scrum: ['scrum', 'agil', 'ágil', 'agile', 'kanban'],
  'power bi': ['power bi', 'powerbi'], excel: ['excel', 'planilhas'], 'pacote office': ['pacote office', 'office', 'word'], sap: ['sap'], protheus: ['protheus', 'totvs'], erp: ['erp'], crm: ['crm', 'salesforce', 'hubspot'], tableau: ['tableau'], 'machine learning': ['machine learning', 'ml'], 'data science': ['data science', 'ciencia de dados', 'ciência de dados'], pandas: ['pandas'], etl: ['etl'], 'big data': ['big data', 'spark', 'hadoop'],
  'suporte técnico': ['suporte tecnico', 'suporte técnico', 'help desk', 'helpdesk', 'service desk'], redes: ['redes', 'tcp/ip', 'cisco'], 'active directory': ['active directory', 'ad'], windows: ['windows'], itil: ['itil'],
  vendas: ['vendas', 'comercial', 'prospeccao', 'prospecção'], negociação: ['negociacao', 'negociação'], atendimento: ['atendimento', 'atendimento ao cliente'], 'gestão de pessoas': ['gestao de pessoas', 'gestão de pessoas', 'lideranca', 'liderança'], marketing: ['marketing', 'marketing digital'], 'redes sociais': ['redes sociais', 'social media'], financeiro: ['financeiro', 'contas a pagar', 'contas a receber'], contabilidade: ['contabilidade', 'contabil', 'contábil'], fiscal: ['fiscal', 'tributario', 'tributário', 'pis', 'cofins', 'irpj', 'csll'], 'recursos humanos': ['recursos humanos', 'rh', 'recrutamento', 'departamento pessoal'], logística: ['logistica', 'logística', 'estoque'], administrativo: ['administrativo', 'rotinas administrativas'],
  inglês: ['ingles', 'inglês', 'english'], espanhol: ['espanhol', 'spanish'], comunicação: ['comunicacao', 'comunicação'], 'trabalho em equipe': ['trabalho em equipe', 'equipe'], proatividade: ['proatividade', 'proativo', 'proativa'], organização: ['organizacao', 'organização'], 'resolução de problemas': ['resolucao de problemas', 'resolução de problemas'], 'atenção aos detalhes': ['atencao aos detalhes', 'atenção aos detalhes', 'analitico', 'analítico'],
};

// Competências comportamentais/genéricas: aparecem em quase toda vaga e quase todo currículo, então pesam pouco no score
export const SOFT = new Set(['comunicação', 'trabalho em equipe', 'proatividade', 'organização', 'resolução de problemas', 'atenção aos detalhes', 'inglês', 'espanhol', 'pacote office']);

const variantesNormalizadas = Object.entries(SKILLS).map(([canonica, vs]) => [canonica, vs.map(normalizar)] as const);

// Retorna as skills do dicionário presentes no texto (forma canônica), sem repetição
export function extrairSkills(texto: string): string[] {
  const t = ' ' + normalizar(texto).replace(/[^a-z0-9+#./ ]+/g, ' ').replace(/\s+/g, ' ') + ' ';
  const achadas: string[] = [];
  for (const [canonica, variantes] of variantesNormalizadas) {
    if (variantes.some(v => t.includes(` ${v} `) || t.includes(` ${v},`) || t.includes(` ${v}.`) || t.includes(` ${v}/`) || t.includes(`/${v} `))) achadas.push(canonica);
  }
  return achadas;
}

// Similaridade de Dice sobre bigramas de caracteres (0..1) — boa para "perguntas parecidas"
export function similaridade(a: string, b: string): number {
  const bigramas = (s: string) => {
    const n = normalizar(s).replace(/[^a-z0-9]+/g, ' ').trim();
    const out = new Map<string, number>();
    for (let i = 0; i < n.length - 1; i++) out.set(n.slice(i, i + 2), (out.get(n.slice(i, i + 2)) ?? 0) + 1);
    return out;
  };
  const A = bigramas(a);
  const B = bigramas(b);
  let inter = 0;
  for (const [k, v] of A) inter += Math.min(v, B.get(k) ?? 0);
  const somaA = [...A.values()].reduce((s, v) => s + v, 0);
  const somaB = [...B.values()].reduce((s, v) => s + v, 0);
  if (!somaA || !somaB) return 0;
  const dice = (2 * inter) / (somaA + somaB);
  const contido = inter / Math.min(somaA, somaB); // "Possui CNH?" dentro de "Você possui CNH categoria B?"
  return Math.max(dice, contido * 0.85);
}
