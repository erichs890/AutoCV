import { join } from 'node:path';
import type { ConfigAutomacao, PerfilBusca, PerguntaExtra, ResumoFormulario, Vaga } from '../../../src/types.ts';
import { registrarAdapter, type DadosCandidatura, type Log, type PlatformAdapter, type ResultadoCandidatura } from '../adapter.ts';
import { navegador } from '../../browser.ts';
import { DIRS } from '../../config.ts';
import { varrer } from './discovery.ts';
import { ler } from '../../estado.ts';
import { formularios } from '../../storage/db.ts';
import { lerSchemaFormulario, perguntasCertas } from './schema.ts';
import { executarFormulario, type EtapaDescoberta } from './formulario.ts';

export { pretensaoEmReais } from './formulario.ts';

// A busca é o módulo de descoberta (discovery.ts): lista de empresas + API pública. Aqui só a candidatura.
const buscarVagas = (perfil: PerfilBusca, cfg: ConfigAutomacao, log: Log): Promise<Vaga[]> => varrer(perfil, { area: cfg.area, cargo: cfg.cargo, senioridade: cfg.senioridade, local: ler.perfil()?.cidade, scoreMinimo: cfg.scoreMinimo }, log);

const jobIdDe = (vaga: Vaga) => vaga.id.replace(/^inhire:[^:]+:/, '');

/** Perguntas que a vaga com certeza vai fazer (diversidade obrigatória + Typeform obrigatório), lidas da API. */
async function perguntasPrevias(vaga: Vaga): Promise<PerguntaExtra[]> {
  const schema = await lerSchemaFormulario(vaga.tenant, jobIdDe(vaga));
  return perguntasCertas(schema).map(p => ({ rotulo: p.rotulo, tipo: p.tipo, opcoes: p.opcoes, obrigatoria: true }));
}

// Requisições que criam/enviam a candidatura: em modo ensaio são abortadas no navegador, como garantia dura
const ROTAS_DE_ENVIO = ['**/job-talents/public/**', '**/forms/form/submit**', '**/responses**'];

async function candidatar(vaga: Vaga, dados: DadosCandidatura, log: Log): Promise<ResultadoCandidatura> {
  const ctx = await navegador(dados.mostrarNavegador);
  const page = await ctx.newPage();
  const captura = async (nome: string) => {
    const caminho = join(DIRS.gerados, `${nome}-${Date.now()}.png`);
    await page.screenshot({ path: caminho, fullPage: true }).catch(() => {});
    return caminho;
  };
  let etapas: EtapaDescoberta[] = [];
  page.setDefaultTimeout(12000); // ações do Playwright (click/fill) esperam no máximo isto; as esperas de fluxo são explícitas
  try {
    if (dados.ensaio) for (const rota of ROTAS_DE_ENVIO) await page.route(rota, r => r.abort());
    log('info', `Abrindo ${vaga.url}`);
    await page.goto(vaga.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const apareceu = await page
      .locator('form input, form textarea, form .react-dropdown-select')
      .first()
      .waitFor({ state: 'visible', timeout: 30000 })
      .then(() => true)
      .catch(() => false);
    if (!apareceu) return { status: 'erro', motivo: 'formulário de candidatura não apareceu (vaga encerrada ou layout mudou)', captura: await captura('sem-formulario') };

    const schema = await lerSchemaFormulario(vaga.tenant, jobIdDe(vaga)).catch(() => null);
    const r = await executarFormulario(page, dados, log, { fluxoCondicional: schema?.fluxoCondicional ?? false });
    etapas = r.etapas;
    const resumo: ResumoFormulario = {
      etapas: r.etapas.length,
      campos: r.etapas.reduce((s, e) => s + e.campos.length, 0),
      perguntas: r.perguntasRespondidas,
      typeform: r.typeform,
      incomum: r.etapas.length > 3 || r.etapas.some(e => e.campos.some(c => c.tipo === 'desconhecido')),
    };
    formularios.salvar(vaga.id, { etapas: r.etapas, resumo, em: new Date().toISOString() });
    log('info', `Estrutura do formulário: ${resumo.etapas} etapa(s), ${resumo.campos} campo(s)${resumo.typeform ? ', com Typeform' : ''}${resumo.incomum ? ' — estrutura incomum, vale conferir a captura' : ''}.`);

    if (r.resultado.status === 'ensaio') {
      const valores = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll<HTMLInputElement>('input[name]')].filter(i => i.type !== 'file' && i.type !== 'radio' && i.type !== 'checkbox' && i.value).map(i => [i.name, i.value])));
      log('info', `Valores no formulário: ${JSON.stringify(valores).slice(0, 400)}`);
      return { ...r.resultado, captura: await captura('ensaio'), formulario: resumo };
    }
    if (r.resultado.status === 'erro') return { ...r.resultado, captura: await captura('erro'), formulario: resumo };
    if (r.resultado.status === 'pergunta') return r.resultado;
    return { ...r.resultado, formulario: resumo };
  } catch (e) {
    const motivo = (e as Error).message.split('\n')[0];
    const ultima = etapas.at(-1);
    return { status: 'erro', motivo: ultima ? `${motivo} (etapa ${ultima.etapa}: ${ultima.campos.map(c => c.rotulo || c.nome).slice(0, 6).join(', ')})` : motivo, captura: await captura('erro') };
  } finally {
    await page.close().catch(() => {});
  }
}

export const inhire: PlatformAdapter = { id: 'inhire', nome: 'InHire', buscarVagas, candidatar, perguntasPrevias };
registrarAdapter(inhire);
