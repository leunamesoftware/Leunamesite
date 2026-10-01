import type { InstructorVerification, LanguageCode, Me, Role } from '../../../../shared/contracts.js';
import type { Db } from '../../infra/db/types.js';

export interface UserRow {
  id: string; email: string; password_hash: string | null; display_name: string; country_code: string;
  language_code: LanguageCode; timezone: string; status: 'active' | 'suspended' | 'deleted';
  email_verified_at: string | null; avatar_key: string | null; created_at: string; updated_at: string;
}

export const authRepo = {
  userByEmail: (db: Db, email: string) => db.one<UserRow>('SELECT * FROM users WHERE email = ?', [email]),
  userById: (db: Db, id: string) => db.one<UserRow>('SELECT * FROM users WHERE id = ?', [id]),

  async loadMe(db: Db, u: UserRow): Promise<Me> {
    const roles = (await db.all<{ role: Role }>('SELECT role FROM user_roles WHERE user_id = ? ORDER BY role', [u.id])).map((r) => r.role);
    const ip = await db.one<{ verification_status: InstructorVerification }>(
      'SELECT verification_status FROM instructor_profiles WHERE user_id = ?', [u.id]);
    return {
      id: u.id, email: u.email, displayName: u.display_name, countryCode: u.country_code, languageCode: u.language_code,
      timezone: u.timezone, roles, instructor: ip ? { verificationStatus: ip.verification_status } : null,
      avatarUrl: u.avatar_key ? `/api/files/${u.avatar_key}` : null,
      emailVerified: !!u.email_verified_at, createdAt: u.created_at,
    };
  },

  userBySession: (db: Db, tokenHash: string, now: string) =>
    db.one<UserRow & { session_id: string; last_seen_at: string }>(
      `SELECT u.*, s.id AS session_id, s.last_seen_at FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND u.status = 'active'`, [tokenHash, now]),

  sessionStatement: (s: { id: string; userId: string; tokenHash: string; userAgent: string | null; now: string; expiresAt: string }) => ({
    sql: `INSERT INTO sessions (id, user_id, token_hash, user_agent, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    params: [s.id, s.userId, s.tokenHash, s.userAgent, s.now, s.now, s.expiresAt],
  }),

  revokeSession: (db: Db, tokenHash: string, now: string) =>
    db.run('UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL', [now, tokenHash]),

  recordAttempt: (db: Db, a: { id: string; identifier: string; success: boolean; now: string }) =>
    db.run('INSERT INTO login_attempts (id, identifier, success, created_at) VALUES (?, ?, ?, ?)', [a.id, a.identifier, a.success ? 1 : 0, a.now]),

  async countFailures(db: Db, identifier: string, since: string) {
    const r = await db.one<{ n: number }>(
      'SELECT COUNT(*) AS n FROM login_attempts WHERE identifier = ? AND success = 0 AND created_at > ?', [identifier, since]);
    return Number(r?.n ?? 0);
  },

  async setting<T>(db: Db, key: string, fallback: T): Promise<T> {
    const r = await db.one<{ value: string }>('SELECT value FROM platform_settings WHERE key = ?', [key]);
    return r ? (JSON.parse(r.value) as T) : fallback;
  },
};
