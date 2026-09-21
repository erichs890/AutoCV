import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Mostra só os primeiros itens de uma lista longa e deixa o resto atrás de um "Ver mais".
 *
 * A página de Automação tem três listas que crescem sem limite (vagas encontradas, fila, log): juntas,
 * empurravam a configuração e o status para centenas de pixels abaixo da dobra. Aqui a lista nasce curta.
 *
 * `children` recebe a fatia visível para a tela renderizar como já renderizava — o componente não sabe nada
 * sobre o que está dentro de cada item.
 */
export default function VerMais<T>({
  itens,
  inicial = 5,
  passo = 10,
  nome,
  children,
}: {
  itens: T[];
  /** Quantos aparecem antes de qualquer clique. */
  inicial?: number;
  /** Quantos entram a cada "Ver mais"; a partir daí o botão vira "Ver todas". */
  passo?: number;
  /** Plural do que está na lista, para o texto do botão ("vagas", "linhas"). */
  nome: string;
  children: (visiveis: T[]) => React.ReactNode;
}) {
  const [limite, setLimite] = useState(inicial);
  // A lista encolheu (filtro mudou, item saiu): volta ao tamanho curto em vez de ficar com um limite sem sentido
  useEffect(() => {
    setLimite(l => (itens.length <= inicial ? inicial : Math.min(l, Math.max(inicial, itens.length))));
  }, [itens.length, inicial]);

  const restantes = itens.length - limite;
  return (
    <>
      {children(itens.slice(0, limite))}
      {restantes > 0 && (
        <div className="flex items-center gap-2 border-t border-panel-border px-3.5 py-2">
          <button type="button" onClick={() => setLimite(l => l + passo)} className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-dark hover:underline">
            <ChevronDown size={13} aria-hidden />
            Ver mais {Math.min(passo, restantes)} de {restantes} {nome}
          </button>
          {restantes > passo && (
            <button type="button" onClick={() => setLimite(itens.length)} className="text-[11px] font-bold text-ink-soft hover:underline">
              ver todas
            </button>
          )}
        </div>
      )}
      {limite > inicial && restantes <= 0 && (
        <div className="border-t border-panel-border px-3.5 py-2">
          <button type="button" onClick={() => setLimite(inicial)} className="inline-flex items-center gap-1 text-[11px] font-bold text-ink-soft hover:underline">
            <ChevronUp size={13} aria-hidden />
            Mostrar só as {inicial} primeiras
          </button>
        </div>
      )}
    </>
  );
}
