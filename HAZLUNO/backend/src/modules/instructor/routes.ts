import { Hono } from 'hono';
import type { AppEnv, Deps } from '../../common/env.js';
import { readJson } from '../../common/validation.js';
import { requestMeta } from '../auth/routes.js';
import * as s from './service.js';

/** Instructor area (role "instructor" is checked in app.ts). */
export function instructorRoutes(deps: Deps) {
  const r = new Hono<AppEnv>();
  const ok = <T>(data: T) => ({ ok: true, data });

  r.get('/profile', async (c) => c.json(ok(await s.getProfile(deps, c.get('me')))));
  r.put('/profile', async (c) => c.json(ok(await s.saveProfile(deps, c.get('me'), await readJson(c.req.raw)))));
  r.post('/profile/cover', async (c) => c.json(ok(await s.setProfileCover(deps, c.get('me'), c.req.raw))));
  r.post('/profile/submit', async (c) => c.json(ok(await s.submitForReview(deps, c.get('me'), await requestMeta(deps, c)))));

  r.get('/courses', async (c) => c.json(ok(await s.listCourses(deps, c.get('me')))));
  r.post('/courses', async (c) => c.json(ok(await s.createCourse(deps, c.get('me'), await readJson(c.req.raw))), 201));
  r.get('/courses/:id', async (c) => c.json(ok(await s.getCourse(deps, c.get('me'), c.req.param('id')))));
  r.put('/courses/:id', async (c) => c.json(ok(await s.updateCourse(deps, c.get('me'), c.req.param('id'), await readJson(c.req.raw)))));
  r.post('/courses/:id/publish', async (c) => c.json(ok(await s.publishCourse(deps, c.get('me'), c.req.param('id'), await requestMeta(deps, c)))));
  r.post('/courses/:id/archive', async (c) => { await s.archiveCourse(deps, c.get('me'), c.req.param('id')); return c.json(ok(null)); });
  r.post('/courses/:id/cover', async (c) => c.json(ok(await s.setCourseCover(deps, c.get('me'), c.req.param('id'), c.req.raw))));
  r.post('/courses/:id/classes', async (c) => c.json(ok(await s.createClass(deps, c.get('me'), c.req.param('id'), await readJson(c.req.raw))), 201));

  r.put('/classes/:id', async (c) => c.json(ok(await s.updateClass(deps, c.get('me'), c.req.param('id'), await readJson(c.req.raw)))));
  r.post('/classes/:id/publish', async (c) => c.json(ok(await s.publishClass(deps, c.get('me'), c.req.param('id'), await requestMeta(deps, c)))));
  r.post('/classes/:id/cancel', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { reason?: unknown };
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) || null : null;
    return c.json(ok(await s.cancelClass(deps, c.get('me'), c.req.param('id'), reason, await requestMeta(deps, c))));
  });
  r.delete('/classes/:id', async (c) => { await s.deleteDraftClass(deps, c.get('me'), c.req.param('id')); return c.json(ok(null)); });

  r.get('/agenda', async (c) => c.json(ok(await s.agenda(deps, c.get('me'), c.req.query('from'), c.req.query('to')))));
  return r;
}
