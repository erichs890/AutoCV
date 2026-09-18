import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { writeFile, rm } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Arquivo, Estado } from '../src/types.ts';
import './platforms/inhire/index.ts';
import { PORTA, DIRS } from './config.ts';
import { eventos, emitir, type Evento } from './events.ts';
import { apagarTudo, kv, log, vagas } from './storage/db.ts';
import { ler, montarEstado, salvarParcial } from './estado.ts';
import { buscarVagas, candidatarAgora, decidirPreview, iniciarLaco, ligarRobo, removerDaFila, responder } from './queue.ts';
import { pdfParaMarkdown } from './resume/pdfToMd.ts';
import { analisarCurriculo } from './resume/analyzer.ts';
import { adaptarCurriculo, validarAdaptacao } from './resume/adapter.ts';
import { fecharNavegador } from './browser.ts';
import { salvarIA, testarIA } from './ia.ts';

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
    salvarParcial(JSON.parse((await corpo(req)).toString('utf8')) as Partial<Estado>);
    json(res, 200, montarEstado());
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
  'POST /buscar': async (_r, res) => json(res, 200, { novas: await buscarVagas() }),
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
    // Preview sob demanda (tela Currículo): adaptação + relatório, sem enviar nada
    const { id } = JSON.parse((await corpo(req)).toString('utf8'));
    const vaga = vagas.get(id);
    const md = ler.curriculos()[0]?.markdown;
    if (!vaga || !md) return json(res, 400, { erro: 'vaga ou currículo principal ausente' });
    const a = adaptarCurriculo(md, vaga);
    json(res, 200, { ...a, original: md, termosNovos: validarAdaptacao(md, a.markdown) });
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
  iniciarLaco();
});

process.on('SIGINT', async () => {
  await fecharNavegador();
  process.exit(0);
});
