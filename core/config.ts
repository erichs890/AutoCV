import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const PORTA = 4780;

// Tudo do usuário fica em %LOCALAPPDATA%\AutoCV (fora do repositório)
export const DIR = join(process.env.LOCALAPPDATA ?? homedir(), 'AutoCV');
export const DIRS = {
  curriculos: join(DIR, 'curriculos'), // PDFs originais enviados
  gerados: join(DIR, 'gerados'), // PDFs adaptados e capturas de tela
  navegador: join(DIR, 'navegador'), // perfil persistente do Edge/Chrome (cookies)
};
for (const d of Object.values(DIRS)) mkdirSync(d, { recursive: true });

export const DB_PATH = join(DIR, 'autocv.sqlite');
