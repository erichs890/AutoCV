import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, FileText, Hourglass, ListOrdered, MessageCircleQuestion, Pause, Play, Search, Send, SlidersHorizontal, Sparkles, Target, Terminal, X } from 'lucide-react';
import type { LinhaLog, Vaga } from '../types';
import Panel from '../components/Panel';
import Modal from '../components/Modal';
import { statusRobo } from '../components/Sidebar';
import { useEstado, type ConfigAutomacao } from '../estado';
import { post, urlArquivo } from '../api';
import { AREAS, MODELO, PLATAFORMAS, REGIMES, REGIME_VAGA, STATUS_VAGA, formatarTamanho } from '../dados';

const SALARIO = { min: 1000, max: 15000, passo: 500 };
const titulos = { ativo: 'Robô ligado', pausado: 'Robô parado', erro: 'Robô com erro' };
const coresLog: Record<LinhaLog['tipo'], string> = { sucesso: 'text-aqua', info: 'text-white/85', aguardo: 'text-amber', erro: 'text-orange-light', alerta: 'text-amber' };

const alternar = (lista: string[], v: string) => (lista.includes(v) ? lista.filter(x => x !== v) : [...lista, v]);
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = (v: number) => (v - SALARIO.min) / (SALARIO.max - SALARIO.min);
const cartao = 'rounded-[7px] border border-panel-border hover:border-ink-soft has-checked:border-blue-dark has-checked:ring-1 has-checked:ring-blue-dark';

export default function Automacao() {
  const { estado, salvar, registrar } = useEstado();
  const [cfg, setCfg] = useState<ConfigAutomacao>(estado.automacao);
  const [buscando, setBuscando] = useState(false);
  const set = (mudanca: Partial<ConfigAutomacao>) => setCfg(c => ({ ...c, ...mudanca }));

  const conectadas = PLATAFORMAS.filter(p => estado.conexoes[p.id]);
  const ativo = estado.robo === 'ativo';
  const pendente = estado.vagas.find(v => v.pendencia);
  const encontradas = estado.vagas.filter(v => v.status !== 'ignorada');
  const ignoradas = estado.vagas.length - encontradas.length;

  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await salvar({ automacao: { ...cfg, configurada: true } });
    registrar('sucesso', `Configuração salva: modo ${cfg.modo === 'automatico' ? 'automático' : 'manual'}, ${cfg.adaptar ? 'com' : 'sem'} adaptação de currículo, ensaio ${cfg.ensaio ? 'ligado' : 'desligado'}.`);
    if (!ativo) await post('/robo', { ligar: true });
  }

  async function buscar() {
    setBuscando(true);
    try {
      await post('/buscar');
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="stagger grid grid-cols-[1fr_380px] items-start gap-[15px] max-lg:grid-cols-1">
      <div className="flex flex-col gap-4">
        <section aria-label="Status do robô" className="flex flex-wrap items-center gap-3.5 rounded-lg border border-black/50 bg-side-bottom px-3.5 py-3 text-white">
          <span className={`relative flex size-[34px] shrink-0 items-center justify-center rounded-full border-2 ${ativo ? 'border-aqua/40' : 'border-white/20'}`}>
            {ativo && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-aqua/30" />}
            <span aria-hidden className={`size-3.5 rounded-full ${statusRobo[estado.robo].dot}`} />
          </span>
          <div role="status" className="min-w-[180px] flex-1">
            <p className={`text-base font-bold ${ativo ? 'text-aqua' : ''}`}>{titulos[estado.robo]}</p>
            <p className="text-xs text-white/70">
              {estado.automacao.configurada ? `Modo ${estado.automacao.modo === 'automatico' ? 'automático' : 'manual'} · ${estado.automacao.tenants.length} empresa(s) do InHire` : 'Ainda não configurado'}
              {estado.automacao.ensaio && ' · modo ensaio (nada é enviado)'}
            </p>
          </div>
          <button type="button" className="btn btn-secondary" disabled={buscando} onClick={buscar}>
            <Search size={16} aria-hidden />
            {buscando ? 'Buscando...' : 'Buscar vagas agora'}
          </button>
          {ativo ? (
            <button type="button" className="btn btn-danger" onClick={() => post('/robo', { ligar: false })}>
              <Pause size={16} aria-hidden />
              Pausar
            </button>
          ) : (
            <button type="submit" form="form-automacao" className="btn btn-success">
              <Play size={16} aria-hidden />
              {estado.automacao.configurada ? 'Salvar e ligar' : 'Configurar e ligar'}
            </button>
          )}
        </section>

        {estado.automacao.ensaio && ativo && (
          <p className="rounded-lg border border-amber bg-amber/15 p-3 text-xs text-amber-ink">
            <strong>Modo ensaio ligado:</strong> o robô abre a vaga, preenche o formulário e anexa o currículo, mas não clica em enviar. Confira uma captura de tela na lista abaixo e, quando
            estiver confiante, desligue o ensaio na configuração.
          </p>
        )}

        <Panel icon={Target} title="Vagas encontradas" tone="purple" aside={encontradas.length ? `${encontradas.length} compatíveis${ignoradas ? ` · ${ignoradas} abaixo do mínimo` : ''}` : undefined} bodyClassName="p-0">
          {encontradas.length === 0 ? (
            <p className="p-5 text-center text-xs text-ink-soft">
              {estado.automacao.tenants.length ? 'Nenhuma vaga ainda. Clique em "Buscar vagas agora".' : 'Conecte o InHire e escolha as empresas em Plataformas para buscar vagas.'}
            </p>
          ) : (
            <ul className="divide-y divide-panel-border">
              {encontradas.map(v => (
                <VagaItem key={v.id} vaga={v} manual={estado.automacao.modo === 'manual'} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel icon={SlidersHorizontal} title="Configuração da automação" bodyClassName="p-3.5">
          <form id="form-automacao" className="flex flex-col gap-4" onSubmit={guardar}>
            <Passo n={1} titulo="Modo de operação">
              <div className="grid grid-cols-2 gap-2.5 max-md:grid-cols-1">
                <label className={`flex items-start gap-2.5 p-3 ${cartao}`}>
                  <input type="radio" name="modo" checked={cfg.modo === 'manual'} onChange={() => set({ modo: 'manual' })} className="mt-0.5 size-[17px]" />
                  <span>
                    <span className="block text-xs font-bold">Manual</span>
                    <span className="block text-[11px] text-ink-soft">O robô lista as vagas compatíveis; você escolhe em quais se candidatar com "Quero me candidatar".</span>
                  </span>
                </label>
                <label className={`flex items-start gap-2.5 p-3 ${cartao}`}>
                  <input type="radio" name="modo" checked={cfg.modo === 'automatico'} onChange={() => set({ modo: 'automatico' })} className="mt-0.5 size-[17px]" />
                  <span>
                    <span className="block text-xs font-bold">Automático</span>
                    <span className="block text-[11px] text-ink-soft">O robô busca vagas de hora em hora e se candidata sozinho, respeitando o ritmo abaixo. Pausa só se precisar de você.</span>
                  </span>
                </label>
              </div>
            </Passo>

            <Passo n={2} titulo="Plataformas e currículo">
              {conectadas.length === 0 ? (
                <p className="text-xs text-ink-soft">
                  Nenhuma plataforma conectada.{' '}
                  <Link to="/plataformas" className="font-bold text-blue-dark underline">
                    Conectar o InHire
                  </Link>
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 max-lg:grid-cols-1">
                  {conectadas.map(p => (
                    <label key={p.id} className={`flex items-center gap-2 px-2.5 py-2 ${cartao}`}>
                      <input type="checkbox" checked={cfg.plataformas.includes(p.id)} onChange={() => set({ plataformas: alternar(cfg.plataformas, p.id) })} className="size-[17px] shrink-0" />
                      <span>
                        <span className="block text-xs font-bold">{p.nome}</span>
                        <span className="block text-[10px] text-ink-soft">{cfg.tenants.length} empresa(s)</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {estado.curriculos.length === 0 ? (
                <p className="mt-3 text-xs text-ink-soft">
                  Nenhum currículo enviado.{' '}
                  <Link to="/curriculo" className="font-bold text-blue-dark underline">
                    Enviar currículo
                  </Link>
                </p>
              ) : (
                <div className="mt-3 flex items-center gap-2.5 rounded-[7px] border border-panel-border p-[9px]">
                  <FileText size={26} strokeWidth={1.25} aria-hidden className="shrink-0 text-ink-soft" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold">{estado.curriculos[0].nome}</span>
                    <span className="block text-[11px] text-ink-soft">
                      {formatarTamanho(estado.curriculos[0].tamanho)} · currículo principal (troque na tela Currículo)
                    </span>
                  </span>
                </div>
              )}
            </Passo>

            <Passo n={3} titulo="Filtros de vaga">
              <div className="grid grid-cols-3 gap-2.5 max-lg:grid-cols-1">
                <label>
                  <span className="label">Área</span>
                  <select value={cfg.area} onChange={e => set({ area: e.target.value })} className="field">
                    <option value="">Qualquer (usa a do currículo)</option>
                    {AREAS.map(a => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="label">Cargo</span>
                  <input value={cfg.cargo} onChange={e => set({ cargo: e.target.value })} placeholder="Ex.: Desenvolvedor(a) Back-end" className="field" />
                </label>
                <label>
                  <span className="label">Compatibilidade mínima (%)</span>
                  <input type="number" min={0} max={100} value={cfg.scoreMinimo} onChange={e => set({ scoreMinimo: +e.target.value })} className="field tabular-nums" />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-3.5">
                <div className="min-w-[260px] flex-1">
                  <div className="mb-1.5 flex">
                    <span className="label mb-0">Faixa salarial</span>
                    <output className="ml-auto text-[11px] font-bold text-blue-dark tabular-nums">
                      {brl(cfg.salarioMin)} — {brl(cfg.salarioMax)}
                    </output>
                  </div>
                  <div className="dual-range">
                    <div aria-hidden className="absolute inset-x-0 top-1/2 h-[9px] -translate-y-1/2 rounded-[5px] border border-panel-border bg-page-bg" />
                    <div aria-hidden className="absolute top-1/2 h-[9px] -translate-y-1/2 rounded-[5px] bg-blue-dark" style={{ left: `calc(9px + (100% - 18px) * ${pct(cfg.salarioMin)})`, width: `calc((100% - 18px) * ${pct(cfg.salarioMax) - pct(cfg.salarioMin)})` }} />
                    <input type="range" aria-label="Salário mínimo" aria-valuetext={brl(cfg.salarioMin)} min={SALARIO.min} max={SALARIO.max} step={SALARIO.passo} value={cfg.salarioMin} onChange={e => set({ salarioMin: Math.min(+e.target.value, cfg.salarioMax) })} />
                    <input type="range" aria-label="Salário máximo" aria-valuetext={brl(cfg.salarioMax)} min={SALARIO.min} max={SALARIO.max} step={SALARIO.passo} value={cfg.salarioMax} onChange={e => set({ salarioMax: Math.max(+e.target.value, cfg.salarioMin) })} />
                  </div>
                </div>
                <fieldset>
                  <legend className="label">Modelo de trabalho</legend>
                  <div className="flex">
                    {REGIMES.map(([valor, rotulo]) => (
                      <label key={valor} className="-ml-px border border-panel-border bg-panel px-3.5 py-[7px] text-xs font-bold first:ml-0 first:rounded-l-md last:rounded-r-md hover:bg-page-bg has-checked:relative has-checked:border-blue-dark has-checked:bg-blue-dark has-checked:text-white">
                        <input type="checkbox" checked={cfg.regimes.includes(valor)} onChange={() => set({ regimes: alternar(cfg.regimes, valor) })} className="sr-only" />
                        {rotulo}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </Passo>

            <Passo n={4} titulo="Currículo por vaga">
              <div className="grid grid-cols-3 gap-2.5 max-lg:grid-cols-1">
                <label className={`flex items-center gap-2.5 px-3 py-2.5 ${cartao}`}>
                  <input type="checkbox" checked={cfg.adaptar} onChange={e => set({ adaptar: e.target.checked })} className="size-[17px] shrink-0" />
                  <span>
                    <span className="block text-xs font-bold">Adaptar o currículo para cada vaga</span>
                    <span className="block text-[10px] text-ink-soft">
                      {estado.ia.provedor !== 'nenhum' && estado.ia.chaveDefinida ? `Reescrita por ${estado.ia.provedor === 'gemini' ? 'Gemini' : 'Claude'} (${estado.ia.modelo}) + validação. ` : 'Só regras: reordena e destaca o que já está no currículo. '}
                      Nunca inventa.{' '}
                      <Link to="/configuracoes?tab=ia" className="font-bold text-blue-dark underline">
                        Configurar IA
                      </Link>
                    </span>
                  </span>
                </label>
                <label>
                  <span className="label">Antes de enviar</span>
                  <select value={cfg.preview} onChange={e => set({ preview: e.target.value as ConfigAutomacao['preview'] })} disabled={!cfg.adaptar} className="field">
                    <option value="mostrar">Mostrar o currículo adaptado e pedir aprovação</option>
                    <option value="direto">Enviar direto, sem mostrar</option>
                  </select>
                </label>
                <label>
                  <span className="label">Se a vaga aceitar CLT e PJ</span>
                  <select value={cfg.regimePreferido} onChange={e => set({ regimePreferido: e.target.value as ConfigAutomacao['regimePreferido'] })} className="field">
                    <option value="CLT">Prefiro CLT</option>
                    <option value="PJ">Prefiro PJ</option>
                    <option value="perguntar">Perguntar sempre</option>
                  </select>
                </label>
              </div>
            </Passo>

            <Passo n={5} titulo="Ritmo de envio">
              <div className="flex items-end gap-3.5">
                <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-full bg-orange text-white max-lg:hidden">
                  <Hourglass size={26} />
                </span>
                <div className="grid flex-1 grid-cols-3 gap-2.5 max-lg:grid-cols-1">
                  <label>
                    <span className="label">Intervalo entre candidaturas</span>
                    <select value={cfg.intervalo} onChange={e => set({ intervalo: +e.target.value })} className="field">
                      {[5, 10, 15, 30, 60].map(m => (
                        <option key={m} value={m}>
                          A cada {m} minutos
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="label">Limite por dia</span>
                    <input type="number" min={1} max={100} value={cfg.limiteDiario} onChange={e => set({ limiteDiario: +e.target.value })} className="field tabular-nums" />
                  </label>
                  <label>
                    <span className="label">Janela de funcionamento</span>
                    <select value={cfg.janela} onChange={e => set({ janela: e.target.value })} className="field">
                      <option value="08:00-20:00">08:00 às 20:00</option>
                      <option value="09:00-18:00">09:00 às 18:00</option>
                      <option value="00:00-23:59">Qualquer horário</option>
                    </select>
                  </label>
                </div>
              </div>
            </Passo>

            <Passo n={6} titulo="Segurança">
              <div className="grid grid-cols-2 gap-2.5 max-lg:grid-cols-1">
                <label className={`flex items-center gap-2.5 px-3 py-2.5 ${cartao}`}>
                  <input type="checkbox" checked={cfg.ensaio} onChange={e => set({ ensaio: e.target.checked })} className="size-[17px] shrink-0" />
                  <span>
                    <span className="block text-xs font-bold">Modo ensaio (não envia)</span>
                    <span className="block text-[10px] text-ink-soft">Preenche e anexa, tira uma captura e para antes de enviar. Recomendado nas primeiras vezes.</span>
                  </span>
                </label>
                <label className={`flex items-center gap-2.5 px-3 py-2.5 ${cartao}`}>
                  <input type="checkbox" checked={cfg.mostrarNavegador} onChange={e => set({ mostrarNavegador: e.target.checked })} className="size-[17px] shrink-0" />
                  <span>
                    <span className="block text-xs font-bold">Mostrar o navegador enquanto trabalha</span>
                    <span className="block text-[10px] text-ink-soft">Abre uma janela do Edge/Chrome para você acompanhar cada passo.</span>
                  </span>
                </label>
              </div>
            </Passo>
          </form>
        </Panel>
      </div>

      <div className="flex flex-col gap-4">
        <Panel icon={ListOrdered} title="Fila de envio" tone="green" aside={estado.fila.length > 0 ? `${estado.fila.length} vagas` : undefined} bodyClassName="flex flex-col">
          {estado.fila.length === 0 ? (
            <p className="p-4 text-center text-xs text-ink-soft">{estado.automacao.modo === 'manual' ? 'Escolha vagas na lista ao lado com "Quero me candidatar".' : 'A fila enche sozinha quando o robô encontrar vagas compatíveis.'}</p>
          ) : (
            <ol className="flex-1 overflow-y-auto">
              {estado.fila.map((v, i) => (
                <li key={v.id} className="flex h-12 items-center gap-2 border-b border-panel-border px-2.5">
                  <span className="w-6 text-[11px] font-bold text-ink-soft tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">{v.titulo}</p>
                    <p className="truncate text-[10px] text-ink-soft">{v.empresa}</p>
                  </div>
                  <span className={`rounded-[9px] px-2 py-0.5 text-[10px] font-bold ${STATUS_VAGA[v.status].classe}`}>{STATUS_VAGA[v.status].rotulo}</span>
                  <button type="button" aria-label={`Tirar ${v.titulo} da fila`} disabled={v.status === 'em_andamento'} onClick={() => post('/fila/remover', { id: v.id })} className="btn btn-secondary size-[26px] p-0">
                    <X size={13} aria-hidden />
                  </button>
                </li>
              ))}
            </ol>
          )}
          {estado.proximoEnvioEm && ativo && (
            <p className="border-t border-panel-border px-2.5 py-2 text-[11px] text-ink-soft tabular-nums">Próxima candidatura liberada às {new Date(estado.proximoEnvioEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
          )}
        </Panel>

        <Panel icon={Terminal} title="Log de atividade" tone="slate" className="h-[300px]" bodyClassName="flex flex-col bg-side-bottom">
          {estado.log.length === 0 ? (
            <p className="p-4 text-center text-xs text-white/70">Nada registrado ainda.</p>
          ) : (
            <ol aria-label="Eventos recentes" tabIndex={0} className="flex flex-1 flex-col gap-[3px] overflow-y-auto p-2.5">
              {estado.log.map((l, i) => (
                <li key={`${l.hora}-${i}`} className="flex gap-1.5 text-[11px]">
                  <span className="shrink-0 text-white/50 tabular-nums">[{l.hora}]</span>
                  <span className={coresLog[l.tipo]}>{l.msg}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      {pendente && <Pendencia vaga={pendente} />}
    </div>
  );
}

function VagaItem({ vaga: v, manual }: { vaga: Vaga; manual: boolean }) {
  const st = STATUS_VAGA[v.status];
  const podeCandidatar = ['encontrada', 'erro', 'ensaio'].includes(v.status);
  return (
    <li className="flex flex-wrap items-center gap-3 px-3.5 py-3">
      <div className="w-14 shrink-0 text-center">
        <span className={`block text-xl font-bold tabular-nums ${v.score >= 60 ? 'text-green-deep' : v.score >= 40 ? 'text-amber-ink' : 'text-ink-soft'}`}>{v.score}%</span>
        <span className="text-[10px] text-ink-soft">compatível</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-[13px] font-bold">
          <a href={v.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-dark hover:underline">
            {v.titulo}
            <ExternalLink size={12} aria-hidden />
          </a>
          <span className={`rounded-[9px] px-2 py-0.5 text-[10px] font-bold ${st.classe}`}>{st.rotulo}</span>
        </p>
        <p className="text-[11px] text-ink-soft">
          {v.empresa} · {MODELO[v.modelo]} · {v.local || 'local não informado'} · {REGIME_VAGA[v.regime]}
        </p>
        {v.skills.length > 0 && <p className="mt-0.5 text-[11px] text-ink-soft">Pede: {v.skills.join(', ')}</p>}
        {v.erro && <p className="mt-0.5 text-[11px] font-bold text-orange-deep">{v.erro}</p>}
        {v.captura && (
          <a href={urlArquivo(v.captura)} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-blue-dark hover:underline">
            Ver captura de tela
          </a>
        )}
      </div>
      {manual && podeCandidatar && (
        <button type="button" className="btn btn-primary btn-sm" onClick={() => post('/candidatar', { id: v.id })}>
          <Send size={14} aria-hidden />
          Quero me candidatar
        </button>
      )}
    </li>
  );
}

function Pendencia({ vaga }: { vaga: Vaga }) {
  const p = vaga.pendencia!;
  const [resposta, setResposta] = useState('');
  const [guardar, setGuardar] = useState(true);

  if (p.tipo === 'pergunta') {
    const q = p.pergunta;
    return (
      <Modal
        aberto
        onFechar={() => post('/fila/remover', { id: vaga.id })}
        icon={MessageCircleQuestion}
        titulo="O InHire perguntou"
        rodape={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => post('/fila/remover', { id: vaga.id })}>
              Pular esta vaga
            </button>
            <button type="button" className="btn btn-primary" disabled={!resposta.trim()} onClick={() => post('/responder', { id: vaga.id, resposta: resposta.trim(), salvar: guardar })}>
              Responder e continuar
            </button>
          </>
        }
      >
        <p className="text-xs text-ink-soft">
          Vaga <strong className="text-ink">{vaga.titulo}</strong> em {vaga.empresa}
        </p>
        <p className="text-sm font-bold">{q.rotulo}</p>
        {q.tipo === 'opcoes' && q.opcoes?.length ? (
          <div className="flex flex-col gap-1.5">
            {q.opcoes.map(o => (
              <label key={o} className={`flex items-center gap-2 px-3 py-2 text-xs ${cartao}`}>
                <input type="radio" name="opcao" value={o} checked={resposta === o} onChange={() => setResposta(o)} className="size-4" />
                {o}
              </label>
            ))}
          </div>
        ) : (
          <textarea value={resposta} onChange={e => setResposta(e.target.value)} rows={3} placeholder="Sua resposta" className="field" autoFocus />
        )}
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={guardar} onChange={e => setGuardar(e.target.checked)} className="size-4" />
          Guardar esta resposta para perguntas parecidas
        </label>
      </Modal>
    );
  }

  return (
    <Modal
      aberto
      onFechar={() => post('/preview', { id: vaga.id, decisao: 'cancelar' })}
      icon={Sparkles}
      titulo={`Currículo adaptado — ${vaga.titulo}`}
      largo
      rodape={
        <>
          <button type="button" className="btn btn-secondary" onClick={() => post('/preview', { id: vaga.id, decisao: 'cancelar' })}>
            Cancelar candidatura
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => post('/preview', { id: vaga.id, decisao: 'original' })}>
            Usar o original
          </button>
          <button type="button" className="btn btn-success" onClick={() => post('/preview', { id: vaga.id, decisao: 'adaptado' })}>
            Aprovar e enviar
          </button>
        </>
      }
    >
      <div className="rounded-lg border border-panel-border bg-page-bg p-3">
        <p className="label mb-1.5">O que mudou</p>
        <ul className="list-disc pl-4 text-xs">
          {p.diff.map(d => (
            <li key={d}>{d}</li>
          ))}
        </ul>
        <p className="mt-1.5 text-[11px] text-ink-soft">Nenhuma competência, cargo ou dado foi acrescentado: a validação compara palavra por palavra com o original.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
        {[
          ['Original', p.original],
          ['Adaptado', p.adaptado],
        ].map(([t, md]) => (
          <div key={t}>
            <p className="label">{t}</p>
            <pre className="max-h-[360px] overflow-auto rounded-lg border border-panel-border p-2.5 font-mono text-[11px] whitespace-pre-wrap">{md}</pre>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function Passo({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 border-b border-panel-border pb-3 last:border-0">
      <legend className="mb-[9px] flex items-center gap-2 text-sm font-bold">
        <span className="flex size-[22px] items-center justify-center rounded-full bg-blue-dark text-xs text-white">{n}</span>
        {titulo}
      </legend>
      {children}
    </fieldset>
  );
}
