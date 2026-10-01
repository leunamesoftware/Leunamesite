import { loadConfig } from '../config.js';
import { createSqliteDb } from '../infra/db/sqlite.js';
import { migrate } from './migrate.js';

const config = loadConfig();
const db = createSqliteDb(config.dbPath);
const done = await migrate(db);
console.log(done.length ? `Applied: ${done.join(', ')}` : 'Database is up to date.');
await db.close();
