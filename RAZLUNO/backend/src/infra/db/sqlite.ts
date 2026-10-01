import { createRequire } from 'node:module';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import type { Db, Param } from './types.js';

// Loaded this way because some tools (e.g. the test runner) do not resolve "node:sqlite" yet.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as { DatabaseSync: typeof DatabaseSyncType };

/** SQLite adapter for development and tests. ':memory:' creates a throwaway database. */
export function createSqliteDb(path: string): Db {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  return {
    async all<T>(sql: string, params: Param[] = []) {
      return db.prepare(sql).all(...params) as T[];
    },
    async one<T>(sql: string, params: Param[] = []) {
      return (db.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async run(sql: string, params: Param[] = []) {
      return { changes: Number(db.prepare(sql).run(...params).changes) };
    },
    async batch(statements) {
      db.exec('BEGIN');
      try {
        for (const s of statements) db.prepare(s.sql).run(...(s.params ?? []));
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    async exec(script: string) {
      db.exec(script);
    },
    async close() {
      db.close();
    },
  };
}
