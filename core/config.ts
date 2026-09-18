import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// AUTOCV_PORTA / AUTOCV_DIR: só para rodar uma segunda instância (testes) sem tocar nos dados de uso real
export const PORTA = Number(process.env.AUTOCV_PORTA) || 4780;

// Tudo do usuário fica em %LOCALAPPDATA%\AutoCV (fora do repositório)
export const DIR = process.env.AUTOCV_DIR ?? join(process.env.LOCALAPPDATA ?? homedir(), 'AutoCV');
export const DIRS = {
  curriculos: join(DIR, 'curriculos'), // PDFs originais enviados
  gerados: join(DIR, 'gerados'), // PDFs adaptados e capturas de tela
  navegador: join(DIR, 'navegador'), // perfil persistente do Edge/Chrome (cookies)
};
for (const d of Object.values(DIRS)) mkdirSync(d, { recursive: true });

export const DB_PATH = join(DIR, 'autocv.sqlite');
