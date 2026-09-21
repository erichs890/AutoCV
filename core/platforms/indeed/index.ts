// Adapter do Indeed: só vagas com "Candidatar-se facilmente" (a candidatura acontece dentro do Indeed).
// Busca: busca.ts (verificada ao vivo). Candidatura e login: escritos sobre o motor de formulário genérico do
// InHire, mas NÃO verificados ao vivo — exigem uma conta real e criariam candidaturas reais. Ver seletores.ts.
import { join } from 'node:path';
import type { ConfigAutomacao, PerfilBusca, ResumoFormulario, Vaga } from '../../../src/types.ts';
import { registrarAdapter, type DadosCandidatura, type Log, type OpcoesBusca, type PlatformAdapter, type ResultadoCandidatura } from '../adapter.ts';
import { navegador } from '../../browser.ts';
import { DIRS } from '../../config.ts';
import { ler } from '../../estado.ts';
import { formularios, vagas } from '../../storage/db.ts';
import { extrairSkills } from '../../resume/texto.ts';
import { executarFormulario } from '../inhire/formulario.ts';
import { buscarNoIndeed, detectarBloqueio } from './busca.ts';
import { INDEED } from './seletores.ts';

const buscarVagas = (perfil: PerfilBusca, cfg: ConfigAutomacao, log: Log, opcoes?: OpcoesBusca): Promise<Vaga[]> => buscarNoIndeed(perfil, cfg, ler.localizacao(), log, opcoes?.manual === true);

/**
 * Login manual: abre a página de entrada do Indeed na janela do robô e espera a pessoa entrar (senha, código por
 * e-mail, captcha — tudo com ela). O AutoCV não vê nem guarda a senha: a sessão fica nos cookies do perfil do
 * navegador, que o próprio Edge/Chrome cifra com a conta do Windows.
 */
export async function entrarNoIndeed(log: Log, esperaMin = 5): Promise<boolean> {
  const ctx = await navegador(true);
  const page = await ctx.newPage();
  try {
    await page.goto('https://secure.indeed.com/auth?hl=pt_BR&co=BR', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const bloqueio = await detectarBloqueio(page);
    if (bloqueio === 'bloqueado') throw new Error('o Indeed bloqueou o acesso deste navegador; tente de novo mais tarde');
    log('aguardo', `Entre na sua conta do Indeed na janela que abriu (até ${esperaMin} min). O AutoCV não vê nem guarda a sua senha.`);
    const fim = Date.now() + esperaMin * 60_000;
    let fora = 0;
    while (Date.now() < fim) {
      await new Promise(r => setTimeout(r, 2000));
      if (page.isClosed()) return false;
      // Saiu das telas de autenticação e continua fora por algumas checagens seguidas = entrou
      fora = INDEED.login.test(page.url()) ? 0 : fora + 1;
      if (fora >= 3) return true;
    }
    return false;
  } finally {
    await page.close().catch(() => {});
  }
}

async function candidatar(vaga: Vaga, dados: DadosCandidatura, log: Log): Promise<ResultadoCandidatura> {
  const ctx = await navegador(true); // o Indeed bloqueia navegador oculto
  let page = await ctx.newPage();
  page.setDefaultTimeout(12000);
  const captura = async (nome: string) => {
    const caminho = join(DIRS.gerados, `${nome}-${Date.now()}.png`);
    await page.screenshot({ path: caminho, fullPage: true }).catch(() => {});
    return caminho;
  };
  try {
    log('info', `Abrindo ${vaga.url} (janela visível: o Indeed bloqueia navegador oculto).`);
    await page.goto(vaga.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const bloqueio = await detectarBloqueio(page);
    if (bloqueio)
      return {
        status: 'erro',
        motivo:
          bloqueio === 'bloqueado'
            ? 'o Indeed bloqueou o acesso deste navegador (captcha/anti-robô); tente mais tarde'
            : 'o Indeed pediu verificação (captcha); resolva na janela do navegador e tente de novo',
        captura: await captura('indeed-bloqueio'),
      };

    // A busca só traz um trecho da descrição; a página da vaga tem o texto completo
    const descricao = (
      (await page
        .locator(INDEED.descricao)
        .first()
        .textContent({ timeout: 8000 })
        .catch(() => '')) ?? ''
    )
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (descricao.length > vaga.descricao.length) vagas.atualizar(vaga.id, { descricao, skills: extrairSkills(`${vaga.titulo}\n${descricao}`) });

    let botao = page.locator(INDEED.botaoCandidatar).first();
    if (!(await botao.isVisible().catch(() => false))) botao = page.locator('button, a').filter({ hasText: INDEED.textoCandidatar }).first();
    if (!(await botao.isVisible().catch(() => false)))
      return { status: 'erro', motivo: 'a vaga não oferece mais "Candidatar-se facilmente" (vaga encerrada ou candidatura no site da empresa)', captura: await captura('indeed-sem-botao') };

    // O formulário pode abrir na mesma aba ou numa nova
    const novaAba = ctx.waitForEvent('page', { timeout: 8000 }).catch(() => null);
    await botao.click();
    const aba = await novaAba;
    if (aba) {
      await aba.waitForLoadState('domcontentloaded').catch(() => {});
      page = aba;
      page.setDefaultTimeout(12000);
    } else {
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    }
    if (INDEED.login.test(page.url()))
      return { status: 'erro', motivo: 'faça login no Indeed (Plataformas › Indeed › Entrar): sem sessão o Indeed não abre a candidatura', captura: await captura('indeed-login') };
    await page
      .locator('input, textarea, button')
      .first()
      .waitFor({ state: 'visible', timeout: 20000 })
      .catch(() => {});

    const r = await executarFormulario(page, dados, log, { convencoes: INDEED.convencoes });
    const resumo: ResumoFormulario = {
      etapas: r.etapas.length,
      campos: r.etapas.reduce((s, e) => s + e.campos.length, 0),
      perguntas: r.perguntasRespondidas,
      typeform: r.typeform,
      incomum: r.etapas.length > 6 || r.etapas.some(e => e.campos.some(c => c.tipo === 'desconhecido')),
    };
    formularios.salvar(vaga.id, { etapas: r.etapas, resumo, em: new Date().toISOString() });
    log('info', `Estrutura do formulário do Indeed: ${resumo.etapas} etapa(s), ${resumo.campos} campo(s).`);
    if (r.resultado.status === 'ensaio') return { ...r.resultado, captura: await captura('indeed-ensaio'), formulario: resumo };
    if (r.resultado.status === 'erro') return { ...r.resultado, captura: await captura('indeed-erro'), formulario: resumo };
    if (r.resultado.status === 'pergunta') return r.resultado;
    return { ...r.resultado, formulario: resumo };
  } catch (e) {
    return { status: 'erro', motivo: (e as Error).message.split('\n')[0], captura: await captura('indeed-erro') };
  } finally {
    await page.close().catch(() => {});
  }
}

export const indeed: PlatformAdapter = { id: 'indeed', nome: 'Indeed', buscarVagas, candidatar };
registrarAdapter(indeed);
