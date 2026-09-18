import { DatabaseSync } from 'node:sqlite';
import { DB_PATH } from '../config.ts';
import { emitir } from '../events.ts';
import type { Candidatura, LinhaLog, Vaga } from '../../src/types.ts';

export const db = new DatabaseSync(DB_PATH);
db.exec(`
  create table if not exists kv (chave text primary key, valor text not null);
  create table if not exists vagas (
    id text primary key, dados text not null, status text not null,
    score integer not null default 0, posicao integer, atualizada_em text not null
  );
  create table if not exists candidaturas (id integer primary key autoincrement, enviada_em text not null, dados text not null);
  create table if not exists log (id integer primary key autoincrement, hora text not null, tipo text not null, msg text not null);
`);

// Blobs JSON por chave: perfil, curriculos, conexoes, automacao, robo, perguntas, notificacoes...
export const kv = {
  get<T>(chave: string, padrao: T): T {
    const linha = db.prepare('select valor from kv where chave = ?').get(chave) as { valor: string } | undefined;
    return linha ? (JSON.parse(linha.valor) as T) : padrao;
  },
  set(chave: string, valor: unknown) {
    db.prepare('insert into kv (chave, valor) values (?, ?) on conflict(chave) do update set valor = excluded.valor').run(chave, JSON.stringify(valor));
  },
};

export const vagas = {
  salvar(v: Vaga) {
    db.prepare(
      `insert into vagas (id, dados, status, score, posicao, atualizada_em) values (?, ?, ?, ?, ?, ?)
       on conflict(id) do update set dados = excluded.dados, status = excluded.status, score = excluded.score, posicao = excluded.posicao, atualizada_em = excluded.atualizada_em`,
    ).run(v.id, JSON.stringify(v), v.status, v.score, v.posicao ?? null, v.atualizadaEm);
  },
  get(id: string): Vaga | undefined {
    const l = db.prepare('select dados from vagas where id = ?').get(id) as { dados: string } | undefined;
    return l ? (JSON.parse(l.dados) as Vaga) : undefined;
  },
  listar(): Vaga[] {
    return (db.prepare('select dados from vagas order by score desc, atualizada_em desc').all() as { dados: string }[]).map(l => JSON.parse(l.dados) as Vaga);
  },
  atualizar(id: string, patch: Partial<Vaga>): Vaga | undefined {
    const atual = vagas.get(id);
    if (!atual) return undefined;
    const nova = { ...atual, ...patch, atualizadaEm: new Date().toISOString() };
    vagas.salvar(nova);
    return nova;
  },
  proximaNaFila(): Vaga | undefined {
    const l = db.prepare("select dados from vagas where status = 'na_fila' order by posicao asc, score desc limit 1").get() as { dados: string } | undefined;
    return l ? (JSON.parse(l.dados) as Vaga) : undefined;
  },
  proximaPosicao(): number {
    const l = db.prepare('select coalesce(max(posicao), 0) + 1 as p from vagas').get() as { p: number };
    return l.p;
  },
  limpar() {
    db.exec('delete from vagas');
  },
};

export const candidaturas = {
  inserir(c: Omit<Candidatura, 'id'>): Candidatura {
    const r = db.prepare('insert into candidaturas (enviada_em, dados) values (?, ?)').run(c.enviadaEm, JSON.stringify(c));
    return { ...c, id: Number(r.lastInsertRowid) };
  },
  listar(): Candidatura[] {
    return (db.prepare('select id, dados from candidaturas order by enviada_em desc').all() as { id: number; dados: string }[]).map(l => ({
      ...(JSON.parse(l.dados) as Candidatura),
      id: l.id,
    }));
  },
};

export const log = {
  registrar(tipo: LinhaLog['tipo'], msg: string): LinhaLog {
    const linha = { hora: new Date().toLocaleTimeString('pt-BR', { hour12: false }), tipo, msg };
    db.prepare('insert into log (hora, tipo, msg) values (?, ?, ?)').run(linha.hora, tipo, msg);
    db.exec('delete from log where id not in (select id from log order by id desc limit 300)');
    console.log(`[${linha.hora}] ${tipo}: ${msg}`);
    emitir({ tipo: 'log', linha });
    return linha;
  },
  listar(limite = 150): LinhaLog[] {
    return db.prepare('select hora, tipo, msg from log order by id desc limit ?').all(limite) as unknown as LinhaLog[];
  },
};

export function apagarTudo() {
  db.exec('delete from kv; delete from vagas; delete from candidaturas; delete from log;');
}
