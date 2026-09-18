import type { Vaga } from '../src/types.ts';
import { adapters, PERGUNTA_CIDADE, PERGUNTA_CPF } from './platforms/adapter.ts';
import { candidaturas, kv, log, vagas } from './storage/db.ts';
import { ler } from './estado.ts';
import { emitir } from './events.ts';
import { executarCandidatura, PERGUNTA_LINKEDIN, PERGUNTA_PRETENSAO, PERGUNTA_REGIME } from './candidatura.ts';
import { avaliarVagas, iaAtiva, lerIA } from './ia.ts';
import { descobrirEmpresas, lerDescoberta } from './platforms/inhire/discovery.ts';
import { empresas } from './storage/db.ts';
import { calcularScore } from './resume/score.ts';
import { inferirSenioridade } from './resume/analyzer.ts';

const registrar = log.registrar;
let ocupado = false; // uma candidatura por vez, sempre

function dentroDaJanela(janela: string) {
  const [ini, fim] = janela.split('-');
  const agora = new Date().toTimeString().slice(0, 5);
  return agora >= ini && agora <= fim;
}

function enviosHoje() {
  const hoje = new Date().toDateString();
  return candidaturas.listar().filter(c => c.resultado === 'enviada' && new Date(c.enviadaEm).toDateString() === hoje).length;
}

/** Recalcula o score léxico das vagas abertas com o perfil e os filtros atuais (área, cargo, senioridade). */
export function repontuar(): number {
  const cfg = ler.automacao();
  const perfil = ler.curriculos()[0]?.perfilBusca;
  if (!perfil) return 0;
  const abertas = vagas.listar().filter(v => v.status === 'encontrada' || v.status === 'ignorada');
  for (const v of abertas) {
    const a = calcularScore(v, perfil, { area: cfg.area, cargo: cfg.cargo, senioridade: cfg.senioridade, local: ler.perfil()?.cidade });
    vagas.atualizar(v.id, { score: a.score, motivo: a.motivo, senioridade: v.senioridade ?? inferirSenioridade(v.titulo, v.descricao), status: a.score < cfg.scoreMinimo ? 'ignorada' : 'encontrada' });
  }
  if (abertas.length) {
    registrar('info', `${abertas.length} vaga(s) repontuadas com senioridade ${cfg.senioridade || perfil.senioridade}${cfg.area ? `, área ${cfg.area}` : ''}${cfg.cargo ? `, cargo "${cfg.cargo}"` : ''}.`);
    emitir({ tipo: 'estado' });
  }
  return abertas.length;
}

/**
 * Varredura completa: descoberta (lista de empresas → vagas novas gravadas com score léxico),
 * depois IA re-pontua as novas (se configurada) e, em modo automático com robô ligado, as compatíveis entram na fila.
 */
export async function buscarVagas(): Promise<number> {
  const cfg = ler.automacao();
  const principal = ler.curriculos()[0];
  if (!principal?.perfilBusca) {
    registrar('alerta', 'Varredura cancelada: envie um currículo para o AutoCV montar o perfil de busca.');
    return 0;
  }
  let novas: Vaga[] = [];
  for (const id of Object.keys(ler.conexoes())) {
    const adapter = adapters[id];
    if (adapter) novas = novas.concat(await adapter.buscarVagas(principal.perfilBusca, cfg, registrar));
  }

  // Com IA configurada, ela lê o currículo e pontua cada vaga nova (o léxico já gravado fica de reserva)
  if (novas.length && iaAtiva() && principal.markdown) {
    try {
      const notas = await avaliarVagas(principal.markdown, novas, cfg.senioridade || principal.perfilBusca.senioridade);
      for (const v of novas) {
        const n = notas.get(v.id);
        if (n) {
          v.score = n.score;
          v.motivo = n.motivo;
          vagas.atualizar(v.id, { score: n.score, motivo: n.motivo, status: n.score < cfg.scoreMinimo ? 'ignorada' : 'encontrada' });
        }
      }
      registrar('info', `${lerIA().provedor === 'gemini' ? 'Gemini' : 'Claude'} avaliou ${notas.size} de ${novas.length} vaga(s) nova(s) contra o seu currículo.`);
    } catch (e) {
      registrar('alerta', `Avaliação por IA falhou (${(e as Error).message}); valendo o score por competências.`);
    }
  }

  if (ler.robo() === 'ativo' && cfg.modo === 'automatico') {
    let enfileiradas = 0;
    for (const v of novas) {
      const atual = vagas.get(v.id);
      if (!atual || atual.status !== 'encontrada') continue;
      if (!cfg.regimes.includes(atual.modelo === 'indefinido' ? cfg.regimes[0] : atual.modelo)) continue;
      vagas.atualizar(v.id, { status: 'na_fila', posicao: vagas.proximaPosicao() });
      enfileiradas++;
    }
    if (enfileiradas) registrar('info', `${enfileiradas} vaga(s) compatível(is) entraram na fila.`);
  }
  kv.set('ultimaBusca', new Date().toISOString());
  emitir({ tipo: 'estado' });
  return novas.length;
}

/** Fonte B sob demanda ou agendada (1x/dia): acha empresas novas no InHire pela API de busca. */
export async function buscarEmpresas(): Promise<number> {
  const n = await descobrirEmpresas(ler.curriculos()[0]?.perfilBusca, registrar);
  emitir({ tipo: 'estado' });
  return n;
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
  } else if (rotulo === PERGUNTA_CIDADE && perfil) {
    kv.set('perfil', { ...perfil, cidade: resposta });
    vagas.atualizar(id, { status: 'na_fila', pendencia: undefined });
  } else if (rotulo === PERGUNTA_CPF && perfil) {
    kv.set('perfil', { ...perfil, cpf: resposta.replace(/\D/g, '') });
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

let agendando = false;

/**
 * Laço do núcleo, a cada 20 s:
 *  - revarredura das empresas (Fonte A) a cada `intervaloHoras`, independente do robô estar ligado;
 *  - descoberta de empresas novas (Fonte B) 1x/dia, se ligada e com chave;
 *  - com o robô ligado, processa a próxima candidatura da fila.
 */
export function iniciarLaco() {
  setInterval(async () => {
    if (!agendando) {
      agendando = true;
      try {
        const conectado = !!ler.conexoes().inhire;
        let d = lerDescoberta();
        // Primeiro descobre empresas novas (1x/dia), depois varre — assim as recém-achadas já entram na varredura
        const fonteBVencida = conectado && d.fonteB && (!d.ultimaFonteB || Date.now() - new Date(d.ultimaFonteB).getTime() > 24 * 3600000);
        if (fonteBVencida) await buscarEmpresas().catch(e => registrar('alerta', `Descoberta de empresas falhou: ${(e as Error).message}`));
        d = lerDescoberta();
        const temEmpresas = empresas.listar().some(e => e.ativo);
        const vencida = !d.ultimaVarredura || Date.now() - new Date(d.ultimaVarredura).getTime() > d.intervaloHoras * 3600000;
        if (conectado && vencida && temEmpresas && ler.curriculos()[0]?.perfilBusca) {
          await buscarVagas().catch(e => registrar('erro', `Varredura agendada falhou: ${(e as Error).message}`));
        }
      } finally {
        agendando = false;
      }
    }
    if (ler.robo() === 'ativo') await processarProxima();
  }, 20000);
}

export function ligarRobo(ligar: boolean) {
  kv.set('robo', ligar ? 'ativo' : 'pausado');
  registrar(ligar ? 'sucesso' : 'alerta', ligar ? `Robô ligado em modo ${ler.automacao().modo === 'automatico' ? 'automático' : 'manual'}.` : 'Robô pausado.');
  emitir({ tipo: 'estado' });
}

export const statusFila = (): Vaga[] => vagas.listar();
