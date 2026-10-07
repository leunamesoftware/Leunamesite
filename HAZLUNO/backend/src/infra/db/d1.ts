import type { Db, Param } from './types.js';

/** The slice of the Cloudflare D1 API that Hazluno uses. */
export interface D1Database {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown[]>;
}
interface D1Statement {
  bind(...values: Param[]): D1Statement;
  all<T>(): Promise<{ results: T[] }>;
  first<T>(): Promise<T | null>;
  run(): Promise<{ meta: { changes?: number } }>;
}

/** Cloudflare D1 adapter. D1 batches are atomic, which is what `batch` relies on. */
export function createD1Db(d1: D1Database): Db {
  const prepare = (sql: string, params: Param[] = []) => d1.prepare(sql).bind(...params);
  return {
    async all<T>(sql: string, params?: Param[]) {
      return (await prepare(sql, params).all<T>()).results;
    },
    async one<T>(sql: string, params?: Param[]) {
      return (await prepare(sql, params).first<T>()) ?? null;
    },
    async run(sql, params) {
      return { changes: (await prepare(sql, params).run()).meta.changes ?? 0 };
    },
    async batch(statements) {
      if (statements.length) await d1.batch(statements.map((s) => prepare(s.sql, s.params)));
    },
    async exec(script) {
      const commands = script.split(/;\s*(?:\r?\n|$)/).map((c) => c.replace(/--.*$/gm, '').trim()).filter(Boolean);
      if (commands.length) await d1.batch(commands.map((c) => d1.prepare(c)));
    },
    async close() {},
  };
}
