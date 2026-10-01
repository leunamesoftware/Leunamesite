import { Hono } from 'hono';
import type { AppEnv, Deps } from '../../common/env.js';
import { optionalAuth } from '../auth/middleware.js';
import { courseDetail, explore, instructorPublic } from './service.js';

/** Public catalog. Signed-in viewers also get their favorites and enrolled classes marked. */
export function exploreRoutes(deps: Deps) {
  const r = new Hono<AppEnv>();
  r.use('*', optionalAuth(deps));
  const viewer = (c: { get(k: 'me'): { id: string } | undefined }) => c.get('me')?.id ?? null;
  r.get('/explore', async (c) => c.json({ ok: true, data: await explore(deps, c.req.query(), viewer(c)) }));
  r.get('/courses/:id', async (c) => c.json({ ok: true, data: await courseDetail(deps, c.req.param('id'), viewer(c)) }));
  r.get('/instructors/:id', async (c) => c.json({ ok: true, data: await instructorPublic(deps, c.req.param('id'), viewer(c)) }));
  return r;
}
