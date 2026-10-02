import { Hono, type Context } from 'hono';
import type { AdminInstructorRow } from '../../../../shared/contracts.js';
import type { AppEnv, Deps } from '../../common/env.js';
import { AppError, errors } from '../../common/errors.js';
import { newId } from '../../common/security.js';
import { parse, readJson } from '../../common/validation.js';
import { auditStatement } from '../audit/audit.js';
import { requestMeta } from '../auth/routes.js';
import { rejectSchema } from '../instructor/schemas.js';
import { dashboard } from './dashboard.js';
import { listUsers, setSuspended } from './users.js';
import { cancelClassAsAdmin, listClasses, listCourses, setCourseVisible } from './catalog.js';
import { finance } from './finance.js';
import { releaseExpiredHolds, settleFinishedClasses } from '../payments/service.js';

/** Minimal moderation needed in Phase 2: approving or rejecting teachers. The full panel is Phase 6. */
export function adminRoutes(deps: Deps) {
  const r = new Hono<AppEnv>();

  r.get('/dashboard', async (c) => c.json({ ok: true, data: await dashboard(deps, Number(c.req.query('days') ?? 30)) }));

  r.get('/users', async (c) => c.json({ ok: true, data: await listUsers(deps, c.req.query()) }));
  r.post('/users/:id/suspend', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { reason?: unknown };
    await setSuspended(deps, c.get('me'), c.req.param('id'), true, typeof body.reason === 'string' ? body.reason.slice(0, 500) : null, await requestMeta(deps, c));
    return c.json({ ok: true, data: null });
  });
  r.post('/users/:id/reinstate', async (c) => {
    await setSuspended(deps, c.get('me'), c.req.param('id'), false, null, await requestMeta(deps, c));
    return c.json({ ok: true, data: null });
  });

  const reasonOf = async (c: Context<AppEnv>) => {
    const body = (await c.req.json().catch(() => ({}))) as { reason?: unknown };
    return typeof body.reason === 'string' ? body.reason.slice(0, 500) : null;
  };
  r.get('/courses', async (c) => c.json({ ok: true, data: await listCourses(deps, c.req.query()) }));
  r.post('/courses/:id/hide', async (c) => {
    await setCourseVisible(deps, c.get('me'), c.req.param('id'), false, await reasonOf(c), await requestMeta(deps, c));
    return c.json({ ok: true, data: null });
  });
  r.post('/courses/:id/show', async (c) => {
    await setCourseVisible(deps, c.get('me'), c.req.param('id'), true, null, await requestMeta(deps, c));
    return c.json({ ok: true, data: null });
  });
  r.get('/classes', async (c) => c.json({ ok: true, data: await listClasses(deps, c.req.query()) }));
  r.post('/classes/:id/cancel', async (c) => {
    await cancelClassAsAdmin(deps, c.get('me'), c.req.param('id'), await reasonOf(c), await requestMeta(deps, c));
    return c.json({ ok: true, data: null });
  });

  /** Money is for administrators only (moderators handle people and content). */
  const adminOnly = (c: Context<AppEnv>) => { if (!c.get('me').roles.includes('admin')) throw errors.forbidden(); };
  r.get('/finance', async (c) => { adminOnly(c); return c.json({ ok: true, data: await finance(deps, c.req.query()) }); });
  r.post('/payments/settle', async (c) => {
    adminOnly(c);
    await releaseExpiredHolds(deps);
    return c.json({ ok: true, data: await settleFinishedClasses(deps) });
  });

  r.get('/instructors', async (c) => {
    const status = c.req.query('status') ?? 'under_review';
    const rows = await deps.db.all<AdminInstructorRow>(
      `SELECT u.id AS userId, u.display_name AS name, u.email, u.country_code AS countryCode, ip.verification_status AS verificationStatus,
              ip.legal_entity_type AS legalEntityType, ip.legal_name AS legalName, ip.tax_id AS taxId, ip.tax_country AS taxCountry,
              ip.business_address AS businessAddress, ip.headline, ip.phone, ip.city, ip.updated_at AS submittedAt
       FROM instructor_profiles ip JOIN users u ON u.id = ip.user_id WHERE ip.verification_status = ? ORDER BY ip.updated_at`, [status]);
    return c.json({ ok: true, data: rows });
  });

  const decide = (approve: boolean) => async (c: Context<AppEnv>) => {
    const me = c.get('me');
    const userId = c.req.param('id')!;
    const reason = approve ? null : parse(rejectSchema, await readJson(c.req.raw)).reason;
    const p = await deps.db.one<{ verification_status: string }>('SELECT verification_status FROM instructor_profiles WHERE user_id = ?', [userId]);
    if (!p) throw errors.notFound('Instructor');
    if (p.verification_status !== 'under_review') throw new AppError('invalid_state', 409, 'This profile is not under review.');
    const now = deps.clock.now().toISOString();
    const meta = await requestMeta(deps, c);
    await deps.db.batch([
      approve
        ? { sql: `UPDATE instructor_profiles SET verification_status = 'approved', verified_at = ?, verified_by = ?, rejection_reason = NULL, updated_at = ? WHERE user_id = ?`,
            params: [now, me.id, now, userId] }
        : { sql: `UPDATE instructor_profiles SET verification_status = 'rejected', rejection_reason = ?, updated_at = ? WHERE user_id = ?`,
            params: [reason, now, userId] },
      { sql: `INSERT INTO moderation_actions (id, moderator_id, target_type, target_id, action, reason, created_at) VALUES (?, ?, 'user', ?, ?, ?, ?)`,
        params: [newId(), me.id, userId, approve ? 'approve_instructor' : 'reject_instructor', reason, now] },
      { sql: `INSERT INTO notifications (id, user_id, type, data, created_at) VALUES (?, ?, 'instructor_verification', ?, ?)`,
        params: [newId(), userId, JSON.stringify({ approved: approve, reason }), now] },
      auditStatement(deps, { actorId: me.id, action: approve ? 'admin.instructor_approved' : 'admin.instructor_rejected', targetType: 'user',
        targetId: userId, ipHash: meta.ipHash, userAgent: meta.userAgent }),
    ]);
    return c.json({ ok: true, data: null });
  };
  r.post('/instructors/:id/approve', decide(true));
  r.post('/instructors/:id/reject', decide(false));
  return r;
}
