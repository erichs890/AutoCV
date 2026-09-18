import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  tom: string;
  valor: string | number;
  label: string;
  nota?: string;
}

export default function StatCard({ icon: Icon, tom, valor, label, nota }: Props) {
  return (
    <article className="flex flex-col gap-2.5 rounded-lg border border-panel-border bg-panel p-3.5 max-md:gap-1.5 max-md:p-2.5">
      <div className="flex items-center gap-3 max-md:gap-2">
        <span className={`flex size-[46px] shrink-0 items-center justify-center rounded-xl text-white max-md:size-8 max-md:rounded-[9px] ${tom}`}>
          <Icon size={22} aria-hidden className="max-md:size-4" />
        </span>
        <div>
          <p className="text-[30px] leading-none font-bold tabular-nums max-md:text-[22px]">{valor}</p>
          <p className="mt-1 text-xs text-ink-soft">{label}</p>
        </div>
      </div>
      {nota && <p className="border-t border-panel-border pt-1.5 text-[11px] text-ink-soft max-md:border-0 max-md:pt-0">{nota}</p>}
    </article>
  );
}
