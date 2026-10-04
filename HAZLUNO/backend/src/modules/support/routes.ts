import { Hono } from 'hono';
import type { AppEnv, Deps } from '../../common/env.js';
import { readJson } from '../../common/validation.js';
import { requestMeta } from '../auth/routes.js';
import * as s from './service.js';

const ok = <T>(data: T) => ({ ok: true, data });

/** Mounted at /api/me (signed in): help conversations and reports. */
export function supportRoutes(deps: Deps) {
  const r = new Hono<AppEnv>();
  r.get('/support', async (c) => c.json(ok(await s.myTickets(deps, c.get('me')))));
  r.post('/support', async (c) => c.json(ok(await s.openTicket(deps, c.get('me'), await readJson(c.req.raw))), 201));
  r.get('/support/:id', async (c) => c.json(ok(await s.myTicket(deps, c.get('me'), c.req.param('id')))));
  r.post('/support/:id/messages', async (c) => c.json(ok(await s.replyAsUser(deps, c.get('me'), c.req.param('id'), await readJson(c.req.raw)))));
  r.post('/reports', async (c) => c.json(ok(await s.report(deps, c.get('me'), await readJson(c.req.raw), await requestMeta(deps, c))), 201));
  return r;
}

/** Mounted at /api/admin (admin or moderator). */
export function adminSupportRoutes(deps: Deps) {
  const r = new Hono<AppEnv>();
  r.get('/support', async (c) => c.json(ok(await s.adminTickets(deps, c.req.query()))));
  r.get('/support/:id', async (c) => c.json(ok(await s.adminTicket(deps, c.req.param('id')))));
  r.post('/support/:id/messages', async (c) => c.json(ok(await s.replyAsStaff(deps, c.get('me'), c.req.param('id'), await readJson(c.req.raw)))));
  r.post('/support/:id/status', async (c) => c.json(ok(await s.setTicketStatus(deps, c.req.param('id'), await readJson(c.req.raw)))));
  r.get('/reports', async (c) => c.json(ok(await s.adminReports(deps, c.req.query()))));
  r.post('/reports/:id', async (c) => { await s.decideReport(deps, c.get('me'), c.req.param('id'), await readJson(c.req.raw), await requestMeta(deps, c)); return c.json(ok(null)); });
  return r;
}
