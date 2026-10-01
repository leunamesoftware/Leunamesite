import { Hono } from 'hono';
import type { AppEnv, Deps } from '../../common/env.js';
import { readJson } from '../../common/validation.js';
import { requestMeta } from '../auth/routes.js';
import { becomeInstructor, changePassword, listSessions, revokeSession, updateProfile } from './service.js';

export function accountRoutes(deps: Deps) {
  const r = new Hono<AppEnv>();
  r.get('/', (c) => c.json({ ok: true, data: c.get('me') }));
  r.patch('/', async (c) => c.json({ ok: true, data: await updateProfile(deps, c.get('me'), await readJson(c.req.raw)) }));
  r.post('/password', async (c) => {
    await changePassword(deps, c.get('me'), c.get('sessionTokenHash'), await readJson(c.req.raw), await requestMeta(deps, c));
    return c.json({ ok: true, data: null });
  });
  r.get('/sessions', async (c) => c.json({ ok: true, data: await listSessions(deps, c.get('me'), c.get('sessionTokenHash')) }));
  r.delete('/sessions/:id', async (c) => {
    await revokeSession(deps, c.get('me'), c.req.param('id'), await requestMeta(deps, c));
    return c.json({ ok: true, data: null });
  });
  r.post('/instructor', async (c) => c.json({ ok: true, data: await becomeInstructor(deps, c.get('me'), await requestMeta(deps, c)) }));
  return r;
}
