import type { Vaga } from '../src/types.ts';
import { adapters } from './platforms/adapter.ts';
import { candidaturas, kv, log, vagas } from './storage/db.ts';
import { ler } from './estado.ts';
import { emitir } from './events.ts';
import { executarCandidatura, PERGUNTA_LINKEDIN, PERGUNTA_PRETENSAO, PERGUNTA_REGIME } from './candidatura.ts';

const registrar = log.registrar;
let ocupado = false; // uma candidatura por vez, sempre
const BUSCA_A_CADA_MIN = 60;

function dentroDaJanela(janela: string) {
  const [ini, fim] = janela.split('-');
  const agora = new Date().toTimeString().slice(0, 5);
  return agora >= ini && agora <= fim;
}

function enviosHoje() {
  const hoje = new Date().toDateString();
  return candidaturas.listar().filter(c => c.resultado === 'enviada' && new Date(c.enviadaEm).toDateString() === hoje).length;
}

/** Busca vagas em todas as plataformas ativas e grava as novas. Em modo automático, já entram na fila. */
export async function buscarVagas(): Promise<number> {
  const cfg = ler.automacao();
  const principal = ler.curriculos()[0];
  if (!principal?.perfilBusca) {
    registrar('alerta', 'Busca cancelada: envie um currículo para o AutoCV montar o perfil de busca.');
    return 0;
  }
  if (!cfg.tenants.length) {
    registrar('alerta', 'Busca cancelada: nenhuma empresa do InHire configurada em Plataformas.');
    return 0;
  }
  registrar('info', `Buscando vagas em ${cfg.tenants.length} empresa(s)...`);
  let novas = 0;
  for (const id of Object.keys(ler.conexoes())) {
    const adapter = adapters[id];
    if (!adapter) continue;
    const encontradas = await adapter.buscarVagas(principal.perfilBusca, cfg, registrar);
    const existentes = new Set(vagas.listar().map(v => v.id));
    for (const v of encontradas) {
      if (existentes.has(v.id)) {
        vagas.atualizar(v.id, { score: v.score, skills: v.skills, descricao: v.descricao, requisitos: v.requisitos, regime: v.regime });
        continue;
      }
      if (v.score < cfg.scoreMinimo) {
        v.status = 'ignorada';
      } else if (cfg.modo === 'automatico' && cfg.regimes.includes(v.modelo === 'indefinido' ? cfg.regimes[0] : v.modelo)) {
        v.status = 'na_fila';
        v.posicao = vagas.proximaPosicao();
      }
      vagas.salvar(v);
      novas++;
    }
  }
  kv.set('ultimaBusca', new Date().toISOString());
  registrar('sucesso', `Busca concluída: ${novas} vaga(s) nova(s).`);
  emitir({ tipo: 'estado' });
  return novas;
}

/** Modo manual: "Quero me candidatar" — entra na fila e roda em seguida. */
export function candidatarAgora(id: string) {
  const v = vagas.get(id);
  if (!v) throw new Error('vaga não encontrada');
  vagas.atualizar(id, { status: 'na_fila', posicao: vagas.proximaPosicao(), pendencia: undefined, erro: undefined });
  registrar('info', `"${v.titulo}" entrou na fila.`);
  emitir({ tipo: 'estado' });
  void processarProxima(true);
}

export function removerDaFila(id: string) {
  vagas.atualizar(id, { status: 'encontrada', posicao: undefined, pendencia: undefined });
  emitir({ tipo: 'estado' });
}

/** Resposta do usuário a uma pergunta pendente; opcionalmente salva para perguntas parecidas. */
export function responder(id: string, resposta: string, salvar: boolean) {
  const v = vagas.get(id);
  if (!v || v.pendencia?.tipo !== 'pergunta') throw new Error('nada pendente nesta vaga');
  const rotulo = v.pendencia.pergunta.rotulo;
  const perfil = ler.perfil();
  if (rotulo === PERGUNTA_LINKEDIN && perfil) {
    kv.set('perfil', { ...perfil, linkedin: resposta });
    vagas.atualizar(id, { status: 'na_fila', pendencia: undefined });
  } else if (rotulo === PERGUNTA_PRETENSAO && perfil) {
    kv.set('perfil', { ...perfil, pretensao: resposta });
    vagas.atualizar(id, { status: 'na_fila', pendencia: undefined });
  } else if (rotulo.startsWith(PERGUNTA_REGIME)) {
    // Regime escolhido para esta vaga; se for para guardar, vira a preferência padrão
    if (salvar) kv.set('automacao', { ...ler.automacao(), regimePreferido: resposta as 'CLT' | 'PJ' });
    vagas.atualizar(id, { status: 'na_fila', pendencia: undefined, regime: resposta as 'CLT' | 'PJ' });
  } else {
    const perguntas = ler.perguntas();
    const existente = perguntas.find(p => p.pergunta === rotulo);
    if (existente) existente.resposta = resposta;
    else perguntas.push({ id: Date.now(), icone: '', pergunta: rotulo, resposta, personalizada: true });
    // Se não for para guardar, a resposta vale só para esta tentativa: removemos depois de usar
    kv.set('perguntas', perguntas);
    vagas.atualizar(id, { status: 'na_fila', pendencia: undefined, respostaTemporaria: salvar ? undefined : rotulo });
  }
  registrar('info', `Resposta registrada para "${rotulo}".`);
  emitir({ tipo: 'estado' });
  void processarProxima(true);
}

/** Decisão do preview: usar o adaptado, o original, ou desistir desta vaga. */
export function decidirPreview(id: string, decisao: 'adaptado' | 'original' | 'cancelar') {
  const v = vagas.get(id);
  if (!v || v.pendencia?.tipo !== 'aprovacao') throw new Error('nada para aprovar nesta vaga');
  if (decisao === 'cancelar') {
    vagas.atualizar(id, { status: 'encontrada', pendencia: undefined, posicao: undefined });
    registrar('alerta', `Candidatura a "${v.titulo}" cancelada por você.`);
  } else {
    vagas.atualizar(id, { status: 'na_fila', decisaoPreview: decisao, pendencia: decisao === 'adaptado' ? v.pendencia : undefined });
    registrar('info', `Você escolheu enviar o currículo ${decisao} para "${v.titulo}".`);
  }
  emitir({ tipo: 'estado' });
  void processarProxima(true);
}

async function processarProxima(forcar = false) {
  if (ocupado) return;
  const cfg = ler.automacao();
  const proxima = vagas.proximaNaFila();
  if (!proxima) return;
  if (!forcar) {
    if (ler.robo() !== 'ativo' || cfg.modo !== 'automatico') return;
    if (!dentroDaJanela(cfg.janela)) return;
    if (enviosHoje() >= cfg.limiteDiario) return;
    const prox = ler.proximoEnvioEm();
    if (prox && new Date(prox) > new Date()) return;
  }
  ocupado = true;
  try {
    await executarCandidatura(proxima.id);
    const depois = vagas.get(proxima.id);
    if (depois?.respostaTemporaria && depois.status !== 'aguardando_pergunta') {
      kv.set('perguntas', ler.perguntas().filter(p => p.pergunta !== depois.respostaTemporaria));
      vagas.atualizar(proxima.id, { respostaTemporaria: undefined });
    }
  } catch (e) {
    vagas.atualizar(proxima.id, { status: 'erro', erro: (e as Error).message });
    registrar('erro', `Erro inesperado em "${proxima.titulo}": ${(e as Error).message}`);
  } finally {
    ocupado = false;
    emitir({ tipo: 'estado' });
  }
}

let ultimaBuscaAuto = 0;

/** Laço do robô: a cada 20 s decide se busca vagas ou processa a próxima da fila. */
export function iniciarLaco() {
  setInterval(async () => {
    if (ler.robo() !== 'ativo') return;
    const cfg = ler.automacao();
    if (cfg.modo === 'automatico' && Date.now() - ultimaBuscaAuto > BUSCA_A_CADA_MIN * 60000 && dentroDaJanela(cfg.janela)) {
      ultimaBuscaAuto = Date.now();
      await buscarVagas().catch(e => registrar('erro', `Busca automática falhou: ${(e as Error).message}`));
    }
    await processarProxima();
  }, 20000);
}

export function ligarRobo(ligar: boolean) {
  kv.set('robo', ligar ? 'ativo' : 'pausado');
  registrar(ligar ? 'sucesso' : 'alerta', ligar ? `Robô ligado em modo ${ler.automacao().modo === 'automatico' ? 'automático' : 'manual'}.` : 'Robô pausado.');
  if (ligar) ultimaBuscaAuto = 0;
  emitir({ tipo: 'estado' });
}

export const statusFila = (): Vaga[] => vagas.listar();
