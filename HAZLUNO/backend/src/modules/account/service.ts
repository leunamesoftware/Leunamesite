import { z } from 'zod';
import type { Me, MyClass, SessionInfo } from '../../../../shared/contracts.js';
import type { Deps } from '../../common/env.js';
import { AppError, errors } from '../../common/errors.js';
import { hashPassword, verifyPassword } from '../../common/security.js';
import { parse } from '../../common/validation.js';
import { auditStatement } from '../audit/audit.js';
import { authRepo } from '../auth/repository.js';
import { countrySchema, languageSchema, nameSchema, passwordSchema, timezoneSchema } from '../auth/schemas.js';
import { instructorStatements, type RequestMeta } from '../auth/service.js';
import { placeholders } from '../../common/sql.js';
import { instructorMinis, loadClasses, loadCourseCards } from '../explore/queries.js';
import { publicUrl, storeImage } from '../files/images.js';

const profileSchema = z.object({
  displayName: nameSchema.optional(),
  countryCode: countrySchema.optional(),
  languageCode: languageSchema.optional(),
  timezone: timezoneSchema.optional(),
});
const passwordChangeSchema = z.object({ currentPassword: z.string().min(1, 'required'), newPassword: passwordSchema });

async function reload(deps: Deps, id: string): Promise<Me> {
  return authRepo.loadMe(deps.db, (await authRepo.userById(deps.db, id))!);
}

export async function updateProfile(deps: Deps, me: Me, input: unknown): Promise<Me> {
  const d = parse(profileSchema, input);
  if (d.countryCode && !(await deps.db.one('SELECT 1 FROM countries WHERE code = ? AND is_active = 1', [d.countryCode]))) {
    throw errors.invalid({ countryCode: 'invalid_option' });
  }
  const now = deps.clock.now().toISOString();
  await deps.db.run(
    `UPDATE users SET display_name = COALESCE(?, display_name), country_code = COALESCE(?, country_code),
       language_code = COALESCE(?, language_code), timezone = COALESCE(?, timezone), updated_at = ? WHERE id = ?`,
    [d.displayName ?? null, d.countryCode ?? null, d.languageCode ?? null, d.timezone ?? null, now, me.id]);
  return reload(deps, me.id);
}

/** Changing the password signs out every other device. */
export async function changePassword(deps: Deps, me: Me, currentTokenHash: string, input: unknown, meta: RequestMeta) {
  const d = parse(passwordChangeSchema, input);
  const u = (await authRepo.userById(deps.db, me.id))!;
  if (!u.password_hash || !(await verifyPassword(d.currentPassword, u.password_hash, deps.config.passwordPepper))) {
    throw new AppError('wrong_password', 400, 'Current password is incorrect.', { currentPassword: 'wrong_password' });
  }
  const now = deps.clock.now().toISOString();
  await deps.db.batch([
    { sql: 'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
      params: [await hashPassword(d.newPassword, deps.config.passwordPepper), now, me.id] },
    { sql: 'UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND token_hash != ? AND revoked_at IS NULL',
      params: [now, me.id, currentTokenHash] },
    auditStatement(deps, { actorId: me.id, action: 'account.password_changed', ipHash: meta.ipHash, userAgent: meta.userAgent }),
  ]);
}

export async function listSessions(deps: Deps, me: Me, currentTokenHash: string): Promise<SessionInfo[]> {
  const rows = await deps.db.all<{ id: string; user_agent: string | null; created_at: string; last_seen_at: string; token_hash: string }>(
    `SELECT id, user_agent, created_at, last_seen_at, token_hash FROM sessions
     WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY last_seen_at DESC`,
    [me.id, deps.clock.now().toISOString()]);
  return rows.map((r) => ({ id: r.id, userAgent: r.user_agent, createdAt: r.created_at, lastSeenAt: r.last_seen_at, current: r.token_hash === currentTokenHash }));
}

export async function revokeSession(deps: Deps, me: Me, sessionId: string, meta: RequestMeta) {
  const now = deps.clock.now().toISOString();
  const r = await deps.db.run('UPDATE sessions SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL', [now, sessionId, me.id]);
  if (!r.changes) throw errors.notFound('Session');
  await deps.db.batch([auditStatement(deps, { actorId: me.id, action: 'account.session_revoked', targetType: 'session', targetId: sessionId, ipHash: meta.ipHash, userAgent: meta.userAgent })]);
}

/** A student who signed up to learn can later apply to teach (starts pending verification). */
export async function becomeInstructor(deps: Deps, me: Me, meta: RequestMeta): Promise<Me> {
  if (me.roles.includes('instructor')) return me;
  const now = deps.clock.now().toISOString();
  await deps.db.batch([
    ...instructorStatements(me.id, now),
    auditStatement(deps, { actorId: me.id, action: 'account.instructor_applied', ipHash: meta.ipHash, userAgent: meta.userAgent }),
  ]);
  return reload(deps, me.id);
}

// ---------- favorites, avatar, my classes ----------

export async function listFavorites(deps: Deps, me: Me) {
  const ids = (await deps.db.all<{ course_id: string }>(
    `SELECT f.course_id FROM favorites f JOIN courses c ON c.id = f.course_id WHERE f.user_id = ? AND c.status = 'published' ORDER BY f.created_at DESC`,
    [me.id])).map((r) => r.course_id);
  return loadCourseCards(deps.db, ids, me.id, deps.clock.now());
}

export async function setFavorite(deps: Deps, me: Me, courseId: string, on: boolean) {
  if (on) {
    if (!(await deps.db.one(`SELECT 1 FROM courses WHERE id = ? AND status = 'published'`, [courseId]))) throw errors.notFound('Course');
    await deps.db.run('INSERT OR IGNORE INTO favorites (user_id, course_id, created_at) VALUES (?, ?, ?)', [me.id, courseId, deps.clock.now().toISOString()]);
  } else {
    await deps.db.run('DELETE FROM favorites WHERE user_id = ? AND course_id = ?', [me.id, courseId]);
  }
}

export async function setAvatar(deps: Deps, me: Me, request: Request): Promise<Me> {
  const old = await deps.db.one<{ avatar_key: string | null }>('SELECT avatar_key FROM users WHERE id = ?', [me.id]);
  const key = await storeImage(deps, request, 'avatars');
  await deps.db.run('UPDATE users SET avatar_key = ?, updated_at = ? WHERE id = ?', [key, deps.clock.now().toISOString(), me.id]);
  if (old?.avatar_key) await deps.storage.delete(old.avatar_key);
  return reload(deps, me.id);
}

/** Tela 10: classes the student is enrolled in (filled by Phase 3 enrollments). */
export async function myClasses(deps: Deps, me: Me): Promise<MyClass[]> {
  const ids = (await deps.db.all<{ id: string }>(
    `SELECT cs.id FROM enrollments e JOIN class_sessions cs ON cs.id = e.class_session_id
     WHERE e.student_id = ? AND e.status IN ('confirmed', 'completed') ORDER BY cs.starts_at`, [me.id])).map((r) => r.id);
  const classes = await loadClasses(deps.db, { classIds: ids, viewerId: me.id, now: deps.clock.now() });
  if (!classes.length) return [];
  const courses = await deps.db.all<{ id: string; title: string; cover_key: string | null; instructor_id: string; name: string; avatar: string | null; country: string }>(
    `SELECT c.id, c.title, c.cover_key, c.instructor_id, u.display_name AS name, u.avatar_key AS avatar, u.country_code AS country
     FROM courses c JOIN users u ON u.id = c.instructor_id WHERE c.id IN (${placeholders(new Set(classes.map((k) => k.courseId)).size)})`,
    [...new Set(classes.map((k) => k.courseId))]);
  const minis = await instructorMinis(deps.db, courses.map((c) => ({ id: c.instructor_id, name: c.name, avatar: c.avatar, country: c.country })));
  return classes.map((k) => {
    const c = courses.find((x) => x.id === k.courseId)!;
    return { ...k, courseTitle: c.title, coverUrl: publicUrl(c.cover_key), instructor: minis.get(c.instructor_id)! };
  });
}
