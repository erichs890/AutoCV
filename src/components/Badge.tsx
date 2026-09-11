import type { StatusEnvio } from '../types';

// Cores seguem o mockup (Visualizado azul, Enviado verde); sólidas para passar AA em 12px
const estilos: Record<StatusEnvio, string> = {
  Visualizado: 'bg-blue-dark text-white',
  Enviado: 'bg-green-deep text-white',
  Pendente: 'border border-panel-border bg-page-bg text-ink',
  Erro: 'bg-orange-deep text-white',
};

export default function Badge({ status }: { status: StatusEnvio }) {
  return <span className={`inline-flex h-5 items-center rounded-[9px] px-[9px] text-xs font-bold ${estilos[status]}`}>{status}</span>;
}
