import { useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { Activity, Bot, FileText, Gauge, GripVertical, ListOrdered, MailOpen, Pause, Play, Plug, Send, Table, Target, Upload, type LucideIcon } from 'lucide-react';
import type { AppContexto } from '../App';
import type { Periodo } from '../types';
import Panel from '../components/Panel';
import Badge from '../components/Badge';
import StatCard from '../components/StatCard';
import BarChart from '../components/BarChart';
import Countdown from '../components/Countdown';
import { getAtividade, getStats } from '../mocks/atividade';
import { getEnvios, POR_PAGINA, TOTAL_ENVIOS } from '../mocks/envios';
import { getFila, getResumoFila } from '../mocks/fila';
import { getPlataforma } from '../mocks/plataformas';
import { getConfig } from '../mocks/usuario';

const iconesStats: Record<string, [LucideIcon, string]> = {
  enviados: [Send, 'bg-blue-dark'],
  compativeis: [Target, 'bg-green-dark'],
  respostas: [MailOpen, 'bg-orange'],
  compatibilidade: [Gauge, 'bg-purple'],
};

const periodos: { id: Periodo; label: string; legenda: string }[] = [
  { id: 'semana', label: 'Semana', legenda: 'Envios por dia — últimos 7 dias' },
  { id: 'mes', label: 'Mês', legenda: 'Envios por semana — últimas 4 semanas' },
  { id: 'ano', label: 'Ano', legenda: 'Envios por mês — 2010' },
];

const TOTAL_PAGINAS = Math.ceil(TOTAL_ENVIOS / POR_PAGINA);
const pg = 'flex h-6 w-[26px] items-center justify-center rounded border text-xs font-bold tabular-nums aria-disabled:cursor-not-allowed aria-disabled:opacity-40';

export default function Painel() {
  const { robo, setRobo } = useOutletContext<AppContexto>();
  const [params] = useSearchParams();
  const [periodo, setPeriodo] = useState<Periodo>('semana');
  const [pagina, setPagina] = useState(1);

  // ?vazio força o estado vazio para revisão visual
  if (!getConfig().roboConfigurado || params.has('vazio')) return <EstadoVazio />;

  const envios = getEnvios(pagina);
  const resumo = getResumoFila();
  const legenda = periodos.find(p => p.id === periodo)!.legenda;
  const inicioJanela = Math.min(Math.max(pagina - 2, 1), TOTAL_PAGINAS - 4);
  const primeiro = (pagina - 1) * POR_PAGINA + 1;
  const irPara = (p: number) => p >= 1 && p <= TOTAL_PAGINAS && setPagina(p);

  return (
    <div className="flex flex-col gap-4 max-md:gap-2.5">
      <section aria-label="Resumo" className="grid grid-cols-4 gap-4 max-md:grid-cols-2 max-md:gap-2.5">
        {getStats().map(s => {
          const [icon, tom] = iconesStats[s.id];
          return <StatCard key={s.id} icon={icon} tom={tom} valor={s.valor.toLocaleString('pt-BR') + s.unidade} label={s.label} labelCurto={s.labelCurto} delta={s.delta} sufixo={s.sufixo} />;
        })}
      </section>

      <div className="grid h-[380px] grid-cols-[1fr_330px] gap-4 max-lg:grid-cols-[1fr_300px] max-md:h-auto max-md:grid-cols-1">
        <Panel icon={Activity} title="Atividade do Robô" className="max-md:hidden" bodyClassName="flex flex-col gap-2.5 p-3.5">
          <div className="flex items-center">
            <p className="text-xs text-ink-soft">{legenda}</p>
            <div role="group" aria-label="Período" className="ml-auto flex">
              {periodos.map(p => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={periodo === p.id}
                  onClick={() => setPeriodo(p.id)}
                  className={`-ml-px border px-2.5 py-1 text-[11px] font-bold first:ml-0 first:rounded-l-md last:rounded-r-md ${
                    periodo === p.id ? 'relative border-blue-dark bg-blue-dark text-white' : 'border-panel-border bg-panel text-ink hover:bg-page-bg'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <BarChart dados={getAtividade(periodo)} legenda={legenda} />
        </Panel>

        <Panel icon={ListOrdered} title="Fila atual do robô" tone="green" bodyClassName="flex flex-col gap-1.5 p-3">
          <div className="flex flex-col items-center gap-0.5 rounded-lg bg-side-bottom p-2 max-md:flex-row max-md:justify-center max-md:gap-2.5">
            <p className="text-[10px] font-bold tracking-[0.15em] text-white/70 uppercase">Próximo envio em</p>
            <Countdown ativo={robo === 'ativo'} className="text-[27px] font-bold text-aqua max-md:text-[22px]" />
          </div>
          <ul className="grid grid-cols-3 gap-2 max-md:hidden">
            {[
              [resumo.naFila, 'na fila', 'text-blue'],
              [resumo.hoje, 'hoje', 'text-green-dark'],
              [resumo.comErro, 'com erro', 'text-orange-deep'],
            ].map(([n, label, cor]) => (
              <li key={label} className="rounded-md border border-panel-border px-1 py-2 text-center">
                <span className={`block text-xl font-bold tabular-nums ${cor}`}>{n}</span>
                <span className="text-[11px] text-ink-soft">{label}</span>
              </li>
            ))}
          </ul>
          <ol aria-label="Próximos envios" className="flex flex-col gap-1.5 max-md:hidden">
            {getFila()
              .slice(0, 2)
              .map(item => (
                <li key={item.id} className="flex items-center gap-2 rounded-md border border-panel-border px-[9px] py-[7px]">
                  <GripVertical size={14} aria-hidden className="text-ink-soft" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">{item.cargo}</p>
                    <p className="text-[11px] text-ink-soft">{item.empresa}</p>
                  </div>
                  <span className="text-[11px] font-bold text-blue-dark tabular-nums">{item.horario}</span>
                </li>
              ))}
          </ol>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-danger" disabled={robo !== 'ativo'} onClick={() => setRobo('pausado')}>
              <Pause size={16} aria-hidden />
              <span>
                Pausar<span className="max-md:hidden"> automação</span>
              </span>
            </button>
            <button type="button" className="btn btn-success" disabled={robo === 'ativo'} onClick={() => setRobo('ativo')}>
              <Play size={16} aria-hidden />
              Retomar
            </button>
          </div>
        </Panel>
      </div>

      <Panel icon={Table} title="Últimos envios" tone="slate" aside={`${TOTAL_ENVIOS} envios no total`} bodyClassName="">
        <div className="overflow-x-auto max-md:hidden">
          <table className="w-full min-w-[860px] border-collapse text-left text-xs">
            <thead className="text-[11px]">
              <tr className="h-[30px] border-b border-panel-border">
                <th scope="col" className="px-3.5 font-bold">Vaga</th>
                <th scope="col" className="w-[200px] font-bold">Empresa</th>
                <th scope="col" className="w-[190px] font-bold">Plataforma</th>
                <th scope="col" className="w-[150px] font-bold">Data / Hora</th>
                <th scope="col" className="w-[144px] pr-3.5 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {envios.map(e => {
                const p = getPlataforma(e.plataforma);
                return (
                  <tr key={e.id} className="h-[38px] border-b border-panel-border/60 last:border-0">
                    <td className="px-3.5 font-bold text-blue-dark">{e.vaga}</td>
                    <td>{e.empresa}</td>
                    <td>
                      <span className="flex items-center gap-[7px]">
                        <span aria-hidden className={`flex size-5 items-center justify-center rounded-[5px] text-[10px] font-bold text-white ${p.cor}`}>
                          {p.sigla}
                        </span>
                        {p.nome}
                      </span>
                    </td>
                    <td className="text-ink-soft tabular-nums">
                      {e.data} {e.hora}
                    </td>
                    <td className="pr-3.5">
                      <Badge status={e.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <ul className="hidden flex-col gap-2 p-2.5 max-md:flex">
          {envios.map(e => (
            <li key={e.id} className="rounded-[7px] border border-panel-border p-[9px]">
              <p className="text-[13px] font-bold text-blue-dark">{e.vaga}</p>
              <div className="mt-1 flex items-center gap-1.5">
                <p className="flex-1 text-[11px] text-ink-soft tabular-nums">
                  {e.empresa} • {getPlataforma(e.plataforma).nome} • {e.hora}
                </p>
                <Badge status={e.status} />
              </div>
            </li>
          ))}
        </ul>

        <nav aria-label="Paginação dos envios" className="flex h-[42px] items-center gap-[5px] border-t border-panel-border px-3.5 max-md:hidden">
          <p className="mr-auto text-[11px] text-ink-soft tabular-nums">
            Mostrando {primeiro}–{primeiro + envios.length - 1} de {TOTAL_ENVIOS}
          </p>
          <button type="button" aria-label="Página anterior" aria-disabled={pagina === 1} onClick={() => irPara(pagina - 1)} className={`${pg} border-panel-border bg-panel hover:bg-page-bg`}>
            «
          </button>
          {Array.from({ length: 5 }, (_, i) => inicioJanela + i).map(p => (
            <button
              key={p}
              type="button"
              aria-label={`Página ${p}`}
              aria-current={p === pagina ? 'page' : undefined}
              onClick={() => irPara(p)}
              className={`${pg} ${p === pagina ? 'border-blue-dark bg-blue-dark text-white' : 'border-panel-border bg-panel hover:bg-page-bg'}`}
            >
              {p}
            </button>
          ))}
          <button type="button" aria-label="Próxima página" aria-disabled={pagina === TOTAL_PAGINAS} onClick={() => irPara(pagina + 1)} className={`${pg} border-panel-border bg-panel hover:bg-page-bg`}>
            »
          </button>
        </nav>
      </Panel>
    </div>
  );
}

const passos: [LucideIcon, string][] = [
  [FileText, '1. Envie seu currículo'],
  [Plug, '2. Conecte plataformas'],
  [Play, '3. Ligue o robô'],
];

function EstadoVazio() {
  return (
    <div className="flex min-h-full items-center justify-center p-[22px] max-md:p-0">
      <section aria-labelledby="vazio-titulo" className="flex w-[620px] max-w-full flex-col items-center gap-3.5 rounded-xl border border-panel-border bg-panel p-9 text-center max-md:p-5">
        <span className="flex size-24 items-center justify-center rounded-full bg-blue-dark text-white">
          <Bot size={44} aria-hidden />
        </span>
        <h2 id="vazio-titulo" className="text-[22px] font-bold">
          Seu robô ainda não está configurado
        </h2>
        <p className="text-sm text-ink-soft">
          Você ainda não configurou seu robô. Vá em Automação para escolher as plataformas, o currículo e o intervalo entre os envios — o AutoCV cuida do resto.
        </p>
        <ol className="grid w-full grid-cols-3 gap-2.5 max-md:grid-cols-1">
          {passos.map(([Icon, texto]) => (
            <li key={texto} className="flex flex-col items-center gap-1.5 rounded-lg border border-panel-border p-3 text-xs font-bold">
              <span className="flex size-[34px] items-center justify-center rounded-[9px] border border-panel-border bg-page-bg">
                <Icon size={16} aria-hidden />
              </span>
              {texto}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap justify-center gap-2.5">
          <Link to="/automacao" className="btn btn-success btn-lg">
            <Play size={18} aria-hidden />
            Configurar automação
          </Link>
          <Link to="/curriculo" className="btn btn-secondary btn-lg">
            <Upload size={18} aria-hidden />
            Enviar currículo
          </Link>
        </div>
      </section>
    </div>
  );
}
