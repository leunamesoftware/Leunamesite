import { createRequire } from 'node:module';
import type { DatabaseSync as TipoDatabaseSync } from 'node:sqlite';
import type { Banco, Parametro } from './tipos.js';

// Carregado assim porque algumas ferramentas (ex.: o executor de testes) ainda não reconhecem "node:sqlite".
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as { DatabaseSync: typeof TipoDatabaseSync };

/** Adaptador SQLite (usado no desenvolvimento e nos testes). ':memory:' cria um banco temporário. */
export function criarBancoSqlite(caminho: string): Banco {
  const db = new DatabaseSync(caminho);
  db.exec('PRAGMA foreign_keys = ON;');
  if (caminho !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  let emTransacao = false;

  const banco: Banco = {
    async todos<T>(sql: string, parametros: Parametro[] = []) {
      return db.prepare(sql).all(...parametros) as T[];
    },
    async um<T>(sql: string, parametros: Parametro[] = []) {
      return (db.prepare(sql).get(...parametros) as T | undefined) ?? null;
    },
    async executar(sql: string, parametros: Parametro[] = []) {
      const r = db.prepare(sql).run(...parametros);
      return { alteradas: Number(r.changes) };
    },
    async transacao<T>(operacoes: (b: Banco) => Promise<T>) {
      if (emTransacao) return operacoes(banco); // transação aninhada vira parte da externa
      emTransacao = true;
      db.exec('BEGIN');
      try {
        const resultado = await operacoes(banco);
        db.exec('COMMIT');
        return resultado;
      } catch (erro) {
        db.exec('ROLLBACK');
        throw erro;
      } finally {
        emTransacao = false;
      }
    },
    async executarScript(sql: string) {
      db.exec(sql);
    },
    async fechar() {
      db.close();
    },
  };
  return banco;
}
