import { useReducer, useRef, useState, type ReactNode } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FileText, GripVertical, Hourglass, ListOrdered, Pause, Play, SlidersHorizontal, Terminal, X } from 'lucide-react';
import type { AppContexto } from '../App';
import type { LinhaLog } from '../types';
import Panel from '../components/Panel';
import Countdown from '../components/Countdown';
import { getPlataformas } from '../mocks/plataformas';
import { getCurriculos, areas } from '../mocks/curriculo';
import { getFila, getLog, getResumoFila } from '../mocks/fila';
import { statusRobo } from '../components/Sidebar';

const SALARIO = { min: 1000, max: 15000, passo: 500 };
const regimes = [
  ['remoto', 'Remoto'],
  ['hibrido', 'Híbrido'],
  ['presencial', 'Presencial'],
];
const titulos = { ativo: 'Robô rodando', pausado: 'Robô pausado', erro: 'Robô com erro' };
const coresLog: Record<LinhaLog['tipo'], string> = {
  sucesso: 'text-aqua',
  info: 'text-white/85',
  aguardo: 'text-white/70',
  erro: 'text-orange-light',
  alerta: 'text-amber',
};

const inicial = { plataformas: ['linkedin', 'catho', 'gupy'], curriculo: 'cv1', salarioMin: 3500, salarioMax: 6000, regimes: ['remoto', 'hibrido'] };
type Config = typeof inicial;

const alternar = (lista: string[], v: string) => (lista.includes(v) ? lista.filter(x => x !== v) : [...lista, v]);
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = (v: number) => (v - SALARIO.min) / (SALARIO.max - SALARIO.min);

export default function Automacao() {
  const { robo, setRobo } = useOutletContext<AppContexto>();
  const [cfg, set] = useReducer((s: Config, a: Partial<Config>) => ({ ...s, ...a }), inicial);
  const [fila, setFila] = useState(getFila);
  const arrastado = useRef<number | null>(null);

  const plataformas = getPlataformas().filter(p => p.estado !== 'disponivel');
  const nomesSelecionados = plataformas.filter(p => cfg.plataformas.includes(p.id)).map(p => p.nome);
  const lista = nomesSelecionados.length ? new Intl.ListFormat('pt-BR', { type: 'conjunction' }).format(nomesSelecionados) : 'nenhuma plataforma';
  const extra = getResumoFila().naFila - getFila().length;
  const ativo = robo === 'ativo';

  function mover(de: number, para: number) {
    if (para < 0 || para >= fila.length) return;
    const nova = [...fila];
    nova.splice(para, 0, ...nova.splice(de, 1));
    setFila(nova);
  }

  return (
    <div className="stagger grid grid-cols-[1fr_380px] items-start gap-[15px] max-lg:grid-cols-1">
      <div className="flex flex-col gap-4">
        <section aria-label="Status do robô" className="flex flex-wrap items-center gap-3.5 rounded-lg border border-black/50 bg-side-bottom px-3.5 py-3 text-white">
          <span className={`relative flex size-[34px] shrink-0 items-center justify-center rounded-full border-2 ${ativo ? 'border-aqua/40' : 'border-white/20'}`}>
            {ativo && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-aqua/30" />}
            <span aria-hidden className={`size-3.5 rounded-full ${statusRobo[robo].dot}`} />
          </span>
          <div role="status" className="min-w-[180px] flex-1">
            <p className={`text-base font-bold ${ativo ? 'text-aqua' : ''}`}>{titulos[robo]}</p>
            <p className="text-xs text-white/70">
              {ativo ? 'Enviando para' : 'Plataformas:'} {lista}
            </p>
          </div>
          <div className="rounded-[7px] border border-white/10 bg-black/40 px-3.5 py-1.5 text-center">
            <p className="text-[9px] font-bold tracking-[0.15em] text-white/60 uppercase">Próximo envio em</p>
            <Countdown ativo={ativo} className="text-2xl font-bold text-aqua" />
          </div>
          <button type="submit" form="form-automacao" className="btn btn-success btn-lg" disabled={ativo}>
            <Play size={18} aria-hidden />
            Iniciar automação
          </button>
          <button type="button" className="btn btn-danger btn-lg" disabled={!ativo} onClick={() => setRobo('pausado')}>
            <Pause size={18} aria-hidden />
            Pausar
          </button>
        </section>

        <Panel icon={SlidersHorizontal} title="Configuração da automação" bodyClassName="p-3.5">
          <form
            id="form-automacao"
            className="flex flex-col gap-4"
            onSubmit={e => {
              e.preventDefault();
              // ponytail: sem API ainda; aqui entra o POST com new FormData(e.currentTarget)
              setRobo('ativo');
            }}
          >
            <Passo n={1} titulo="Escolher plataformas">
              <div className="grid grid-cols-4 gap-2.5 max-lg:grid-cols-2">
                {plataformas.map(p => {
                  const erro = p.estado === 'erro';
                  return (
                    <label key={p.id} className={`flex items-center gap-2 rounded-[7px] border border-panel-border px-2.5 py-2 has-checked:border-blue-dark has-checked:ring-1 has-checked:ring-blue-dark ${erro ? 'opacity-60' : 'hover:border-ink-soft'}`}>
                      <input type="checkbox" name="plataformas" value={p.id} disabled={erro} checked={cfg.plataformas.includes(p.id)} onChange={() => set({ plataformas: alternar(cfg.plataformas, p.id) })} className="size-[17px] shrink-0" />
                      <span>
                        <span className="block text-xs font-bold">{p.nome}</span>
                        <span className="block text-[10px] text-ink-soft">{erro ? 'erro de conexão' : `${p.vagasSemana} vagas compatíveis`}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </Passo>

            <Passo n={2} titulo="Escolher currículo">
              <div className="grid grid-cols-2 gap-3 max-lg:grid-cols-1">
                {getCurriculos().map(c => (
                  <label key={c.id} className="flex items-center gap-2.5 rounded-[7px] border border-panel-border p-[9px] hover:border-ink-soft has-checked:border-green-dark has-checked:ring-1 has-checked:ring-green-dark">
                    <FileText size={32} strokeWidth={1.25} aria-hidden className="shrink-0 text-ink-soft" />
                    <span className="flex-1">
                      <span className="block text-xs font-bold">{c.arquivo}</span>
                      <span className="block text-[11px] text-ink-soft">
                        {c.versao} • {c.foco} • {c.nivel}
                      </span>
                    </span>
                    <input type="radio" name="curriculo" value={c.id} checked={cfg.curriculo === c.id} onChange={() => set({ curriculo: c.id })} className="size-[17px] accent-green-dark" />
                  </label>
                ))}
              </div>
            </Passo>

            <Passo n={3} titulo="Definir filtros de vaga">
              <div className="grid grid-cols-3 gap-2.5 max-lg:grid-cols-1">
                <label>
                  <span className="label">Área</span>
                  <select name="area" defaultValue={areas[0]} className="field">
                    {areas.map(a => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="label">Cargo</span>
                  <input name="cargo" defaultValue="Desenvolvedor(a) Back-end" className="field" />
                </label>
                <label>
                  <span className="label">Localização</span>
                  <select name="local" defaultValue="São Paulo / Remoto" className="field">
                    <option>São Paulo / Remoto</option>
                    <option>São Paulo</option>
                    <option>Remoto</option>
                  </select>
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
                    <div
                      aria-hidden
                      className="absolute top-1/2 h-[9px] -translate-y-1/2 rounded-[5px] bg-blue-dark"
                      style={{ left: `calc(9px + (100% - 18px) * ${pct(cfg.salarioMin)})`, width: `calc((100% - 18px) * ${pct(cfg.salarioMax) - pct(cfg.salarioMin)})` }}
                    />
                    <input type="range" name="salarioMin" aria-label="Salário mínimo" aria-valuetext={brl(cfg.salarioMin)} min={SALARIO.min} max={SALARIO.max} step={SALARIO.passo} value={cfg.salarioMin} onChange={e => set({ salarioMin: Math.min(+e.target.value, cfg.salarioMax) })} />
                    <input type="range" name="salarioMax" aria-label="Salário máximo" aria-valuetext={brl(cfg.salarioMax)} min={SALARIO.min} max={SALARIO.max} step={SALARIO.passo} value={cfg.salarioMax} onChange={e => set({ salarioMax: Math.max(+e.target.value, cfg.salarioMin) })} />
                  </div>
                </div>
                <fieldset>
                  <legend className="label">Regime</legend>
                  <div className="flex">
                    {regimes.map(([valor, rotulo]) => (
                      <label
                        key={valor}
                        className="-ml-px border border-panel-border bg-panel px-3.5 py-[7px] text-xs font-bold first:ml-0 first:rounded-l-md last:rounded-r-md hover:bg-page-bg has-checked:relative has-checked:border-blue-dark has-checked:bg-blue-dark has-checked:text-white"
                      >
                        <input type="checkbox" name="regimes" value={valor} checked={cfg.regimes.includes(valor)} onChange={() => set({ regimes: alternar(cfg.regimes, valor) })} className="sr-only" />
                        {rotulo}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </Passo>

            <Passo n={4} titulo="Definir timer de envio">
              <div className="flex items-end gap-3.5">
                <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-full bg-orange text-white max-lg:hidden">
                  <Hourglass size={26} />
                </span>
                <div className="grid flex-1 grid-cols-3 gap-2.5 max-lg:grid-cols-1">
                  <label>
                    <span className="label">Intervalo entre envios</span>
                    <select name="intervalo" defaultValue="15" className="field">
                      {[5, 10, 15, 30, 60].map(m => (
                        <option key={m} value={m}>
                          A cada {m} minutos
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="label">Limite de envios por dia</span>
                    <span className="relative block">
                      <input type="number" name="limite" min={1} max={100} defaultValue={40} className="field pr-14 tabular-nums" />
                      <span aria-hidden className="pointer-events-none absolute top-1/2 right-6 -translate-y-1/2 text-xs text-ink-soft">
                        envios
                      </span>
                    </span>
                  </label>
                  <label>
                    <span className="label">Janela de funcionamento</span>
                    <select name="janela" defaultValue="08:00-20:00" className="field">
                      <option value="08:00-20:00">08:00 às 20:00</option>
                      <option value="09:00-18:00">09:00 às 18:00</option>
                      <option value="00:00-23:59">00:00 às 23:59</option>
                    </select>
                  </label>
                </div>
              </div>
            </Passo>
          </form>
        </Panel>
      </div>

      <div className="flex flex-col gap-4">
        <Panel icon={ListOrdered} title="Fila de envio" tone="green" aside={`${fila.length + extra} vagas`} className="h-[650px] max-lg:h-auto" bodyClassName="flex flex-col bg-side-bottom">
          <ol className="flex-1 overflow-y-auto">
            {fila.map((item, i) => (
              <li
                key={item.id}
                draggable
                onDragStart={() => (arrastado.current = i)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => {
                  if (arrastado.current !== null) mover(arrastado.current, i);
                  arrastado.current = null;
                }}
                className={`flex h-11 items-center gap-2 border-b border-white/10 px-2.5 ${i === 0 ? 'bg-green-deep/50' : ''}`}
              >
                <button
                  type="button"
                  aria-label={`Posição ${i + 1}: ${item.cargo}. Use as setas para reordenar`}
                  onKeyDown={e => {
                    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                    e.preventDefault();
                    mover(i, e.key === 'ArrowUp' ? i - 1 : i + 1);
                  }}
                  className="w-6 cursor-grab text-[11px] font-bold text-white/70 tabular-nums"
                >
                  {String(i + 1).padStart(2, '0')}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-white">{item.cargo}</p>
                  <p className="truncate text-[10px] text-white/60">
                    {item.empresa} • {item.plataforma}
                  </p>
                </div>
                <span className="text-[11px] font-bold text-aqua tabular-nums">{item.horario}</span>
                <button
                  type="button"
                  aria-label={`Remover ${item.cargo} da fila`}
                  onClick={() => setFila(f => f.filter(x => x.id !== item.id))}
                  className="flex size-[17px] items-center justify-center rounded border border-white/25 text-white/80 hover:bg-white/15 active:bg-white/25"
                >
                  <X size={11} aria-hidden />
                </button>
              </li>
            ))}
          </ol>
          <p className="flex items-center gap-2 border-t border-white/10 px-2.5 py-2 text-[11px] text-white/60">
            <GripVertical size={12} aria-hidden />
            Arraste para reordenar a fila
            {extra > 0 && <span className="ml-auto font-bold text-white/85">+{extra} mais</span>}
          </p>
        </Panel>

        <Panel icon={Terminal} title="Log de atividade" tone="slate" className="h-[236px]" bodyClassName="flex flex-col bg-side-bottom">
          <ol aria-label="Eventos recentes" tabIndex={0} className="flex flex-1 flex-col gap-[3px] overflow-y-auto p-2.5">
            {getLog().map(l => (
              <li key={l.hora + l.msg} className="flex gap-1.5 text-[11px]">
                <span className="shrink-0 text-white/50 tabular-nums">[{l.hora}]</span>
                <span className={coresLog[l.tipo]}>{l.msg}</span>
              </li>
            ))}
            <li aria-hidden className="flex items-center gap-1.5 text-xs font-bold text-aqua">
              › <span className="h-[13px] w-[7px] bg-aqua" />
            </li>
          </ol>
        </Panel>
      </div>
    </div>
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
