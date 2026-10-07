import { Hono } from 'hono';
import type { AppEnv, Deps } from '../../common/env.js';
import { readJson } from '../../common/validation.js';
import { requestMeta } from '../auth/routes.js';
import * as s from './service.js';

const ok = <T>(data: T) => ({ ok: true, data });

/** Student: book a seat, follow the payment, withdraw (mounted at /api/me/enrollments, signed in). */
export function enrollmentRoutes(deps: Deps) {
  const r = new Hono<AppEnv>();
  r.post('/', async (c) => c.json(ok(await s.startEnrollment(deps, c.get('me'), await readJson(c.req.raw), await requestMeta(deps, c))), 201));
  r.get('/:id', async (c) => c.json(ok(await s.enrollmentInfo(deps, c.get('me'), c.req.param('id')))));
  r.post('/:id/withdraw', async (c) => c.json(ok(await s.withdraw(deps, c.get('me'), c.req.param('id'), await requestMeta(deps, c)))));
  return r;
}

/** Provider → Hazluno. Public, but every request must carry the provider's signature. */
export function webhookRoutes(deps: Deps) {
  const r = new Hono();
  r.post('/webhook', async (c) => c.json(ok(await s.handleWebhook(deps, await c.req.text(), c.req.header('stripe-signature') ?? null))));
  return r;
}
