import { z } from 'zod';
import type { Me, SessionInfo } from '../../../../shared/contracts.js';
import type { Deps } from '../../common/env.js';
import { AppError, errors } from '../../common/errors.js';
import { hashPassword, verifyPassword } from '../../common/security.js';
import { parse } from '../../common/validation.js';
import { auditStatement } from '../audit/audit.js';
import { authRepo } from '../auth/repository.js';
import { countrySchema, languageSchema, nameSchema, passwordSchema, timezoneSchema } from '../auth/schemas.js';
import { instructorStatements, type RequestMeta } from '../auth/service.js';

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
