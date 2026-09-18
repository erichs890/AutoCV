import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Estado, LinhaLog } from './types';
import { URL_CORE, api, post } from './api';

export type { Arquivo, ConfigAutomacao, Conexao, Estado, Perfil } from './types';

// O estado vive no núcleo local (core/). O front só lê (GET /estado + eventos SSE) e grava parciais (POST /estado).
export interface Aviso {
  id: number;
  nivel: 'sucesso' | 'erro' | 'info';
  msg: string;
}

interface Contexto {
  estado: Estado | null; // null enquanto carrega ou se o núcleo estiver fora do ar
  offline: boolean;
  avisos: Aviso[];
  fecharAviso: (id: number) => void;
  salvar: (mudanca: Partial<Estado>) => Promise<void>;
  registrar: (tipo: LinhaLog['tipo'], msg: string) => void;
  limpar: () => Promise<void>;
  recarregar: () => Promise<void>;
}

const Ctx = createContext<Contexto>(null!);

export function ProvedorEstado({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [offline, setOffline] = useState(false);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const timer = useRef<number>(undefined);

  const recarregar = useCallback(async () => {
    try {
      setEstado(await api<Estado>('/estado'));
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    void recarregar();
    const fonte = new EventSource(`${URL_CORE}/eventos`);
    fonte.onmessage = ev => {
      const e = JSON.parse(ev.data) as { tipo: string; nivel?: Aviso['nivel']; msg?: string };
      if (e.tipo === 'aviso' && e.msg) {
        const id = Date.now() + Math.random();
        setAvisos(a => [...a, { id, nivel: e.nivel ?? 'info', msg: e.msg! }]);
        window.setTimeout(() => setAvisos(a => a.filter(x => x.id !== id)), 6000);
      }
      // Qualquer evento → recarrega (com debounce); o estado é pequeno
      clearTimeout(timer.current);
      timer.current = window.setTimeout(recarregar, 150);
    };
    fonte.onopen = () => void recarregar();
    fonte.onerror = () => setOffline(true);
    const ping = window.setInterval(() => {
      if (fonte.readyState === EventSource.CLOSED) void recarregar();
    }, 5000);
    return () => {
      fonte.close();
      clearInterval(ping);
    };
  }, [recarregar]);

  const salvar = useCallback(async (mudanca: Partial<Estado>) => {
    setEstado(e => (e ? { ...e, ...mudanca } : e)); // otimista
    setEstado(await post<Estado>('/estado', mudanca));
  }, []);

  const registrar = useCallback<Contexto['registrar']>((tipo, msg) => {
    void post('/log', { tipo, msg });
  }, []);

  const limpar = useCallback(async () => {
    await post('/limpar');
    await recarregar();
  }, [recarregar]);

  const fecharAviso = useCallback((id: number) => setAvisos(a => a.filter(x => x.id !== id)), []);

  const valor = useMemo(() => ({ estado, offline, avisos, fecharAviso, salvar, registrar, limpar, recarregar }), [estado, offline, avisos, fecharAviso, salvar, registrar, limpar, recarregar]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

/** Nas telas, o estado já está carregado (o App só as renderiza depois). */
export function useEstado() {
  const ctx = useContext(Ctx);
  return { ...ctx, estado: ctx.estado! };
}

export const useEstadoBruto = () => useContext(Ctx);
