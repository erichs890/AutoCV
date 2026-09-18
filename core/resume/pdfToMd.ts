import { readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { normalizar } from './texto.ts';

// Títulos de seção que costumam aparecer em currículos (PT/EN)
const SECOES = ['resumo', 'objetivo', 'perfil', 'sobre', 'experiencia', 'experiencias', 'experiencia profissional', 'historico profissional', 'formacao', 'formacao academica', 'educacao', 'habilidades', 'competencias', 'skills', 'conhecimentos', 'tecnologias', 'idiomas', 'cursos', 'certificacoes', 'certificados', 'projetos', 'contato', 'dados pessoais', 'informacoes pessoais', 'summary', 'experience', 'education', 'languages', 'projects', 'certifications'];

interface Linha {
  y: number;
  texto: string;
  tamanho: number;
  negrito: boolean;
}

function ehTituloDeSecao(texto: string) {
  const n = normalizar(texto).replace(/[:\s]+$/, '').trim();
  return n.length <= 40 && SECOES.some(s => n === s || n.startsWith(s + ' ') || n.endsWith(' ' + s));
}

/** Extrai o texto do PDF e reconstrói um Markdown simples (títulos, listas, parágrafos). */
export async function pdfParaMarkdown(caminho: string): Promise<string> {
  const dados = new Uint8Array(await readFile(caminho));
  const doc = await getDocument({ data: dados, useSystemFonts: true }).promise;
  const linhas: Linha[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const pagina = await doc.getPage(p);
    const conteudo = await pagina.getTextContent();
    const porY = new Map<number, Linha>();
    for (const item of conteudo.items as { str: string; transform: number[]; height: number; fontName: string }[]) {
      if (!item.str?.trim()) continue;
      const y = Math.round(item.transform[5] / 3) * 3 + p * 100000; // agrupa por linha, por página
      const tamanho = Math.abs(item.transform[0]) || item.height;
      const negrito = /bold|black|heavy|semibold/i.test(item.fontName) || /-Bold|Bold/.test(item.fontName);
      const l = porY.get(y);
      if (l) {
        l.texto += (l.texto.endsWith(' ') || item.str.startsWith(' ') ? '' : ' ') + item.str;
        l.tamanho = Math.max(l.tamanho, tamanho);
        l.negrito = l.negrito && negrito;
      } else porY.set(y, { y, texto: item.str, tamanho, negrito });
    }
    linhas.push(...[...porY.values()].sort((a, b) => b.y - a.y));
  }

  const tamanhos = linhas.map(l => l.tamanho).sort((a, b) => a - b);
  const mediana = tamanhos[Math.floor(tamanhos.length / 2)] ?? 10;
  const maior = tamanhos[tamanhos.length - 1] ?? mediana;

  const saida: string[] = [];
  let primeiroTitulo = true;
  for (const l of linhas) {
    const texto = l.texto.replace(/\s+/g, ' ').trim();
    if (!texto) continue;
    const curto = texto.length <= 60;
    if (primeiroTitulo && l.tamanho >= maior - 0.5 && curto) {
      saida.push(`# ${texto}`);
      primeiroTitulo = false;
      continue;
    }
    if (ehTituloDeSecao(texto) || (curto && (l.tamanho >= mediana * 1.25 || (l.negrito && l.tamanho >= mediana * 1.05 && ehTituloDeSecao(texto))))) {
      saida.push('', `## ${texto.replace(/[:\s]+$/, '')}`, '');
      continue;
    }
    if (/^[•\-–▪●○◦*·]\s*/.test(texto)) {
      saida.push(`- ${texto.replace(/^[•\-–▪●○◦*·]\s*/, '')}`);
      continue;
    }
    if (curto && l.negrito) {
      saida.push('', `**${texto}**`);
      continue;
    }
    saida.push(texto);
  }
  return saida
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
