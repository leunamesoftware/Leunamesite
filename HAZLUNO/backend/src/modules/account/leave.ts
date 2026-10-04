import type { Me } from '../../../../shared/contracts.js';
import type { Deps } from '../../common/env.js';
import { AppError, errors } from '../../common/errors.js';
import { verifyPassword } from '../../common/security.js';
import type { Param } from '../../infra/db/types.js';
import { auditStatement } from '../audit/audit.js';
import { authRepo } from '../auth/repository.js';
import type { RequestMeta } from '../auth/service.js';
import { releaseExpiredHolds } from '../payments/service.js';

type Stmt = { sql: string; params?: Param[] };

/** Groups of this teacher that still have students and have not ended: they must be canceled first (students get 100% back). */
async function teacherBusyGroups(deps: Deps, userId: string, now: string) {
  return (await deps.db.one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM class_sessions cs WHERE cs.instructor_id = ? AND cs.status != 'canceled' AND cs.ends_at > ?
       AND EXISTS (SELECT 1 FROM enrollments e WHERE e.class_session_id = cs.id AND e.status IN ('confirmed', 'pending_payment'))`, [userId, now]))!.n;
}

/** Statements that take the teacher side away: drafts deleted, empty groups canceled, courses hidden, role removed. */
async function stopTeaching(deps: Deps, userId: string, now: string): Promise<Stmt[]> {
  const paidHistory = await deps.db.one(
    `SELECT 1 FROM payments p JOIN class_sessions cs ON cs.id = p.class_session_id WHERE cs.instructor_id = ? AND p.succeeded_at IS NOT NULL LIMIT 1`, [userId]);
  return [
    { sql: `DELETE FROM live_sessions WHERE class_session_id IN (SELECT id FROM class_sessions WHERE instructor_id = ? AND status = 'draft')`, params: [userId] },
    { sql: `DELETE FROM class_sessions WHERE instructor_id = ? AND status = 'draft'
              AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.class_session_id = class_sessions.id)`, params: [userId] },
    { sql: `UPDATE class_sessions SET status = 'canceled', canceled_reason = 'teacher_left', canceled_at = ?, updated_at = ?
              WHERE instructor_id = ? AND status NOT IN ('canceled', 'completed') AND ends_at > ?`, params: [now, now, userId, now] },
    { sql: `UPDATE live_sessions SET status = 'canceled' WHERE status = 'scheduled'
              AND class_session_id IN (SELECT id FROM class_sessions WHERE instructor_id = ? AND status = 'canceled')`, params: [userId] },
    { sql: `UPDATE courses SET status = 'archived', updated_at = ? WHERE instructor_id = ? AND status != 'archived'`, params: [now, userId] },
    { sql: `DELETE FROM user_roles WHERE user_id = ? AND role = 'instructor'`, params: [userId] },
    { sql: `DELETE FROM instructor_student_notes WHERE instructor_id = ?`, params: [userId] },
    // With money history the legal/tax data stays (accounting obligation); the public profile is wiped. Without it, the profile goes away.
    paidHistory
      ? { sql: `UPDATE instructor_profiles SET verification_status = 'pending', headline = NULL, bio = NULL, specialties = '[]', links = '[]', cover_key = NULL,
                  phone = NULL, city = NULL, updated_at = ? WHERE user_id = ?`, params: [now, userId] }
      : { sql: `DELETE FROM instructor_profiles WHERE user_id = ?`, params: [userId] },
  ];
}

/** "Ya no quiero ser profesor": the account stays as a student. */
export async function leaveTeaching(deps: Deps, me: Me, meta: RequestMeta) {
  if (!me.roles.includes('instructor')) return;
  const now = deps.clock.now().toISOString();
  await releaseExpiredHolds(deps);
  if (await teacherBusyGroups(deps, me.id, now)) {
    throw new AppError('teacher_has_students', 409, 'Cancel your groups that have students first (they get a full refund).');
  }
  const cover = await deps.db.one<{ cover_key: string | null }>('SELECT cover_key FROM instructor_profiles WHERE user_id = ?', [me.id]);
  await deps.db.batch([...await stopTeaching(deps, me.id, now),
    auditStatement(deps, { actorId: me.id, action: 'account.instructor_left', targetType: 'user', targetId: me.id, ipHash: meta.ipHash, userAgent: meta.userAgent })]);
  if (cover?.cover_key) await deps.storage.delete(cover.cover_key).catch(() => undefined);
}

/**
 * "Eliminar mi cuenta" (GDPR right to erasure). Personal data is wiped and the e-mail freed;
 * payment records stay without a name, because accounting law requires keeping them.
 */
export async function deleteAccount(deps: Deps, me: Me, input: unknown, meta: RequestMeta) {
  const password = (input as { password?: unknown } | null)?.password;
  const u = (await authRepo.userById(deps.db, me.id))!;
  if (typeof password !== 'string' || !u.password_hash || !(await verifyPassword(password, u.password_hash, deps.config.passwordPepper))) {
    throw new AppError('wrong_password', 400, 'Password is incorrect.', { password: 'wrong_password' });
  }
  if (me.roles.includes('admin')) throw new AppError('invalid_state', 409, 'Administrator accounts are removed by another administrator.');
  const now = deps.clock.now().toISOString();
  await releaseExpiredHolds(deps);
  const upcoming = (await deps.db.one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM enrollments e JOIN class_sessions cs ON cs.id = e.class_session_id
     WHERE e.student_id = ? AND e.status = 'confirmed' AND cs.ends_at > ? AND cs.status != 'canceled'`, [me.id, now]))!.n;
  if (upcoming) throw new AppError('has_active_enrollments', 409, 'Cancel your upcoming classes first.');
  if (me.roles.includes('instructor') && await teacherBusyGroups(deps, me.id, now)) {
    throw new AppError('teacher_has_students', 409, 'Cancel your groups that have students first (they get a full refund).');
  }
  const files = await deps.db.one<{ avatar: string | null; cover: string | null }>(
    `SELECT u.avatar_key AS avatar, (SELECT cover_key FROM instructor_profiles WHERE user_id = u.id) AS cover FROM users u WHERE u.id = ?`, [me.id]);
  await deps.db.batch([
    ...(me.roles.includes('instructor') ? await stopTeaching(deps, me.id, now) : []),
    { sql: `UPDATE enrollments SET status = 'expired', canceled_at = ? WHERE student_id = ? AND status = 'pending_payment'`, params: [now, me.id] },
    { sql: `UPDATE users SET email = ?, display_name = 'Usuario eliminado', avatar_key = NULL, password_hash = NULL, interests = '[]',
              status = 'deleted', deleted_at = ?, updated_at = ? WHERE id = ?`, params: [`deleted+${me.id}@hazluno.invalid`, now, now, me.id] },
    { sql: `UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`, params: [now, me.id] },
    { sql: `DELETE FROM auth_tokens WHERE user_id = ?`, params: [me.id] },
    { sql: `DELETE FROM auth_identities WHERE user_id = ?`, params: [me.id] },
    { sql: `DELETE FROM favorites WHERE user_id = ?`, params: [me.id] },
    { sql: `DELETE FROM instructor_student_notes WHERE student_id = ?`, params: [me.id] },
    { sql: `DELETE FROM notifications WHERE user_id = ?`, params: [me.id] },
    { sql: `DELETE FROM user_roles WHERE user_id = ?`, params: [me.id] },
    { sql: `UPDATE instructor_profiles SET phone = NULL, city = NULL, headline = NULL, bio = NULL, cover_key = NULL, links = '[]' WHERE user_id = ?`, params: [me.id] },
    auditStatement(deps, { actorId: me.id, action: 'account.deleted', targetType: 'user', targetId: me.id, ipHash: meta.ipHash, userAgent: meta.userAgent }),
  ]);
  for (const key of [files?.avatar, files?.cover]) if (key) await deps.storage.delete(key).catch(() => undefined);
}
