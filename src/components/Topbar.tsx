import { Bell, ChevronDown, Menu, Search } from 'lucide-react';
import { getNaoLidas, getPerfil } from '../mocks/usuario';

interface Props {
  titulo: string;
  onAbrirMenu: () => void;
}

export default function Topbar({ titulo, onAbrirMenu }: Props) {
  const naoLidas = getNaoLidas();
  const { nomeCurto } = getPerfil();

  return (
    <header className="flex h-[58px] shrink-0 items-center gap-[18px] border-b border-panel-border bg-panel px-[18px] max-md:h-[50px] max-md:gap-2.5 max-md:border-black/50 max-md:bg-side-top max-md:px-3">
      <button
        type="button"
        onClick={onAbrirMenu}
        aria-label="Abrir menu"
        className="hidden size-8 items-center justify-center rounded-md border border-white/25 text-white hover:bg-white/10 max-md:flex"
      >
        <Menu size={18} aria-hidden />
      </button>
      <h1 className="text-[19px] font-bold max-md:hidden">{titulo}</h1>
      <span className="hidden text-xl font-bold text-white max-md:block">AutoCV</span>

      <div className="flex-1" />
      <label className="relative max-md:hidden">
        <Search size={16} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-soft" />
        <input type="search" aria-label="Buscar vaga ou plataforma" placeholder="Buscar vaga, plataforma..." className="field h-[31px] w-[400px] rounded-[14px] pl-9 text-[13px] max-lg:w-[260px]" />
      </label>
      <div className="flex-1 max-md:hidden" />

      <button
        type="button"
        aria-label={naoLidas > 0 ? `${naoLidas} notificações não lidas` : 'Notificações'}
        className="relative rounded-md p-1 text-ink-soft hover:bg-page-bg hover:text-ink max-md:text-white max-md:hover:bg-white/10"
      >
        <Bell size={20} aria-hidden />
        {naoLidas > 0 && (
          <span aria-hidden className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-orange-deep text-[10px] font-bold text-white">
            {naoLidas}
          </span>
        )}
      </button>

      <button
        type="button"
        aria-label={`${nomeCurto} — menu do usuário`}
        className="flex items-center gap-2 rounded-lg border border-panel-border px-2 py-1 hover:bg-page-bg max-md:border-0 max-md:p-0"
      >
        <span aria-hidden className="flex size-[30px] items-center justify-center rounded-full bg-purple text-xs font-bold text-white">
          MP
        </span>
        <span className="text-[13px] font-bold max-md:hidden">{nomeCurto}</span>
        <ChevronDown size={16} aria-hidden className="text-ink-soft max-md:hidden" />
      </button>
    </header>
  );
}
