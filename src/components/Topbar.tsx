import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useEstado } from '../estado';
import { iniciais } from '../dados';

interface Props {
  titulo: string;
  onAbrirMenu: () => void;
}

export default function Topbar({ titulo, onAbrirMenu }: Props) {
  const { estado } = useEstado();
  const nome = estado.perfil?.nome ?? '';

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

      <Link to="/configuracoes" className="flex items-center gap-2 rounded-lg border border-panel-border px-2 py-1 hover:bg-page-bg max-md:border-0 max-md:p-0">
        <span aria-hidden className="flex size-[30px] items-center justify-center rounded-full bg-purple text-xs font-bold text-white">
          {iniciais(nome)}
        </span>
        <span className="text-[13px] font-bold max-md:hidden">{nome}</span>
      </Link>
    </header>
  );
}
