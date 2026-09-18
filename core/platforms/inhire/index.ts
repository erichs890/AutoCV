import { basename, join } from 'node:path';
import type { Page } from 'playwright';
import type { ConfigAutomacao, PerfilBusca, PerguntaExtra, Vaga } from '../../../src/types.ts';
import { registrarAdapter, type DadosCandidatura, type Log, type PlatformAdapter, type ResultadoCandidatura } from '../adapter.ts';
import { detalheVaga, htmlParaTexto, listarVagas, urlVaga } from './api.ts';
import { CAMPOS_CONHECIDOS, SEL, SUCESSO, achar } from './selectors.ts';
import { navegador } from '../../browser.ts';
import { DIRS } from '../../config.ts';
import { calcularScore } from '../../resume/score.ts';
import { extrairSkills } from '../../resume/texto.ts';

const MODELO: Record<string, Vaga['modelo']> = { Remote: 'remoto', Hybrid: 'hibrido', 'On-site': 'presencial' };

function regimeDe(tipos: string[]): Vaga['regime'] {
  const t = tipos.map(x => x.toUpperCase());
  const clt = t.some(x => x.includes('CLT'));
  const pj = t.some(x => x.includes('PJ'));
  return clt && pj ? 'ambos' : clt ? 'CLT' : pj ? 'PJ' : 'indefinido';
}

function requisitosDe(texto: string): string {
  const m = texto.match(/requisitos?[\s\S]*?(?=\n(?:benef|diferen|compet|sobre|o que oferecemos|faixa)|$)/i);
  return (m?.[0] ?? '').trim().slice(0, 2000);
}

// Tenta com backoff em falhas transitórias (rede, timeout)
async function tentar<T>(fn: () => Promise<T>, vezes = 3): Promise<T> {
  let erro: unknown;
  for (let i = 0; i < vezes; i++) {
    try {
      return await fn();
    } catch (e) {
      erro = e;
      await new Promise(r => setTimeout(r, 800 * 2 ** i));
    }
  }
  throw erro;
}

async function buscarVagas(perfil: PerfilBusca, cfg: ConfigAutomacao, log: Log): Promise<Vaga[]> {
  const encontradas: Vaga[] = [];
  for (const tenant of cfg.tenants) {
    let lista;
    try {
      lista = await tentar(() => listarVagas(tenant));
    } catch (e) {
      log('erro', `InHire/${tenant}: ${(e as Error).message}`);
      continue;
    }
    log('info', `InHire/${tenant} (${lista.tenantName}): ${lista.vagas.length} vagas publicadas.`);
    for (const resumo of lista.vagas) {
      try {
        const d = await tentar(() => detalheVaga(tenant, resumo.jobId));
        const descricao = htmlParaTexto(d.description ?? '');
        const skills = extrairSkills(`${d.displayName}\n${descricao}`);
        const vaga: Vaga = {
          id: `inhire:${tenant}:${d.jobId}`,
          plataforma: 'inhire',
          tenant,
          titulo: d.displayName.trim(),
          empresa: d.tenantName || lista.tenantName,
          descricao,
          requisitos: requisitosDe(descricao),
          regime: regimeDe(d.contractType ?? []),
          modelo: MODELO[d.workplaceType ?? ''] ?? 'indefinido',
          local: d.location ?? '',
          url: urlVaga(tenant, d.jobId, d.displayName),
          skills,
          camposConhecidos: d.settings?.fields ?? [],
          score: 0,
          status: 'encontrada',
          encontradaEm: new Date().toISOString(),
          atualizadaEm: new Date().toISOString(),
        };
        vaga.score = calcularScore(vaga, perfil);
        encontradas.push(vaga);
      } catch (e) {
        log('alerta', `InHire/${tenant}: falha ao ler a vaga ${resumo.displayName}: ${(e as Error).message}`);
      }
    }
  }
  return encontradas;
}

// "R$ 4.500,00" | "4500" | "4.500" → dígitos em reais inteiros ("4500"): a máscara do InHire acrescenta ",00" sozinha
export function pretensaoEmReais(valor: string): string {
  const s = valor.replace(/[^\d,.]/g, '');
  if (!s) return '';
  const semCentavos = s.replace(/[,.]\d{1,2}$/, '');
  return semCentavos.replace(/\D/g, '');
}

async function preencher(page: Page, seletores: string[], valor: string, rotulo: string, obrigatorio = true) {
  const loc = await achar(page, seletores);
  if (!loc) {
    if (obrigatorio) throw new Error(`campo "${rotulo}" não encontrado na página`);
    return;
  }
  await loc.click();
  await loc.fill('');
  await loc.pressSequentially(valor, { delay: 15 });
}

// Campos que não são os fixos do InHire = perguntas específicas da vaga
async function perguntasExtras(page: Page): Promise<(PerguntaExtra & { seletor: string })[]> {
  return page.evaluate(conhecidos => {
    const rotuloDe = (el: Element): string => {
      const id = (el as HTMLInputElement).id;
      const porFor = id ? document.querySelector(`label[for="${id}"]`) : null;
      const envolto = el.closest('label');
      const grupo = el.closest('[role="radiogroup"], fieldset, div');
      const candidato = porFor?.textContent || envolto?.textContent || el.getAttribute('aria-label') || (el as HTMLInputElement).placeholder || grupo?.querySelector('label, legend, p, span')?.textContent || '';
      return candidato.replace(/\*/g, '').replace(/\s+/g, ' ').trim();
    };
    const visivel = (el: Element) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.opacity !== '0';
    };
    const saida: { rotulo: string; tipo: 'texto' | 'opcoes' | 'arquivo'; opcoes?: string[]; seletor: string }[] = [];
    const grupos = new Map<string, { rotulo: string; opcoes: string[] }>();
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select').forEach((el, i) => {
      const nome = el.getAttribute('name') ?? '';
      if (conhecidos.includes(nome) || el.type === 'hidden' || el.type === 'submit' || !visivel(el)) return;
      if (el.type === 'radio' || el.type === 'checkbox') {
        const chave = nome || `radio-${i}`;
        const g = grupos.get(chave) ?? { rotulo: '', opcoes: [] };
        const opcao = (el.closest('label')?.textContent || el.getAttribute('value') || '').trim();
        if (opcao) g.opcoes.push(opcao);
        if (!g.rotulo) {
          const bloco = el.closest('div')?.parentElement;
          g.rotulo = (bloco?.querySelector('label, legend, p')?.textContent ?? '').replace(/\*/g, '').trim();
        }
        grupos.set(chave, g);
        return;
      }
      if (el.tagName === 'SELECT') {
        saida.push({ rotulo: rotuloDe(el), tipo: 'opcoes', opcoes: [...(el as HTMLSelectElement).options].map(o => o.text.trim()).filter(Boolean), seletor: nome ? `select[name="${nome}"]` : `select:nth-of-type(${i + 1})` });
        return;
      }
      if (el.type === 'file') {
        saida.push({ rotulo: rotuloDe(el), tipo: 'arquivo', seletor: nome ? `input[name="${nome}"]` : 'input[type="file"]' });
        return;
      }
      saida.push({ rotulo: rotuloDe(el), tipo: 'texto', seletor: nome ? `[name="${nome}"]` : `#${el.id}` });
    });
    for (const [chave, g] of grupos) saida.push({ rotulo: g.rotulo || chave, tipo: 'opcoes', opcoes: g.opcoes, seletor: `input[name="${chave}"]` });
    return saida.filter(s => s.rotulo);
  }, [...CAMPOS_CONHECIDOS]);
}

async function responderExtra(page: Page, p: PerguntaExtra & { seletor: string }, resposta: string) {
  if (p.tipo === 'opcoes') {
    const select = page.locator(p.seletor).first();
    if ((await select.evaluate(el => el.tagName).catch(() => '')) === 'SELECT') return select.selectOption({ label: resposta });
    const porValor = page.locator(`${p.seletor}[value="${resposta.replace(/"/g, '')}"]`).first();
    if ((await porValor.count()) > 0) return porValor.check({ force: true });
    const porRotulo = page.locator(`label:has-text("${resposta.replace(/"/g, '')}")`).first();
    if ((await porRotulo.count()) > 0) return porRotulo.click();
    throw new Error(`opção "${resposta}" não encontrada para "${p.rotulo}"`);
  }
  if (p.tipo === 'arquivo') return; // só o currículo é anexado automaticamente
  await page.locator(p.seletor).first().fill(resposta);
}

async function candidatar(vaga: Vaga, dados: DadosCandidatura, log: Log): Promise<ResultadoCandidatura> {
  const ctx = await navegador(dados.mostrarNavegador);
  const page = await ctx.newPage();
  const captura = async (nome: string) => {
    const caminho = join(DIRS.gerados, `${nome}-${Date.now()}.png`);
    await page.screenshot({ path: caminho, fullPage: true }).catch(() => {});
    return caminho;
  };
  try {
    log('info', `Abrindo ${vaga.url}`);
    await page.goto(vaga.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (!(await achar(page, SEL.nome, 15000))) return { status: 'erro', motivo: 'formulário de candidatura não apareceu (vaga encerrada ou layout mudou)', captura: await captura('sem-formulario') };

    await preencher(page, SEL.nome, dados.nome, 'nome');
    await preencher(page, SEL.email, dados.email, 'e-mail');
    await preencher(page, SEL.celular, dados.celular.replace(/\D/g, ''), 'celular');
    if (vaga.camposConhecidos.includes('linkedin') || (await achar(page, SEL.linkedin, 500))) await preencher(page, SEL.linkedin, dados.linkedin, 'LinkedIn', false);
    if (vaga.camposConhecidos.includes('salary') || (await achar(page, SEL.pretensao, 500))) await preencher(page, SEL.pretensao, pretensaoEmReais(dados.pretensao), 'pretensão salarial', false);

    const modelo = await achar(page, SEL.modeloTrabalho(true), 500);
    if (modelo) await modelo.check({ force: true }); // "tem disponibilidade para o modelo X?" — a vaga já passou pelo filtro de regime do usuário

    if (dados.regime) {
      const radio = await achar(page, SEL.regime(dados.regime), 1000);
      if (radio) await radio.check({ force: true });
    }

    // Anexo pelo mesmo caminho do usuário (botão → seletor de arquivo); se não abrir seletor, cai no input direto
    const botaoAnexar = page.getByRole('button', { name: /anexar curr/i }).first();
    let anexou = false;
    if ((await botaoAnexar.count()) > 0) {
      try {
        const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), botaoAnexar.click()]);
        await chooser.setFiles(dados.curriculoPdf);
        anexou = true;
      } catch {
        /* sem seletor de arquivo: tenta o input */
      }
    }
    if (!anexou) {
      const arquivo = await achar(page, SEL.arquivo, 2000);
      if (!arquivo) return { status: 'erro', motivo: 'campo de anexo do currículo não encontrado', captura: await captura('sem-anexo') };
      await arquivo.setInputFiles(dados.curriculoPdf);
    }
    await page.waitForTimeout(1200);
    const nomeArquivo = basename(dados.curriculoPdf);
    const apareceu = await page.evaluate(n => document.body.innerText.includes(n), nomeArquivo);
    const anexados = await page.evaluate(() => [...document.querySelectorAll<HTMLInputElement>('input[type="file"]')].some(i => (i.files?.length ?? 0) > 0));
    if (!anexados && !apareceu) return { status: 'erro', motivo: 'o currículo não ficou anexado no formulário', captura: await captura('anexo-falhou') };
    log('info', `Formulário preenchido e currículo anexado${apareceu ? ` (${nomeArquivo} aparece na página)` : ''}.`);

    // Perguntas específicas da vaga já visíveis no primeiro passo
    for (const p of await perguntasExtras(page)) {
      const resposta = dados.responder(p);
      if (resposta === null) return { status: 'pergunta', pergunta: { rotulo: p.rotulo, tipo: p.tipo, opcoes: p.opcoes } };
      await responderExtra(page, p, resposta);
      log('info', `Pergunta "${p.rotulo}" respondida com a resposta salva.`);
    }

    const continuar = await achar(page, SEL.continuar, 3000);
    if (!continuar) return { status: 'erro', motivo: 'botão de envio não encontrado', captura: await captura('sem-botao') };
    const liberado = await continuar.isEnabled();

    if (dados.ensaio) {
      // O botão só fica habilitado quando o InHire aceita todos os campos: é o melhor sinal de que o preenchimento está certo
      const valores = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll<HTMLInputElement>('input[name]')].filter(i => i.type !== 'file' && i.type !== 'radio').map(i => [i.name, i.value])));
      log('info', `Valores no formulário: ${JSON.stringify(valores)}`);
      return { status: 'ensaio', captura: await captura('ensaio'), pronto: liberado, observacao: liberado ? undefined : 'o InHire não liberou o botão "Continuar inscrição": algum campo obrigatório ficou inválido ou vazio' };
    }
    if (!liberado) return { status: 'erro', motivo: 'o InHire não liberou o botão de envio: algum campo obrigatório ficou inválido ou vazio', captura: await captura('campo-invalido') };
    await continuar.click();
    await page.waitForTimeout(3000);

    // Depois de "Continuar": ou o InHire confirmou, ou há um segundo passo com perguntas
    for (let passo = 0; passo < 4; passo++) {
      const texto = await page.evaluate(() => document.body.innerText).catch(() => '');
      if (SUCESSO.test(texto) || /sucesso|obrigado|confirma/i.test(page.url())) return { status: 'enviada' };
      const extras = await perguntasExtras(page);
      for (const p of extras) {
        const resposta = dados.responder(p);
        if (resposta === null) return { status: 'pergunta', pergunta: { rotulo: p.rotulo, tipo: p.tipo, opcoes: p.opcoes } };
        await responderExtra(page, p, resposta);
      }
      const enviar = await achar(page, SEL.enviar, 3000);
      if (!enviar) break;
      await enviar.click();
      await page.waitForTimeout(3500);
    }
    const texto = await page.evaluate(() => document.body.innerText).catch(() => '');
    if (SUCESSO.test(texto)) return { status: 'enviada' };
    if (/captcha|robô|robot/i.test(texto)) return { status: 'erro', motivo: 'o InHire pediu verificação (captcha); envie esta vaga manualmente', captura: await captura('captcha') };
    return { status: 'erro', motivo: 'sem confirmação do InHire após o envio', captura: await captura('sem-confirmacao') };
  } catch (e) {
    return { status: 'erro', motivo: (e as Error).message.split('\n')[0], captura: await captura('erro') };
  } finally {
    await page.close().catch(() => {});
  }
}

export const inhire: PlatformAdapter = { id: 'inhire', nome: 'InHire', buscarVagas, candidatar };
registrarAdapter(inhire);
