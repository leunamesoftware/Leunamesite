import { serve } from '@hono/node-server';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createApp } from './app.js';
import { systemClock } from './common/clock.js';
import type { Deps } from './common/env.js';
import { loadConfig } from './config.js';
import { migrate } from './db/migrate.js';
import { createSqliteDb } from './infra/db/sqlite.js';
import { createDiskStorage } from './infra/storage/disk.js';

/** Local Node server (development). */
export async function createDeps(): Promise<Deps> {
  const config = loadConfig();
  await mkdir(dirname(config.dbPath), { recursive: true });
  const db = createSqliteDb(config.dbPath);
  await migrate(db);
  return { db, config, clock: systemClock, storage: createDiskStorage(process.env.FILES_DIR ?? './data/files'), mailer: null };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const deps = await createDeps();
  serve({ fetch: createApp(deps).fetch, port: deps.config.port }, (info) => {
    console.log(`Hazluno API on http://localhost:${info.port}`);
  });
}
