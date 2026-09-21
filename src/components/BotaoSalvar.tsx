import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Check, CircleCheck } from 'lucide-react';

/**
 * Confirmação de que o "Salvar" funcionou, no lugar onde o usuário está olhando: o próprio botão.
 * O aviso verde no canto da tela pode passar despercebido num formulário longo e rolado; o botão, não.
 *
 * `SalvoEm` guarda a marca de tempo do último salvamento bem-sucedido (Configuracoes.tsx provê).
 * Trocar o valor — mesmo salvando duas vezes seguidas — reacende a animação.
 */
export const SalvoEm = createContext(0);

const DURACAO_SALVO = 2500;

/** true enquanto dura o "Salvo!". `salvoEm` explícito vence o contexto (telas fora das Configurações). */
export function useSalvo(salvoEmProp?: number): boolean {
  const doContexto = useContext(SalvoEm);
  const salvoEm = salvoEmProp ?? doContexto;
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    if (!salvoEm) return;
    setSalvo(true);
    const t = window.setTimeout(() => setSalvo(false), DURACAO_SALVO);
    return () => clearTimeout(t);
  }, [salvoEm]);

  return salvo;
}

export function BotaoSalvar({
  children = 'Salvar alterações',
  className = '',
  salvoEm,
  disabled,
  icone,
  onClick,
  type = 'submit',
}: {
  children?: string;
  className?: string;
  /** Marca de tempo do último salvamento; sem ela, vale o contexto `SalvoEm`. */
  salvoEm?: number;
  disabled?: boolean;
  /** Ícone do estado normal (o de sucesso é sempre o mesmo check). */
  icone?: ReactNode;
  onClick?: () => void;
  type?: 'submit' | 'button';
}) {
  const salvo = useSalvo(salvoEm);
  return (
    <button
      type={type}
      onClick={onClick}
      // Enquanto mostra "Salvo!" o botão fica clicável de novo mesmo se a tela o desabilitaria
      // (o formulário já está limpo) — o que importa é o usuário ver a confirmação, não clicar.
      disabled={disabled && !salvo}
      className={`btn btn-success transition-transform ${salvo ? 'scale-[1.03] ring-2 ring-green-deep/35' : ''} ${className}`}
    >
      {salvo ? <CircleCheck size={16} aria-hidden className="[animation:selo-ok_0.4s_cubic-bezier(0.2,0.7,0.2,1)_both]" /> : (icone ?? <Check size={16} aria-hidden />)}
      {salvo ? 'Salvo!' : children}
    </button>
  );
}
