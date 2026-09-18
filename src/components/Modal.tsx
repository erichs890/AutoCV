import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, type LucideIcon } from 'lucide-react';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  icon: LucideIcon;
  rodape: ReactNode;
  largo?: boolean;
  children: ReactNode;
}

// <dialog>.showModal(): top layer + fundo inerte (prende o foco), Esc nativo e foco devolvido ao gatilho ao fechar
export default function Modal({ aberto, onFechar, titulo, icon: Icon, rodape, largo = false, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const dialog = ref.current!;
    if (aberto && !dialog.open) dialog.showModal();
    if (!aberto && dialog.open) dialog.close();
  }, [aberto]);

  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={id}
      aria-modal="true"
      onClose={onFechar}
      onClick={e => e.target === e.currentTarget && onFechar()}
      className={`m-auto max-w-[calc(100%-24px)] overflow-hidden rounded-[10px] border border-panel-border bg-panel p-0 text-ink shadow-2xl backdrop:bg-black/60 ${largo ? 'w-[960px]' : 'w-[480px]'}`}
    >
      <header className="flex h-10 items-center gap-2 bg-blue-dark px-3 text-white">
        <Icon size={18} aria-hidden />
        <h2 id={id} className="truncate text-sm font-bold">
          {titulo}
        </h2>
        <button type="button" onClick={onFechar} aria-label="Fechar" className="ml-auto flex size-6 shrink-0 items-center justify-center rounded border border-white/40 hover:bg-white/15 active:bg-white/25">
          <X size={14} aria-hidden />
        </button>
      </header>
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-4">{children}</div>
      <footer className="flex flex-wrap justify-end gap-2 border-t border-panel-border bg-page-bg/50 p-3">{rodape}</footer>
    </dialog>,
    document.body,
  );
}
