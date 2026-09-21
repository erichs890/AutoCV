import type { Vaga } from '../../src/types.ts';
import { extrairSkills, normalizar, palavras } from './texto.ts';

/**
 * Adaptação do currículo por vaga — REGRA ABSOLUTA: nunca inventar, exagerar ou remover.
 * O que este módulo faz, e só isto:
 *  1. Reordena as experiências (blocos dentro de "Experiência") pondo primeiro as que mais citam skills da vaga.
 *  2. Reordena os itens da seção de habilidades pondo primeiro as que a vaga pede.
 *  3. Acrescenta ao resumo UMA frase de foco, montada só com skills que já estão no currículo E na vaga.
 * Depois, `validarAdaptacao` confere que nenhuma palavra nova (fora de um conjunto fixo de conectivos) entrou.
 */

interface Secao {
  titulo: string; // '' para o cabeçalho antes da primeira seção
  linhas: string[];
}

export function dividirSecoes(md: string): Secao[] {
  const secoes: Secao[] = [{ titulo: '', linhas: [] }];
  for (const linha of md.split('\n')) {
    if (linha.startsWith('## ')) secoes.push({ titulo: linha.slice(3).trim(), linhas: [] });
    else secoes[secoes.length - 1].linhas.push(linha);
  }
  return secoes;
}

const juntar = (secoes: Secao[]) =>
  secoes
    .map(s => (s.titulo ? `## ${s.titulo}\n` : '') + s.linhas.join('\n'))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const eh = (titulo: string, ...chaves: string[]) => chaves.some(k => normalizar(titulo).includes(k));

// Blocos de experiência: começam em linha em negrito ou linha curta seguida de conteúdo
function blocos(linhas: string[]): string[][] {
  const out: string[][] = [];
  for (const l of linhas) {
    const inicio =
      /^\*\*.+\*\*$/.test(l.trim()) || (l.trim().length > 0 && l.trim().length <= 70 && !l.trim().startsWith('-') && out.length > 0 && out[out.length - 1].some(x => x.trim().startsWith('-')));
    if (inicio || out.length === 0) out.push([l]);
    else out[out.length - 1].push(l);
  }
  return out;
}

export interface Adaptacao {
  markdown: string;
  diff: string[]; // linhas legíveis descrevendo o que mudou
  skillsEmComum: string[];
}

export function adaptarCurriculo(original: string, vaga: Pick<Vaga, 'titulo' | 'skills' | 'descricao'>): Adaptacao {
  const skillsCv = new Set(extrairSkills(original));
  const comuns = vaga.skills.filter(s => skillsCv.has(s));
  const diff: string[] = [];
  const secoes = dividirSecoes(original);
  const relevancia = (texto: string) => comuns.filter(s => extrairSkills(texto).includes(s)).length;

  for (const s of secoes) {
    if (eh(s.titulo, 'experi', 'histor', 'experience')) {
      const bs = blocos(s.linhas);
      const ordenados = [...bs].sort((a, b) => relevancia(b.join('\n')) - relevancia(a.join('\n')));
      if (ordenados.some((b, i) => b !== bs[i])) {
        s.linhas = ordenados.flat();
        diff.push(`Experiências reordenadas: primeiro as que citam ${comuns.slice(0, 3).join(', ') || 'os requisitos da vaga'}.`);
      }
    } else if (eh(s.titulo, 'habilidade', 'competenc', 'skills', 'conhecimento', 'tecnolog')) {
      const itens = s.linhas.filter(l => l.trim().startsWith('-'));
      const outros = s.linhas.filter(l => !l.trim().startsWith('-'));
      if (itens.length > 1) {
        const ordenados = [...itens].sort((a, b) => relevancia(b) - relevancia(a));
        if (ordenados.some((l, i) => l !== itens[i])) {
          s.linhas = [...outros, ...ordenados];
          diff.push('Habilidades reordenadas: as pedidas pela vaga vêm primeiro.');
        }
      }
    }
  }

  // Frase de foco no resumo, só com skills reais em comum
  if (comuns.length) {
    const resumo = secoes.find(s => eh(s.titulo, 'resumo', 'objetivo', 'perfil', 'sobre', 'summary'));
    const frase = `Foco em ${comuns.slice(0, 4).join(', ')}.`;
    if (resumo && !normalizar(resumo.linhas.join(' ')).includes(normalizar(frase))) {
      resumo.linhas = [frase, ...resumo.linhas];
      diff.push(`Frase de foco acrescentada ao resumo: "${frase}"`);
    }
  }

  return { markdown: juntar(secoes), diff, skillsEmComum: comuns };
}

// Conectivos que a adaptação pode introduzir sem isso contar como "informação nova"
const PERMITIDAS = new Set(['foco', 'em']);

/** Devolve as palavras que existem no adaptado e não existem no original (deve ser vazio). Usado na adaptação por regras. */
export function validarAdaptacao(original: string, adaptado: string): string[] {
  const base = new Set(palavras(original));
  const novas = new Set<string>();
  for (const p of palavras(adaptado)) if (!base.has(p) && !PERMITIDAS.has(p)) novas.add(p);
  return [...novas];
}

/**
 * Validação para texto reescrito por IA: sinônimos e conectivos podem mudar, mas nenhuma ENTIDADE nova pode entrar —
 * competência do dicionário, número/ano, sigla, ou nome próprio no meio de frase (empresa, ferramenta, certificação).
 * Também exige que toda seção e todo item em negrito (experiências, formações) do original continuem presentes.
 */
export function validarEntidades(original: string, adaptado: string): string[] {
  const problemas = new Set<string>();
  const skillsOriginal = new Set(extrairSkills(original));
  for (const s of extrairSkills(adaptado)) if (!skillsOriginal.has(s)) problemas.add(s);

  const tokensOriginal = new Set((original.match(/[A-Za-zÀ-ÿ0-9+#.]+/g) ?? []).map(t => normalizar(t.replace(/\.$/, ''))));
  const ausente = (t: string) => !tokensOriginal.has(normalizar(t.replace(/\.$/, '')));
  for (const t of adaptado.match(/[A-Za-zÀ-ÿ0-9+#.]*\d[A-Za-zÀ-ÿ0-9+#.]*/g) ?? []) if (ausente(t)) problemas.add(t); // números, anos, versões
  for (const t of adaptado.match(/\b[A-ZÀ-Ý]{2,}\b/g) ?? []) if (ausente(t)) problemas.add(t); // siglas
  for (const m of adaptado.matchAll(/[a-zà-ÿ,]\s+([A-ZÀ-Ý][A-Za-zÀ-ÿ]+)/g)) if (ausente(m[1])) problemas.add(m[1]); // nome próprio no meio da frase

  const secoes = original.match(/^## .+$/gm) ?? [];
  for (const s of secoes) if (!adaptado.includes(s.trim())) problemas.add(`seção removida: ${s.slice(3)}`);
  const negritos = original.match(/^\*\*.+\*\*$/gm) ?? [];
  for (const n of negritos) if (!adaptado.includes(n.trim())) problemas.add(`item removido: ${n.replace(/\*\*/g, '')}`);

  const razao = adaptado.length / Math.max(1, original.length);
  if (razao < 0.6 || razao > 1.6) problemas.add(`tamanho muito diferente do original (${Math.round(razao * 100)}%)`);
  return [...problemas];
}

const SYSTEM_IA = `Você adapta currículos para vagas. REGRA ABSOLUTA: nunca invente, exagere ou remova informação.
Pode fazer só isto:
1. Reordenar experiências e habilidades para pôr primeiro o que é mais relevante para a vaga.
2. Reescrever frases usando termos da vaga SOMENTE quando a experiência real do currículo já sustenta aquilo.
3. Ajustar o resumo/objetivo no topo para falar da vaga, usando apenas fatos que já estão no currículo.
PROIBIDO: acrescentar tecnologias, ferramentas, cargos, empresas, anos de experiência, certificações, formações, números ou qualquer dado ausente do currículo original.
PROIBIDO: remover experiências, formações, seções ou dados reais.
Mantenha o formato Markdown do original (# nome, ## seções, - itens, **títulos em negrito**). Responda SOMENTE com o currículo adaptado em Markdown, sem comentários.`;

/** Adaptação por IA + validação. `completar` recebe (system, usuário) e devolve o texto do modelo. */
export async function adaptarComIA(
  original: string,
  vaga: Pick<Vaga, 'titulo' | 'skills' | 'descricao'>,
  completar: (system: string, usuario: string) => Promise<string>,
): Promise<Adaptacao & { problemas: string[] }> {
  const skillsCv = new Set(extrairSkills(original));
  const comuns = vaga.skills.filter(s => skillsCv.has(s));
  const proibidas = vaga.skills.filter(s => !skillsCv.has(s));
  const usuario = `VAGA: ${vaga.titulo}\n\nDESCRIÇÃO DA VAGA:\n${vaga.descricao.slice(0, 6000)}\n\nCompetências que o currículo JÁ TEM e a vaga pede (pode destacar): ${comuns.join(', ') || 'nenhuma'}\nCompetências que a vaga pede mas o currículo NÃO tem (NÃO acrescente): ${proibidas.join(', ') || 'nenhuma'}\n\nCURRÍCULO ORIGINAL (Markdown):\n${original}`;
  const bruto = await completar(SYSTEM_IA, usuario);
  const markdown = bruto
    .replace(/^```(?:markdown|md)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  const problemas = validarEntidades(original, markdown);

  const antes = new Set(
    original
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean),
  );
  const depois = new Set(
    markdown
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean),
  );
  const diff: string[] = [];
  for (const l of depois) if (!antes.has(l)) diff.push(`+ ${l.slice(0, 140)}`);
  for (const l of antes) if (!depois.has(l)) diff.push(`− ${l.slice(0, 140)}`);
  return { markdown, diff: diff.slice(0, 40), skillsEmComum: comuns, problemas };
}
