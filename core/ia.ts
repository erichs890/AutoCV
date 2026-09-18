import Anthropic from '@anthropic-ai/sdk';
import type { ConfigIA, ProvedorIA } from '../src/types.ts';
import { kv } from './storage/db.ts';

// Provedor de IA para a adaptação de currículo. A chave fica só no SQLite local (%LOCALAPPDATA%\AutoCV)
// e nunca é devolvida ao front — o front só vê se existe e os 4 últimos caracteres.

export const MODELOS: Record<Exclude<ProvedorIA, 'nenhum'>, { padrao: string; opcoes: string[] }> = {
  gemini: { padrao: 'gemini-2.5-flash', opcoes: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'] },
  anthropic: { padrao: 'claude-opus-5', opcoes: ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'] },
};

interface IAArmazenada {
  provedor: ProvedorIA;
  modelo: string;
  chave: string;
}

export const lerIA = (): IAArmazenada => kv.get<IAArmazenada>('ia', { provedor: 'nenhum', modelo: '', chave: '' });

export function salvarIA(parcial: { provedor?: ProvedorIA; modelo?: string; chave?: string }) {
  const atual = lerIA();
  const provedor = parcial.provedor ?? atual.provedor;
  const modelo = (parcial.modelo?.trim() || (provedor !== atual.provedor ? '' : atual.modelo) || (provedor === 'nenhum' ? '' : MODELOS[provedor].padrao)).trim();
  const chave = parcial.chave?.trim() ? parcial.chave.trim() : atual.chave; // chave vazia = manter a atual
  kv.set('ia', { provedor, modelo, chave });
}

export function iaParaFront(): ConfigIA {
  const { provedor, modelo, chave } = lerIA();
  return { provedor, modelo, chaveDefinida: chave.length > 0, chaveFinal: chave.slice(-4) };
}

export const iaAtiva = () => {
  const ia = lerIA();
  return ia.provedor !== 'nenhum' && ia.chave.length > 0;
};

async function gemini(modelo: string, chave: string, system: string, usuario: string): Promise<string> {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': chave },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: usuario }] }],
      generationConfig: { temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(90000),
  });
  const j = (await r.json().catch(() => ({}))) as { error?: { message?: string }; candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[] };
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${j.error?.message ?? 'erro desconhecido'}`);
  const texto = j.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '';
  if (!texto) throw new Error(`Gemini não devolveu texto (${j.candidates?.[0]?.finishReason ?? 'sem candidato'})`);
  return texto;
}

async function anthropic(modelo: string, chave: string, system: string, usuario: string): Promise<string> {
  const client = new Anthropic({ apiKey: chave });
  try {
    const resposta = await client.messages.create({
      model: modelo,
      max_tokens: 16000,
      system,
      messages: [{ role: 'user', content: usuario }],
    });
    if (resposta.stop_reason === 'refusal') throw new Error('o modelo recusou a tarefa');
    const texto = resposta.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');
    if (!texto) throw new Error('resposta vazia');
    return texto;
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('Anthropic: chave inválida');
    if (e instanceof Anthropic.NotFoundError) throw new Error(`Anthropic: modelo "${modelo}" não encontrado`);
    if (e instanceof Anthropic.RateLimitError) throw new Error('Anthropic: limite de requisições, tente de novo em instantes');
    if (e instanceof Anthropic.APIError) throw new Error(`Anthropic ${e.status}: ${e.message}`);
    throw e;
  }
}

/** Uma chamada de texto → texto no provedor configurado. */
export async function completar(system: string, usuario: string): Promise<string> {
  const { provedor, modelo, chave } = lerIA();
  if (provedor === 'nenhum' || !chave) throw new Error('IA não configurada');
  return provedor === 'gemini' ? gemini(modelo, chave, system, usuario) : anthropic(modelo, chave, system, usuario);
}

const SYSTEM_AVALIACAO = `Você é um recrutador experiente. Recebe um currículo e uma lista de vagas e avalia, para cada vaga, a compatibilidade REAL do candidato de 0 a 100, considerando área de atuação, cargo, senioridade e competências que o currículo de fato comprova. Vaga de área diferente da do candidato = nota baixa (0–20). Mesma área e cargo parecido com as competências principais atendidas = nota alta (70–100).
Responda SOMENTE com um array JSON, sem comentários, no formato: [{"id":"...","score":0,"motivo":"uma frase curta em português"}]`;

/** Avalia a compatibilidade de várias vagas contra o currículo, em lotes. Devolve só as que o modelo respondeu. */
export async function avaliarVagas(curriculoMd: string, vagas: { id: string; titulo: string; descricao: string }[], senioridade = ''): Promise<Map<string, { score: number; motivo: string }>> {
  const resultado = new Map<string, { score: number; motivo: string }>();
  for (let i = 0; i < vagas.length; i += 6) {
    const lote = vagas.slice(i, i + 6);
    const usuario = `${senioridade ? `SENIORIDADE DO CANDIDATO: ${senioridade} (vaga que pede nível acima disso = nota baixa)\n` : ''}CURRÍCULO:\n${curriculoMd.slice(0, 8000)}\n\nVAGAS:\n${lote.map(v => `--- id: ${v.id}\nTÍTULO: ${v.titulo}\n${v.descricao.slice(0, 2500)}`).join('\n\n')}`;
    const bruto = await completar(SYSTEM_AVALIACAO, usuario);
    const inicio = bruto.indexOf('[');
    const fim = bruto.lastIndexOf(']');
    if (inicio < 0 || fim < inicio) throw new Error('resposta da IA sem JSON');
    const lista = JSON.parse(bruto.slice(inicio, fim + 1)) as { id?: string; score?: number; motivo?: string }[];
    for (const item of lista) {
      const id = String(item.id ?? '');
      const score = Number(item.score);
      if (lote.some(v => v.id === id) && Number.isFinite(score)) resultado.set(id, { score: Math.max(0, Math.min(100, Math.round(score))), motivo: String(item.motivo ?? '').slice(0, 200) });
    }
  }
  return resultado;
}

/** Chamada mínima para validar chave e modelo. */
export async function testarIA(): Promise<string> {
  const texto = await completar('Responda exatamente com a palavra OK, sem mais nada.', 'Teste de conexão.');
  const { provedor, modelo } = lerIA();
  return `${provedor === 'gemini' ? 'Gemini' : 'Anthropic'} (${modelo}) respondeu: ${texto.trim().slice(0, 40)}`;
}
