import { Hono } from 'hono';
import type { AppEnv, Deps } from '../../common/env.js';
import { readJson } from '../../common/validation.js';
import { requestMeta } from '../auth/routes.js';
import { becomeInstructor, changePassword, listFavorites, listSessions, myClasses, myStats, revokeSession, setAvatar, setFavorite, updateProfile } from './service.js';

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
  r.post('/avatar', async (c) => c.json({ ok: true, data: await setAvatar(deps, c.get('me'), c.req.raw) }));
  r.get('/favorites', async (c) => c.json({ ok: true, data: await listFavorites(deps, c.get('me')) }));
  r.put('/favorites/:courseId', async (c) => { await setFavorite(deps, c.get('me'), c.req.param('courseId'), true); return c.json({ ok: true, data: null }); });
  r.delete('/favorites/:courseId', async (c) => { await setFavorite(deps, c.get('me'), c.req.param('courseId'), false); return c.json({ ok: true, data: null }); });
  r.get('/stats', async (c) => c.json({ ok: true, data: await myStats(deps, c.get('me')) }));
  r.get('/classes', async (c) => c.json({ ok: true, data: await myClasses(deps, c.get('me')) }));
  return r;
}
