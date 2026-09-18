import type { Page, Locator } from 'playwright';

// Seletores do formulário público do InHire (levantados em 17/09/2026 em *.inhire.app/vagas/<id>/<slug>).
// Cada campo tem alternativas em ordem de preferência: atributo estável → placeholder/rótulo → posição.
export const SEL = {
  nome: ['input[name="name"]', '#name', 'input[placeholder*="nome completo" i]'],
  email: ['input[name="email"]', '#email', 'input[type="email"]'],
  celular: ['input[name="phone"]', '#phone', 'input[type="tel"]'],
  linkedin: ['input[name="linkedinUsername"]', '#linkedinUsername', 'input[placeholder*="linkedin" i]'],
  pretensao: ['input[name="salaryExpectation"]', '#salaryExpectation', 'input[placeholder*="R$"]'],
  arquivo: ['input[name="resume"]', 'input[type="file"][accept*="pdf"]', 'input[type="file"]'],
  regime: (valor: 'CLT' | 'PJ') => [`input[name="contractType"][value="${valor}"]`, `label:has-text("${valor}") input[type="radio"]`],
  modeloTrabalho: (sim: boolean) => [`input[name="workModel"][value="${sim}"]`],
  continuar: ['button[type="submit"]:has-text("Continuar")', 'button:has-text("Continuar inscrição")', 'button:has-text("Continuar")'],
  enviar: ['button[type="submit"]:has-text("Enviar")', 'button:has-text("Finalizar")', 'button:has-text("Concluir")', 'button:has-text("Enviar candidatura")', 'button[type="submit"]'],
};

// Campos do formulário que o adapter já sabe preencher; qualquer outro é "pergunta extra"
export const CAMPOS_CONHECIDOS = new Set(['name', 'email', 'phone', 'phoneCountry', 'linkedinUsername', 'resume', 'salaryExpectation', 'contractType', 'workModel', 'g-recaptcha-response']);

// Sinais de que o InHire aceitou a candidatura
export const SUCESSO = /candidatura (enviada|realizada|recebida|conclu)|inscri[çc][ãa]o (enviada|realizada|recebida|conclu)|recebemos (sua|a sua) (candidatura|inscri)|obrigad[oa] por se candidatar|boa sorte/i;

export async function achar(page: Page, seletores: string[], timeoutMs = 4000): Promise<Locator | null> {
  const fim = Date.now() + timeoutMs;
  do {
    for (const s of seletores) {
      const loc = page.locator(s).first();
      if ((await loc.count()) > 0) return loc;
    }
    await page.waitForTimeout(250);
  } while (Date.now() < fim);
  return null;
}
