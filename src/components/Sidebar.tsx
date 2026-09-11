import { NavLink } from 'react-router-dom';
import { Bot, FileText, Gauge, Plug, Settings, type LucideIcon } from 'lucide-react';
import type { EstadoRobo } from '../types';
import { getPlano } from '../mocks/usuario';

export const navItens: { to: string; label: string; curto: string; icon: LucideIcon }[] = [
  { to: '/painel', label: 'Painel', curto: 'Painel', icon: Gauge },
  { to: '/curriculo', label: 'Currículo', curto: 'Currículo', icon: FileText },
  { to: '/plataformas', label: 'Plataformas', curto: 'Plataformas', icon: Plug },
  { to: '/automacao', label: 'Automação', curto: 'Automação', icon: Bot },
  { to: '/configuracoes', label: 'Configurações', curto: 'Config.', icon: Settings },
];

export const statusRobo: Record<EstadoRobo, { texto: string; dot: string }> = {
  ativo: { texto: 'Robô ativo', dot: 'bg-aqua' },
  pausado: { texto: 'Robô pausado', dot: 'bg-ink-soft' },
  erro: { texto: 'Robô com erro', dot: 'bg-orange' },
};

interface Props {
  robo: EstadoRobo;
  aberto: boolean;
  onFechar: () => void;
}

export default function Sidebar({ robo, aberto, onFechar }: Props) {
  const { nome, usados, limite } = getPlano();
  const status = statusRobo[robo];

  return (
    <>
      {aberto && (
        <button type="button" aria-label="Fechar menu" onClick={onFechar} className="fixed inset-0 z-30 bg-black/60 md:hidden" />
      )}
      <aside
        onKeyDown={e => e.key === 'Escape' && onFechar()}
        className={`flex w-[220px] shrink-0 flex-col border-r border-black/50 bg-linear-to-b from-side-top to-side-bottom max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 ${aberto ? '' : 'max-md:hidden'}`}
      >
        <div className="flex h-[91px] shrink-0 flex-col justify-center gap-2 border-b border-black/50 bg-white/5 px-4">
          <span className="text-[30px] leading-none font-bold tracking-[-0.5px] text-white">AutoCV</span>
          <span className="text-[11px] text-white/70">envio automático de currículos</span>
        </div>

        <nav aria-label="Principal" className="flex flex-col gap-[3px] px-2 py-2.5">
          {navItens.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onFechar}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-2.5 py-[9px] text-sm font-bold transition-colors ${
                  isActive ? 'bg-blue-dark text-white ring-1 ring-blue-deep ring-inset' : 'text-white/80 hover:bg-white/10 hover:text-white active:bg-white/15'
                }`
              }
            >
              <Icon size={18} aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex-1" />

        <div className="p-3">
          <div className="flex flex-col gap-1.5 rounded-lg border border-white/15 bg-white/5 p-3">
            <p className="text-[13px] font-bold text-white">{nome}</p>
            <p className="text-[11px] text-white/70">
              {usados} de {limite} envios este mês
            </p>
            <div
              role="progressbar"
              aria-label="Envios usados este mês"
              aria-valuemin={0}
              aria-valuemax={limite}
              aria-valuenow={usados}
              className="h-3 rounded-md border border-black/40 bg-black/40 p-px"
            >
              <div className="h-full rounded-[5px] bg-aqua" style={{ width: `${(usados / limite) * 100}%` }} />
            </div>
          </div>
        </div>

        <div role="status" className="flex h-10 shrink-0 items-center gap-2 border-t border-black/50 px-4 text-xs font-bold">
          <span aria-hidden className={`size-2.5 rounded-full ${status.dot}`} />
          <span className={robo === 'ativo' ? 'text-aqua' : 'text-white/80'}>{status.texto}</span>
        </div>
      </aside>
    </>
  );
}
