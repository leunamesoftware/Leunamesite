import type { AdminUserList, AdminUserRow, Me } from '../../../../shared/contracts.js';
import type { Deps } from '../../common/env.js';
import { AppError, errors } from '../../common/errors.js';
import { newId } from '../../common/security.js';
import type { Param } from '../../infra/db/types.js';
import { auditStatement } from '../audit/audit.js';
import type { RequestMeta } from '../auth/service.js';

const PAGE = 25;

/** Tela 30: everyone on the platform, filtered by role/status and searched by name or e-mail. */
export async function listUsers(deps: Deps, query: { role?: string; status?: string; q?: string; page?: string }): Promise<AdminUserList> {
  const where: string[] = [`u.status != 'deleted'`];
  const params: Param[] = [];
  if (query.role === 'student' || query.role === 'instructor' || query.role === 'admin') {
    where.push('EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = ?)'); params.push(query.role);
  }
  if (query.status === 'suspended' || query.status === 'active') { where.push('u.status = ?'); params.push(query.status); }
  const q = (query.q ?? '').trim().toLowerCase();
  if (q) { where.push('(lower(u.display_name) LIKE ? OR lower(u.email) LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  const page = Math.max(1, Number(query.page) || 1);
  const sqlWhere = where.join(' AND ');
  const total = (await deps.db.one<{ n: number }>(`SELECT COUNT(*) AS n FROM users u WHERE ${sqlWhere}`, params))!.n;
  const rows = await deps.db.all<{ id: string; name: string; email: string; avatar_key: string | null; country_code: string; status: 'active' | 'suspended';
    created_at: string; roles: string | null; teacher: AdminUserRow['teacherStatus']; last_seen: string | null; enrollments: number; courses: number }>(
    `SELECT u.id, u.display_name AS name, u.email, u.avatar_key, u.country_code, u.status, u.created_at,
            (SELECT group_concat(role) FROM user_roles r WHERE r.user_id = u.id) AS roles,
            (SELECT verification_status FROM instructor_profiles ip WHERE ip.user_id = u.id) AS teacher,
            (SELECT MAX(last_seen_at) FROM sessions s WHERE s.user_id = u.id) AS last_seen,
            (SELECT COUNT(*) FROM enrollments e WHERE e.student_id = u.id AND e.status IN ('confirmed', 'completed')) AS enrollments,
            (SELECT COUNT(*) FROM courses c WHERE c.instructor_id = u.id) AS courses
     FROM users u WHERE ${sqlWhere} ORDER BY u.created_at DESC LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`, params);
  const n = async (sql: string) => (await deps.db.one<{ n: number }>(sql))!.n;
  return {
    items: rows.map((r) => ({
      id: r.id, name: r.name, email: r.email, avatarUrl: r.avatar_key ? `/api/files/${r.avatar_key}` : null, countryCode: r.country_code,
      roles: (r.roles ?? '').split(',').filter(Boolean) as AdminUserRow['roles'], status: r.status, createdAt: r.created_at, lastSeenAt: r.last_seen,
      teacherStatus: r.teacher, enrollments: r.enrollments, courses: r.courses,
    })),
    total,
    counts: {
      all: await n(`SELECT COUNT(*) AS n FROM users WHERE status != 'deleted'`),
      students: await n(`SELECT COUNT(*) AS n FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'student' WHERE u.status != 'deleted'`),
      teachers: await n(`SELECT COUNT(*) AS n FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'instructor' WHERE u.status != 'deleted'`),
      suspended: await n(`SELECT COUNT(*) AS n FROM users WHERE status = 'suspended'`),
    },
  };
}

/** Suspending ends every session at once; the person sees "account suspended" when trying to sign in. */
export async function setSuspended(deps: Deps, me: Me, userId: string, suspend: boolean, reason: string | null, meta: RequestMeta) {
  if (userId === me.id) throw new AppError('invalid_state', 409, 'You cannot suspend your own account.');
  const u = await deps.db.one<{ status: string; is_admin: number }>(
    `SELECT status, EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = users.id AND r.role = 'admin') AS is_admin FROM users WHERE id = ? AND status != 'deleted'`, [userId]);
  if (!u) throw errors.notFound('User');
  if (u.is_admin) throw new AppError('invalid_state', 409, 'Administrators cannot be suspended here.');
  if (suspend && (!reason || reason.trim().length < 3)) throw errors.invalid({ reason: 'required' });
  const now = deps.clock.now().toISOString();
  await deps.db.batch([
    { sql: `UPDATE users SET status = ?, updated_at = ? WHERE id = ?`, params: [suspend ? 'suspended' : 'active', now, userId] },
    ...(suspend ? [{ sql: `UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`, params: [now, userId] as Param[] }] : []),
    { sql: `INSERT INTO moderation_actions (id, moderator_id, target_type, target_id, action, reason, created_at) VALUES (?, ?, 'user', ?, ?, ?, ?)`,
      params: [newId(), me.id, userId, suspend ? 'suspend_user' : 'reinstate_user', reason?.trim() || null, now] },
    auditStatement(deps, { actorId: me.id, action: suspend ? 'admin.user_suspended' : 'admin.user_reinstated', targetType: 'user', targetId: userId, ipHash: meta.ipHash, userAgent: meta.userAgent }),
  ]);
}
