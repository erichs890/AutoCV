import { navegador } from '../browser.ts';

// Template único e limpo para todo currículo gerado (independente da vaga).
const CSS = `
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; line-height: 1.45; color: #222; margin: 0; }
  h1 { font-size: 20pt; margin: 0 0 4pt; letter-spacing: -0.02em; }
  h2 { font-size: 11.5pt; text-transform: uppercase; letter-spacing: 0.06em; color: #1A6DC4; border-bottom: 1px solid #C3C9D1; padding-bottom: 2pt; margin: 14pt 0 6pt; }
  p { margin: 0 0 5pt; }
  ul { margin: 0 0 6pt; padding-left: 4pt; list-style: none; }
  li { margin: 0 0 2pt; }
  strong { color: #111; }
  a { color: #1A6DC4; text-decoration: none; }
`;

const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s: string) =>
  escapar(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(https?:\/\/[^\s)]+)/g, '<a href="$1">$1</a>');

/** Markdown (títulos, listas, negrito, parágrafos) → HTML. Cobre o que o pdfParaMarkdown produz. */
export function markdownParaHtml(md: string): string {
  const html: string[] = [];
  let lista = false;
  const fecharLista = () => {
    if (lista) html.push('</ul>');
    lista = false;
  };
  for (const linha of md.split('\n')) {
    const l = linha.trim();
    if (!l) {
      fecharLista();
      continue;
    }
    if (l.startsWith('# ')) {
      fecharLista();
      html.push(`<h1>${inline(l.slice(2))}</h1>`);
    } else if (l.startsWith('## ')) {
      fecharLista();
      html.push(`<h2>${inline(l.slice(3))}</h2>`);
    } else if (/^[-*] /.test(l)) {
      if (!lista) html.push('<ul>');
      lista = true;
      html.push(`<li>• ${inline(l.slice(2))}</li>`); // marcador como texto: sobrevive à extração PDF → Markdown
    } else {
      fecharLista();
      html.push(`<p>${inline(l)}</p>`);
    }
  }
  fecharLista();
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${html.join('\n')}</body></html>`;
}

/** Gera o PDF final em `caminho` a partir do Markdown, usando o navegador (Chromium/Edge) para renderizar. */
export async function markdownParaPdf(md: string, caminho: string, mostrarNavegador = false): Promise<string> {
  const ctx = await navegador(mostrarNavegador);
  const page = await ctx.newPage();
  try {
    await page.setContent(markdownParaHtml(md), { waitUntil: 'load' });
    await page.pdf({ path: caminho, format: 'A4', printBackground: true });
    return caminho;
  } finally {
    await page.close().catch(() => {});
  }
}
