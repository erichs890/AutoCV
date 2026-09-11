import type { EstadoRobo } from '../types';
import { statusRobo } from './Sidebar';

const pill: Record<EstadoRobo, string> = {
  ativo: 'border-aqua/60 bg-aqua/15 text-green-deep',
  pausado: 'border-panel-border bg-page-bg text-ink',
  erro: 'border-orange/50 bg-orange/10 text-orange-deep',
};

export default function Footer({ robo }: { robo: EstadoRobo }) {
  const status = statusRobo[robo];
  return (
    <footer className="flex h-[30px] shrink-0 items-center gap-2.5 border-t border-panel-border bg-panel px-4 text-[11px] text-ink-soft max-md:hidden">
      <span>AutoCV © 2010 — automação de envio de currículos</span>
      <span className="ml-auto">v1.2 beta</span>
      <span className={`flex items-center gap-1.5 rounded-[9px] border px-[9px] py-px font-bold ${pill[robo]}`}>
        <span aria-hidden className={`size-2 rounded-full ${status.dot}`} />
        {status.texto}
      </span>
    </footer>
  );
}
