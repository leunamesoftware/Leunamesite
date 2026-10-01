import { createApp } from './app.js';
import type { Deps } from './common/env.js';
import { systemClock } from './common/clock.js';
import { loadConfig } from './config.js';
import { createD1Db, type D1Database } from './infra/db/d1.js';
import { createR2Storage, type R2Bucket } from './infra/storage/r2.js';

// Hazluno on Cloudflare Workers: /api/* → API (Hono + D1); everything else → the app (static files).
interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  ASSETS: { fetch(request: Request): Promise<Response> };
  [variable: string]: unknown;
}

function deps(env: Env): Deps {
  const vars = Object.fromEntries(Object.entries(env).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
  return { db: createD1Db(env.DB), config: loadConfig(vars), clock: systemClock, storage: createR2Storage(env.FILES), mailer: null };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return createApp(deps(env)).fetch(request);
    return env.ASSETS.fetch(request);
  },
};
