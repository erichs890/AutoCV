import { useState } from 'react';
import { ChartBar, Plug, Plus, RefreshCw, Search, ShieldCheck, Timer, TriangleAlert, Unplug } from 'lucide-react';
import type { Plataforma } from '../types';
import Panel from '../components/Panel';
import Modal from '../components/Modal';
import { emBreve, getPlataformas } from '../mocks/plataformas';

const badges = {
  conectada: ['bg-green-deep text-white', 'Conectado'],
  erro: ['bg-orange-deep text-white', 'Erro de conexão'],
  disponivel: ['border border-panel-border bg-page-bg text-ink', 'Não conectado'],
} as const;

export default function Plataformas() {
  const [plataformas, setPlataformas] = useState(getPlataformas);
  const [busca, setBusca] = useState('');
  const [conectando, setConectando] = useState<Plataforma | null>(null);

  const conta = (estado: Plataforma['estado']) => plataformas.filter(p => p.estado === estado).length;
  const visiveis = plataformas.filter(p => p.nome.toLowerCase().includes(busca.trim().toLowerCase()));
  const comDados = plataformas.filter(p => p.estado !== 'disponivel');
  const max = Math.max(...comDados.map(p => p.vagasSemana), 1);

  const atualizar = (id: string, mudancas: Partial<Plataforma>) => setPlataformas(ps => ps.map(p => (p.id === id ? { ...p, ...mudancas } : p)));
  function conectar() {
    if (conectando) atualizar(conectando.id, { estado: 'conectada', sync: 'agora mesmo' });
    setConectando(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-panel-border bg-panel px-3 py-[9px]">
        <p className="text-[13px] font-bold">
          {conta('conectada')} plataformas conectadas{' '}
          <span className="text-xs font-normal text-ink-soft">
            • {conta('erro')} com erro • {conta('disponivel')} disponíveis
          </span>
        </p>
        <label className="relative ml-auto">
          <Search size={14} aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-soft" />
          <input type="search" aria-label="Buscar plataforma" placeholder="Buscar plataforma..." value={busca} onChange={e => setBusca(e.target.value)} className="field h-7 w-[230px] rounded-[13px] pl-8" />
        </label>
        <button type="button" className="btn btn-primary" onClick={() => setConectando(plataformas.find(p => p.estado === 'disponivel') ?? null)}>
          <Plus size={16} aria-hidden />
          Adicionar nova plataforma
        </button>
      </div>

      <ul className="grid grid-cols-4 gap-3.5 max-lg:grid-cols-2 max-md:grid-cols-1">
        {visiveis.map(p => {
          const [badge, rotulo] = badges[p.estado];
          const nome = <span className="sr-only"> {p.nome}</span>;
          return (
            <li key={p.id} className={`flex min-h-[155px] flex-col gap-2.5 rounded-lg border bg-panel p-3 ${p.estado === 'erro' ? 'border-orange' : 'border-panel-border'}`}>
              <div className="flex items-center gap-2.5">
                <span aria-hidden className={`flex size-[42px] shrink-0 items-center justify-center rounded-[10px] text-[17px] font-bold text-white ${p.cor}`}>
                  {p.sigla}
                </span>
                <div className="flex flex-col items-start gap-1">
                  <h3 className="text-[15px] font-bold">{p.nome}</h3>
                  <span className={`inline-flex items-center gap-[5px] rounded-[9px] px-2 py-0.5 text-[10px] font-bold ${badge}`}>
                    <span aria-hidden className="size-1.5 rounded-full bg-current" />
                    {rotulo}
                  </span>
                </div>
              </div>
              <p className="text-xs">
                {p.estado === 'conectada' ? `${p.vagasSemana} vagas encontradas essa semana` : p.estado === 'erro' ? 'Sessão expirada — refaça o login' : 'Conecte para buscar vagas automaticamente'}
              </p>
              <p className="text-[11px] text-ink-soft">{p.sync ? `Última sincronização: ${p.sync}` : '—'}</p>
              <div className="mt-auto grid grid-cols-2 gap-2">
                {p.estado === 'conectada' && (
                  <>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => atualizar(p.id, { estado: 'disponivel', sync: '' })}>
                      <Unplug size={14} aria-hidden />
                      Desconectar{nome}
                    </button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => atualizar(p.id, { sync: 'agora mesmo' })}>
                      <RefreshCw size={14} aria-hidden />
                      Sincronizar{nome}
                    </button>
                  </>
                )}
                {p.estado === 'erro' && (
                  <button type="button" className="btn btn-danger btn-sm col-span-2" onClick={() => setConectando(p)}>
                    <TriangleAlert size={14} aria-hidden />
                    Reconectar{nome}
                  </button>
                )}
                {p.estado === 'disponivel' && (
                  <button type="button" className="btn btn-success btn-sm col-span-2" onClick={() => setConectando(p)}>
                    <Plug size={14} aria-hidden />
                    Conectar{nome}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Panel icon={ChartBar} title="Vagas encontradas por plataforma" aside="últimos 7 dias">
        <ul className="flex flex-col gap-3">
          {comDados.map(p => (
            <li key={p.id} className="flex items-center gap-2.5">
              <span className="w-[90px] shrink-0 text-xs font-bold">{p.nome}</span>
              <div aria-hidden className="h-5 flex-1 rounded-[10px] border border-panel-border bg-page-bg p-0.5">
                {p.estado === 'conectada' && <div className={`h-full rounded-lg ${p.cor}`} style={{ width: `${(p.vagasSemana / max) * 100}%` }} />}
              </div>
              <span className={`w-24 shrink-0 text-right text-xs font-bold tabular-nums ${p.estado === 'conectada' ? '' : 'text-orange-deep'}`}>
                {p.estado === 'conectada' ? `${p.vagasSemana} vagas` : 'sem conexão'}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel icon={Timer} title="Plataformas em breve" tone="slate" bodyClassName="flex flex-col gap-2.5 p-3.5">
        <p className="text-xs text-ink-soft">Estamos trabalhando para conectar estas plataformas ao robô do AutoCV.</p>
        <ul className="grid grid-cols-4 gap-3.5 max-lg:grid-cols-2">
          {emBreve.map(nome => (
            <li key={nome} className="flex items-center gap-2.5 rounded-lg border border-panel-border p-3">
              <span aria-hidden className="flex size-[38px] shrink-0 items-center justify-center rounded-[9px] bg-ink-soft/50 text-[15px] font-bold text-white">
                {nome.slice(0, 2).toLowerCase()}
              </span>
              <div className="flex flex-col items-start gap-1">
                <p className="text-[13px] font-bold text-ink-soft">{nome}</p>
                <span className="rounded bg-amber px-2 py-0.5 text-[10px] font-bold">EM BREVE</span>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Modal
        aberto={conectando !== null}
        onFechar={() => setConectando(null)}
        icon={Plug}
        titulo={`Conectar plataforma — ${conectando?.nome ?? ''}`}
        rodape={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setConectando(null)}>
              Cancelar
            </button>
            <button type="submit" form="form-conectar" className="btn btn-primary">
              <Plug size={16} aria-hidden />
              Conectar agora
            </button>
          </>
        }
      >
        <button type="button" className="btn btn-success w-full py-2.5" onClick={conectar}>
          <ShieldCheck size={18} aria-hidden />
          Conectar via OAuth
        </button>
        <div className="flex items-center gap-2 text-[11px] text-ink-soft">
          <span className="h-px flex-1 bg-panel-border" />
          ou entre com seus dados
          <span className="h-px flex-1 bg-panel-border" />
        </div>
        <form
          id="form-conectar"
          key={conectando?.id}
          className="flex flex-col gap-3"
          onSubmit={e => {
            e.preventDefault();
            conectar();
          }}
        >
          <label>
            <span className="label text-xs">Usuário ou e-mail</span>
            <input name="usuario" type="text" autoComplete="username" required className="field" />
          </label>
          <label>
            <span className="label text-xs">Senha</span>
            <input name="senha" type="password" autoComplete="current-password" required className="field" />
          </label>
          <label className="flex items-center gap-[7px] text-xs">
            <input type="checkbox" name="lembrar" defaultChecked className="size-4" />
            Lembrar desta conexão neste computador
          </label>
        </form>
        <p className="flex gap-2 rounded-[7px] border border-amber bg-amber/15 p-[9px] text-[11px] text-amber-ink">
          <span aria-hidden>🔒</span>
          Seus dados são criptografados e usados apenas para o envio automático de currículos.
        </p>
      </Modal>
    </div>
  );
}
