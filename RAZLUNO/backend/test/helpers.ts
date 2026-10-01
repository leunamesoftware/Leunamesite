import { createApp } from '../src/app.js';
import type { Deps } from '../src/common/env.js';
import { loadConfig } from '../src/config.js';
import { migrate } from '../src/db/migrate.js';
import { createSqliteDb } from '../src/infra/db/sqlite.js';
import type { Mailer } from '../src/infra/mailer.js';

export interface TestCtx {
  deps: Deps;
  app: ReturnType<typeof createApp>;
  clock: { at: Date; advanceMinutes(n: number): void };
  sentMail: { to: string; subject: string; text: string }[];
  call<T = unknown>(method: string, path: string, opts?: { token?: string; body?: unknown; ip?: string }): Promise<{
    status: number;
    json: { ok: boolean; data: T; error?: string; fields?: Record<string, string> };
  }>;
}

/** Fresh in-memory database and API for each test. `withMailer` plugs a capturing mailer (tests only). */
export async function setup(opts: { withMailer?: boolean; env?: Record<string, string> } = {}): Promise<TestCtx> {
  const db = createSqliteDb(':memory:');
  await migrate(db);
  const clock = { at: new Date('2026-10-01T09:00:00Z'), advanceMinutes(n: number) { this.at = new Date(this.at.getTime() + n * 60_000); } };
  const sentMail: TestCtx['sentMail'] = [];
  const mailer: Mailer = { async send(m) { sentMail.push(m); } };
  const deps: Deps = {
    db,
    config: loadConfig({ PASSWORD_PEPPER: 'test-pepper-0123456789', IP_HASH_SECRET: 'test-ip-secret-0123456789', ...opts.env }),
    clock: { now: () => clock.at },
    mailer: opts.withMailer ? mailer : null,
  };
  const app = createApp(deps);
  return {
    deps, app, clock, sentMail,
    async call(method, path, o = {}) {
      const headers: Record<string, string> = { origin: 'http://localhost:5174', 'x-forwarded-for': o.ip ?? '10.0.0.1', 'user-agent': 'vitest' };
      if (o.token) headers.authorization = `Bearer ${o.token}`;
      let body: string | undefined;
      if (o.body !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(o.body); }
      const res = await app.request(path, { method, headers, body });
      return { status: res.status, json: (await res.json()) as never };
    },
  };
}

export const validSignup = (over: Record<string, unknown> = {}) => ({
  displayName: 'Lucía Fernández',
  email: 'lucia@example.com',
  password: 'correct-horse-9',
  countryCode: 'ES',
  languageCode: 'es',
  timezone: 'Europe/Madrid',
  intent: 'learn',
  acceptTerms: true,
  ...over,
});
