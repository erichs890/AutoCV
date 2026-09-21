import type { PontoAtividade } from '../types';

export default function BarChart({ dados, legenda }: { dados: PontoAtividade[]; legenda: string }) {
  const max = Math.max(...dados.map(d => d.valor), 1);
  return (
    <ul aria-label={legenda} className="flex min-h-0 flex-1 gap-3.5 rounded-md border border-panel-border px-2 pt-2.5">
      {dados.map(d => (
        <li key={d.rotulo} className="flex flex-1 flex-col items-center">
          <div className="flex w-full flex-1 flex-col items-center justify-end gap-[5px]">
            <span className="text-[11px] font-bold tabular-nums">{d.valor}</span>
            <div aria-hidden className={`w-full rounded-t-[5px] ${d.valor === max && d.valor > 0 ? 'bg-blue-dark' : 'bg-blue'}`} style={{ height: `${(d.valor / max) * 85}%` }} />
          </div>
          <span className="py-1 text-[11px] text-ink-soft">{d.rotulo}</span>
        </li>
      ))}
    </ul>
  );
}
