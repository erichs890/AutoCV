import { chromium, type BrowserContext } from 'playwright';
import { DIRS } from './config.ts';

// Uma única sessão de navegador (nunca duas candidaturas em paralelo).
// Usa o Edge/Chrome já instalado; o Chromium do Playwright é o último recurso.
let contexto: BrowserContext | null = null;
let visivel = false;

/** O contexto pode estar "vivo" no objeto e morto no sistema (usuário fechou o Edge, processo caiu). */
async function saudavel(c: BrowserContext): Promise<boolean> {
  try {
    const p = await c.newPage();
    await p.close();
    return true;
  } catch {
    return false;
  }
}

export async function navegador(mostrar: boolean): Promise<BrowserContext> {
  if (contexto && visivel !== mostrar) await fecharNavegador();
  // Sem esta checagem, um navegador morto trava TODAS as candidaturas seguintes com o mesmo erro até reiniciar o núcleo
  if (contexto && !(await saudavel(contexto))) await fecharNavegador();
  if (contexto) return contexto;
  const erros: string[] = [];
  // AUTOCV_PERFIL: outro diretório de perfil (o self-check usa um temporário para não colidir com o núcleo rodando)
  const perfil = process.env.AUTOCV_PERFIL ?? DIRS.navegador;
  for (const channel of ['msedge', 'chrome', undefined] as const) {
    try {
      contexto = await chromium.launchPersistentContext(perfil, {
        channel,
        headless: !mostrar,
        locale: 'pt-BR',
        viewport: { width: 1280, height: 900 },
      });
      visivel = mostrar;
      contexto.on('close', () => {
        contexto = null;
      });
      return contexto;
    } catch (e) {
      erros.push(`${channel ?? 'chromium'}: ${(e as Error).message.split('\n')[0]}`);
    }
  }
  throw new Error(`Nenhum navegador disponível. Instale o Microsoft Edge ou o Google Chrome. (${erros.join(' | ')})`);
}

export async function fecharNavegador() {
  const c = contexto;
  contexto = null;
  await c?.close().catch(() => {});
}
