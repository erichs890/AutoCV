import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { writeFile, rm } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Arquivo, Estado } from '../src/types.ts';
import './platforms/inhire/index.ts';
import { entrarNoIndeed } from './platforms/indeed/index.ts';
import { PORTA, DIRS } from './config.ts';
import { eventos, emitir, type Evento } from './events.ts';
import { apagarTudo, kv, log, vagas } from './storage/db.ts';
import { ler, montarEstado, salvarParcial } from './estado.ts';
import { buscarVagas, candidatarAgora, decidirPreview, iniciarLaco, ligarRobo, removerDaFila, repontuar, responder } from './queue.ts';
import { pdfParaMarkdown } from './resume/pdfToMd.ts';
import { analisarCurriculo } from './resume/analyzer.ts';
import { markdownParaPdf } from './resume/mdToPdf.ts';
import { gerarAdaptacao } from './candidatura.ts';
import { fecharNavegador } from './browser.ts';
import { salvarIA, testarIA } from './ia.ts';
import { adicionarEmpresa, importarSeed, migrarTenantsAntigos, salvarDescoberta } from './platforms/inhire/discovery.ts';
import { empresas } from './storage/db.ts';

const SCORE_VERSAO = 4; // suba ao mudar calcularScore: as vagas abertas são repontuadas ao iniciar
import { buscarEmpresas } from './queue.ts';

const registrar = log.registrar;

function corpo(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const partes: Buffer[] = [];
    req.on('data', c => partes.push(c));
    req.on('end', () => resolve(Buffer.concat(partes)));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, dados: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(dados));
}

/** Upload de currículo: bytes crus no corpo, nome no query. Extrai Markdown e monta o perfil de busca. */
async function receberCurriculo(nome: string, bytes: Buffer): Promise<Arquivo> {
  const id = Date.now();
  const caminho = join(DIRS.curriculos, `${id}-${nome.replace(/[^\w.-]+/g, '_')}`);
  await writeFile(caminho, bytes);
  const arquivo: Arquivo = { id, nome, tamanho: bytes.length, enviadoEm: new Date().toISOString(), caminho };
  if (/\.pdf$/i.test(nome)) {
    try {
      arquivo.markdown = await pdfParaMarkdown(caminho);
      arquivo.perfilBusca = analisarCurriculo(arquivo.markdown);
      registrar('sucesso', `Currículo ${nome} analisado: ${arquivo.perfilBusca.area}, ${arquivo.perfilBusca.senioridade}, ${arquivo.perfilBusca.skills.length} competências.`);
    } catch (e) {
      registrar('alerta', `Não consegui ler o texto de ${nome}: ${(e as Error).message}. A busca de vagas precisa de um PDF com texto.`);
    }
  } else {
    registrar('alerta', `${nome} salvo, mas só PDFs são analisados por enquanto. Envie o currículo em PDF para a busca funcionar.`);
  }
  return arquivo;
}

const rotas: Record<string, (req: IncomingMessage, res: ServerResponse, url: URL) => Promise<void> | void> = {
  'GET /estado': (_r, res) => json(res, 200, montarEstado()),
  'POST /estado': async (req, res) => {
    const parcial = JSON.parse((await corpo(req)).toString('utf8')) as Partial<Estado>;
    const antes = ler.automacao();
    const localAntes = JSON.stringify(ler.localizacao());
    salvarParcial(parcial);
    const a = parcial.automacao;
    const filtrosMudaram = a && (a.area !== antes.area || a.cargo !== antes.cargo || a.senioridade !== antes.senioridade || a.scoreMinimo !== antes.scoreMinimo);
    if (filtrosMudaram || (parcial.perfil && JSON.stringify(ler.localizacao()) !== localAntes)) repontuar();
    json(res, 200, montarEstado());
  },
  // Indeed: login manual na janela do robô (o AutoCV não vê nem guarda a senha); só então a plataforma fica conectada
  'POST /indeed/entrar': async (_req, res) => {
    try {
      const entrou = await entrarNoIndeed(registrar);
      if (!entrou) return json(res, 400, { erro: 'Não detectei o login no Indeed (tempo esgotado ou janela fechada). Tente de novo.' });
      const automacao = ler.automacao();
      salvarParcial({ conexoes: { ...ler.conexoes(), indeed: { conectadaEm: new Date().toISOString() } }, automacao: { ...automacao, plataformas: Array.from(new Set([...automacao.plataformas, 'indeed'])) } });
      registrar('sucesso', 'Indeed conectado: a sessão fica no perfil do navegador do robô.');
      json(res, 200, { ok: true });
    } catch (e) {
      json(res, 400, { erro: (e as Error).message });
    }
  },
  'POST /log': async (req, res) => {
    const { tipo, msg } = JSON.parse((await corpo(req)).toString('utf8'));
    json(res, 200, registrar(tipo, msg));
  },
  'POST /curriculos': async (req, res, url) => {
    const nome = url.searchParams.get('nome') ?? 'curriculo.pdf';
    const arquivo = await receberCurriculo(nome, await corpo(req));
    kv.set('curriculos', [arquivo, ...ler.curriculos()]);
    emitir({ tipo: 'estado' });
    json(res, 200, arquivo);
  },
  'DELETE /curriculos': async (_r, res, url) => {
    const id = Number(url.searchParams.get('id'));
    const lista = ler.curriculos();
    const alvo = lista.find(c => c.id === id);
    if (alvo?.caminho) await rm(alvo.caminho, { force: true });
    kv.set('curriculos', lista.filter(c => c.id !== id));
    emitir({ tipo: 'estado' });
    json(res, 200, { ok: true });
  },
  'GET /arquivo': (_r, res, url) => {
    // Serve PDFs/capturas gerados localmente (só dentro das pastas do AutoCV)
    const caminho = url.searchParams.get('caminho') ?? '';
    const permitido = Object.values(DIRS).some(d => caminho.startsWith(d));
    if (!permitido || !existsSync(caminho)) return json(res, 404, { erro: 'arquivo não encontrado' });
    res.writeHead(200, { 'content-type': caminho.endsWith('.png') ? 'image/png' : 'application/pdf' });
    res.end(readFileSync(caminho));
  },
  'POST /buscar': async (_r, res) => {
    // Varredura forçada; roda em segundo plano e o front acompanha por eventos/log
    void buscarVagas(true).catch(e => registrar('erro', `Varredura falhou: ${(e as Error).message}`));
    json(res, 200, { ok: true });
  },
  'POST /empresas': async (req, res) => {
    const { entrada } = JSON.parse((await corpo(req)).toString('utf8'));
    try {
      json(res, 200, await adicionarEmpresa(String(entrada ?? ''), 'manual', registrar));
    } catch (e) {
      json(res, 400, { erro: (e as Error).message }); // validação esperada: não vai para o log de atividade
    }
  },
  'DELETE /empresas': (_r, res, url) => {
    empresas.remover(url.searchParams.get('subdominio') ?? '');
    emitir({ tipo: 'estado' });
    json(res, 200, { ok: true });
  },
  'POST /empresas/ativar': async (req, res) => {
    const { subdominio, ativo } = JSON.parse((await corpo(req)).toString('utf8'));
    empresas.atualizar(subdominio, { ativo: !!ativo, falhas: 0 });
    emitir({ tipo: 'estado' });
    json(res, 200, { ok: true });
  },
  'POST /empresas/seed': (_r, res) => {
    importarSeed(registrar, true);
    emitir({ tipo: 'estado' });
    json(res, 200, { total: empresas.listar().length });
  },
  'POST /descoberta': async (req, res) => {
    salvarDescoberta(JSON.parse((await corpo(req)).toString('utf8')));
    emitir({ tipo: 'estado' });
    json(res, 200, montarEstado().descoberta);
  },
  'POST /descoberta/buscar': (_r, res) => {
    // Demora minutos (Common Crawl + validação); roda em segundo plano e o front acompanha por eventos/log
    void buscarEmpresas().catch(e => registrar('alerta', `Descoberta de empresas falhou: ${(e as Error).message}`));
    json(res, 200, { ok: true });
  },
  'POST /candidatar': async (req, res) => {
    candidatarAgora(JSON.parse((await corpo(req)).toString('utf8')).id);
    json(res, 200, { ok: true });
  },
  'POST /fila/remover': async (req, res) => {
    removerDaFila(JSON.parse((await corpo(req)).toString('utf8')).id);
    json(res, 200, { ok: true });
  },
  'POST /responder': async (req, res) => {
    const { id, resposta, salvar } = JSON.parse((await corpo(req)).toString('utf8'));
    responder(id, resposta, !!salvar);
    json(res, 200, { ok: true });
  },
  'POST /preview': async (req, res) => {
    const { id, decisao } = JSON.parse((await corpo(req)).toString('utf8'));
    decidirPreview(id, decisao);
    json(res, 200, { ok: true });
  },
  'POST /preview/gerar': async (req, res) => {
    // Adaptação sob demanda (botão "Currículo adaptado"): gera (IA se houver, senão regras), guarda na vaga, não envia nada
    const { id, refazer } = JSON.parse((await corpo(req)).toString('utf8'));
    const vaga = vagas.get(id);
    const md = ler.curriculos()[0]?.markdown;
    if (!vaga || !md) return json(res, 400, { erro: 'vaga ou currículo principal ausente' });
    const a = vaga.adaptado && !refazer ? vaga.adaptado : await gerarAdaptacao(md, vaga);
    emitir({ tipo: 'estado' });
    json(res, 200, { ...a, original: md });
  },
  'POST /preview/pdf': async (req, res) => {
    // Gera (ou regenera) o PDF da adaptação guardada e devolve o caminho para abrir
    const { id } = JSON.parse((await corpo(req)).toString('utf8'));
    const vaga = vagas.get(id);
    const md = ler.curriculos()[0]?.markdown;
    if (!vaga || !md) return json(res, 400, { erro: 'vaga ou currículo principal ausente' });
    const a = vaga.adaptado ?? (await gerarAdaptacao(md, vaga));
    const pdf = join(DIRS.gerados, `preview_${vaga.id.replace(/[^a-z0-9]/gi, '_')}.pdf`);
    await markdownParaPdf(a.markdown, pdf, ler.automacao().mostrarNavegador);
    vagas.atualizar(id, { adaptado: { ...a, pdf } });
    emitir({ tipo: 'estado' });
    json(res, 200, { pdf });
  },
  'POST /ia': async (req, res) => {
    salvarIA(JSON.parse((await corpo(req)).toString('utf8')));
    registrar('info', 'Configuração de IA atualizada.');
    emitir({ tipo: 'estado' });
    json(res, 200, montarEstado().ia);
  },
  'POST /ia/testar': async (_r, res) => {
    try {
      json(res, 200, { ok: true, msg: await testarIA() });
    } catch (e) {
      json(res, 200, { ok: false, msg: (e as Error).message });
    }
  },
  'POST /robo': async (req, res) => {
    ligarRobo(!!JSON.parse((await corpo(req)).toString('utf8')).ligar);
    json(res, 200, { ok: true });
  },
  'POST /limpar': async (_r, res) => {
    apagarTudo();
    await fecharNavegador();
    emitir({ tipo: 'estado' });
    json(res, 200, { ok: true });
  },
  'GET /eventos': (req, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write(':ok\n\n');
    const enviar = (e: Evento) => res.write(`data: ${JSON.stringify(e)}\n\n`);
    eventos.on('evento', enviar);
    const ping = setInterval(() => res.write(':ping\n\n'), 25000);
    req.on('close', () => {
      eventos.off('evento', enviar);
      clearInterval(ping);
    });
  },
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORTA}`);
  const origem = req.headers.origin ?? '';
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origem)) {
    res.setHeader('access-control-allow-origin', origem);
    res.setHeader('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('access-control-allow-headers', 'content-type');
  }
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  const rota = rotas[`${req.method} ${url.pathname}`];
  if (!rota) return json(res, 404, { erro: 'rota não encontrada' });
  try {
    await rota(req, res, url);
  } catch (e) {
    registrar('erro', `${req.method} ${url.pathname}: ${(e as Error).message}`);
    if (!res.headersSent) json(res, 500, { erro: (e as Error).message });
  }
}).listen(PORTA, '127.0.0.1', () => {
  console.log(`AutoCV núcleo em http://localhost:${PORTA} — dados em ${DIRS.curriculos.replace(/[\\/]curriculos$/, '')}`);
  migrarTenantsAntigos(registrar);
  if (ler.conexoes().inhire) importarSeed(registrar);
  if (kv.get<number>('scoreVersao', 0) < SCORE_VERSAO) {
    repontuar(); // vagas gravadas por versões anteriores do score
    kv.set('scoreVersao', SCORE_VERSAO);
  }
  iniciarLaco();
});

process.on('SIGINT', async () => {
  await fecharNavegador();
  process.exit(0);
});
