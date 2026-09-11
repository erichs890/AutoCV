import { useEffect, useState } from 'react';

// ponytail: cada tela mantém seu próprio contador mockado; o horário real virá da API
export default function Countdown({ ativo, className = '' }: { ativo: boolean; className?: string }) {
  const [segundos, setSegundos] = useState(4 * 60 + 32);

  useEffect(() => {
    if (!ativo) return;
    const t = setInterval(() => setSegundos(s => (s > 0 ? s - 1 : 15 * 60)), 1000);
    return () => clearInterval(t);
  }, [ativo]);

  return (
    <span role="timer" className={`tabular-nums ${className}`}>
      {new Date(segundos * 1000).toISOString().slice(11, 19)}
    </span>
  );
}
