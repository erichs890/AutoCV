import { EventEmitter } from 'node:events';
import type { LinhaLog } from '../src/types.ts';

// Eventos que o servidor repassa ao front por SSE (GET /eventos)
export type Evento =
  | { tipo: 'estado' } // algo mudou: o front recarrega o estado
  | { tipo: 'log'; linha: LinhaLog }
  | { tipo: 'aviso'; nivel: 'sucesso' | 'erro' | 'info'; msg: string };

export const eventos = new EventEmitter();
eventos.setMaxListeners(50);

export const emitir = (e: Evento) => eventos.emit('evento', e);
