import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Db } from '../infra/db/types.js';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

/**
 * Applies pending migrations in order (local SQLite / tests).
 * In production, D1 uses `wrangler d1 migrations apply` on the same folder.
 * A migration never runs twice; a change is always a new numbered file.
 */
export async function migrate(db: Db): Promise<string[]> {
  await db.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL);');
  const applied = new Set((await db.all<{ name: string }>('SELECT name FROM _migrations')).map((m) => m.name));
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  const done: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    await db.exec(`BEGIN;\n${await readFile(join(MIGRATIONS_DIR, file), 'utf8')}\nINSERT INTO _migrations (name, applied_at) VALUES ('${file}', '${new Date().toISOString()}');\nCOMMIT;`);
    done.push(file);
  }
  return done;
}
