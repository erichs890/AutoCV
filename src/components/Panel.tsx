import { useId, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

const tons = {
  blue: 'bg-blue-dark',
  green: 'bg-green-deep',
  slate: 'bg-side-top',
  purple: 'bg-purple',
  orange: 'bg-orange-deep',
};

interface Props {
  icon: LucideIcon;
  title: string;
  aside?: ReactNode;
  tone?: keyof typeof tons;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export default function Panel({ icon: Icon, title, aside, tone = 'blue', className = '', bodyClassName = 'p-3.5', children }: Props) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={`flex flex-col overflow-hidden rounded-lg border border-panel-border bg-panel ${className}`}>
      <header className={`flex h-[35px] shrink-0 items-center gap-2 px-3 text-white ${tons[tone]}`}>
        <Icon size={16} aria-hidden />
        <h2 id={id} className="text-[13px] font-bold">
          {title}
        </h2>
        {aside && <div className="ml-auto text-[11px]">{aside}</div>}
      </header>
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
