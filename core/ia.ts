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

/** Chamada mínima para validar chave e modelo. */
export async function testarIA(): Promise<string> {
  const texto = await completar('Responda exatamente com a palavra OK, sem mais nada.', 'Teste de conexão.');
  const { provedor, modelo } = lerIA();
  return `${provedor === 'gemini' ? 'Gemini' : 'Anthropic'} (${modelo}) respondeu: ${texto.trim().slice(0, 40)}`;
}
