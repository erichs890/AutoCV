import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  tom: string;
  valor: string;
  label: string;
  labelCurto: string;
  delta: number;
  sufixo: string;
}

export default function StatCard({ icon: Icon, tom, valor, label, labelCurto, delta, sufixo }: Props) {
  const positivo = delta >= 0;
  return (
    <article className="flex flex-col gap-2.5 rounded-lg border border-panel-border bg-panel p-3.5 max-md:gap-1.5 max-md:p-2.5">
      <div className="flex items-center gap-3 max-md:gap-2">
        <span className={`flex size-[46px] shrink-0 items-center justify-center rounded-xl text-white max-md:size-8 max-md:rounded-[9px] ${tom}`}>
          <Icon size={22} aria-hidden className="max-md:size-4" />
        </span>
        <div>
          <p className="text-[30px] leading-none font-bold tabular-nums max-md:text-[22px]">{valor}</p>
          <p className="mt-1 text-xs text-ink-soft max-md:hidden">{label}</p>
        </div>
      </div>
      <p className="hidden text-[11px] text-ink-soft max-md:block">{labelCurto}</p>
      <p
        className={`border-t border-panel-border pt-1.5 text-[11px] font-bold max-md:border-0 max-md:pt-0 max-md:text-[10px] ${
          positivo ? 'text-green-deep' : 'text-orange-deep'
        }`}
      >
        <span aria-hidden>{positivo ? '▲' : '▼'}</span>
        <span className="sr-only">{positivo ? 'Alta de' : 'Queda de'}</span> {Math.abs(delta)}
        {sufixo}
      </p>
    </article>
  );
}
