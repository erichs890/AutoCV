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

const CARGO = /\b(desenvolvedor[a]?|developer|programador[a]?|engenheir[oa]|analista|assistente|auxiliar|estagi[áa]ri[oa]|t[ée]cnic[oa]|coordenador[a]?|gerente|supervisor[a]?|consultor[a]?|especialista|designer|cientista|administrador[a]?|arquitet[oa]|suporte|qa|tester|scrum master|product owner|vendedor[a]?|recepcionista|operador[a]?)\b[^\n,.;|(]{0,40}/gi;

/** Monta o perfil de busca (área, cargos, skills, senioridade) a partir do currículo em Markdown. */
export function analisarCurriculo(markdown: string): PerfilBusca {
  const skills = extrairSkills(markdown);
  const n = normalizar(markdown);

  let area = 'Não identificada';
  let melhor = 0;
  for (const [nome, chaves] of AREAS) {
    const pontos = chaves.filter(k => skills.includes(k)).length;
    if (pontos > melhor) {
      melhor = pontos;
      area = nome;
    }
  }

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
