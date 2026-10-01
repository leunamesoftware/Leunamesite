import type { Me, SessionCreated } from '../../../../shared/contracts.js';
import type { Deps } from '../../common/env.js';
import { AppError, errors } from '../../common/errors.js';
import { hashPassword, newId, randomToken, sha256, verifyPassword } from '../../common/security.js';
import { parse } from '../../common/validation.js';
import { auditStatement } from '../audit/audit.js';
import { authRepo, type UserRow } from './repository.js';
import { forgotSchema, loginSchema, resetSchema, signupSchema } from './schemas.js';

const MAX_FAILURES = 10;
const WINDOW_MIN = 15;
const RESET_TOKEN_MIN = 60;

export interface RequestMeta { ip: string; ipHash: string; userAgent: string | null }

async function guard(deps: Deps, identifiers: string[]) {
  const since = new Date(deps.clock.now().getTime() - WINDOW_MIN * 60_000).toISOString();
  for (const id of identifiers) {
    if ((await authRepo.countFailures(deps.db, id, since)) >= MAX_FAILURES) {
      throw new AppError('too_many_attempts', 429, `Too many attempts. Wait ${WINDOW_MIN} minutes and try again.`);
    }
  }
}

async function record(deps: Deps, identifiers: string[], success: boolean) {
  const now = deps.clock.now().toISOString();
  for (const identifier of identifiers) await authRepo.recordAttempt(deps.db, { id: newId(), identifier, success, now });
}

async function newSession(deps: Deps, userId: string, meta: RequestMeta) {
  const token = randomToken();
  const now = deps.clock.now();
  const expiresAt = new Date(now.getTime() + deps.config.sessionDays * 86_400_000).toISOString();
  const statement = authRepo.sessionStatement({
    id: newId(), userId, tokenHash: await sha256(token), userAgent: meta.userAgent, now: now.toISOString(), expiresAt,
  });
  return { token, expiresAt, statement };
}

export async function signup(deps: Deps, input: unknown, meta: RequestMeta): Promise<SessionCreated> {
  const ids = [`signup:${meta.ip}`];
  await guard(deps, ids);
  const d = parse(signupSchema, input);
  const country = await deps.db.one<{ code: string }>('SELECT code FROM countries WHERE code = ? AND is_active = 1', [d.countryCode]);
  if (!country) throw errors.invalid({ countryCode: 'invalid_option' });
  if (await authRepo.userByEmail(deps.db, d.email)) {
    await record(deps, ids, false);
    throw new AppError('email_taken', 409, 'An account with this e-mail already exists.', { email: 'email_taken' });
  }

  const now = deps.clock.now().toISOString();
  const userId = newId();
  const termsVersion = await authRepo.setting(deps.db, 'legal.terms_version', 'unknown');
  const privacyVersion = await authRepo.setting(deps.db, 'legal.privacy_version', 'unknown');
  const session = await newSession(deps, userId, meta);

  const statements = [
    {
      sql: `INSERT INTO users (id, email, password_hash, display_name, country_code, language_code, timezone, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [userId, d.email, await hashPassword(d.password, deps.config.passwordPepper), d.displayName, d.countryCode,
        d.languageCode, d.timezone ?? 'Europe/Lisbon', now, now],
    },
    // Everyone can learn; "teach" adds an instructor profile that starts pending verification.
    { sql: `INSERT INTO user_roles (user_id, role, granted_at) VALUES (?, 'student', ?)`, params: [userId, now] },
    { sql: 'INSERT INTO student_profiles (user_id, created_at, updated_at) VALUES (?, ?, ?)', params: [userId, now, now] },
    ...(d.intent === 'teach' ? instructorStatements(userId, now) : []),
    { sql: `INSERT INTO consents (id, user_id, kind, version, granted, ip_hash, created_at) VALUES (?, ?, 'terms', ?, 1, ?, ?)`,
      params: [newId(), userId, termsVersion, meta.ipHash, now] },
    { sql: `INSERT INTO consents (id, user_id, kind, version, granted, ip_hash, created_at) VALUES (?, ?, 'privacy', ?, 1, ?, ?)`,
      params: [newId(), userId, privacyVersion, meta.ipHash, now] },
    session.statement,
    auditStatement(deps, { actorId: userId, action: 'auth.signup', targetType: 'user', targetId: userId, ipHash: meta.ipHash,
      userAgent: meta.userAgent, data: { intent: d.intent } }),
  ];
  await deps.db.batch(statements);
  await record(deps, ids, true);
  const user = (await authRepo.userById(deps.db, userId))!;
  return { token: session.token, expiresAt: session.expiresAt, me: await authRepo.loadMe(deps.db, user) };
}

export function instructorStatements(userId: string, now: string) {
  return [
    { sql: `INSERT INTO user_roles (user_id, role, granted_at) VALUES (?, 'instructor', ?)`, params: [userId, now] },
    { sql: 'INSERT INTO instructor_profiles (user_id, created_at, updated_at) VALUES (?, ?, ?)', params: [userId, now, now] },
  ];
}

export async function login(deps: Deps, input: unknown, meta: RequestMeta): Promise<SessionCreated> {
  const d = parse(loginSchema, input);
  const ids = [`login:${d.email}`, `login-ip:${meta.ip}`];
  await guard(deps, ids);
  const u = await authRepo.userByEmail(deps.db, d.email);
  const hash = u?.status === 'deleted' ? null : u?.password_hash;
  // Stray spaces from phone keyboards must not block login.
  const valid = !!hash && ((await verifyPassword(d.password, hash, deps.config.passwordPepper))
    || (d.password !== d.password.trim() && (await verifyPassword(d.password.trim(), hash, deps.config.passwordPepper))));
  await record(deps, ids, valid);
  if (!u || !valid) {
    if (u) await deps.db.batch([auditStatement(deps, { actorId: u.id, action: 'auth.login_failed', ipHash: meta.ipHash, userAgent: meta.userAgent })]);
    throw new AppError('invalid_credentials', 401, 'Incorrect e-mail or password.');
  }
  if (u.status === 'suspended') throw new AppError('account_suspended', 403, 'This account is suspended. Contact support.');
  const session = await newSession(deps, u.id, meta);
  await deps.db.batch([
    session.statement,
    auditStatement(deps, { actorId: u.id, action: 'auth.login', ipHash: meta.ipHash, userAgent: meta.userAgent }),
  ]);
  return { token: session.token, expiresAt: session.expiresAt, me: await authRepo.loadMe(deps.db, u) };
}

export async function logout(deps: Deps, token: string) {
  await authRepo.revokeSession(deps.db, await sha256(token), deps.clock.now().toISOString());
}

/** Session lookup used by the auth middleware. Refreshes "last seen" at most every 5 minutes. */
export async function resolveSession(deps: Deps, token: string): Promise<{ me: Me; tokenHash: string } | null> {
  const tokenHash = await sha256(token);
  const now = deps.clock.now();
  const row = await authRepo.userBySession(deps.db, tokenHash, now.toISOString());
  if (!row) return null;
  if (now.getTime() - Date.parse(row.last_seen_at) > 5 * 60_000) {
    await deps.db.run('UPDATE sessions SET last_seen_at = ? WHERE id = ?', [now.toISOString(), row.session_id]);
  }
  return { me: await authRepo.loadMe(deps.db, row as UserRow), tokenHash };
}

export async function forgotPassword(deps: Deps, input: unknown, meta: RequestMeta) {
  const d = parse(forgotSchema, input);
  if (!deps.mailer) throw new AppError('email_unavailable', 503, 'Password recovery by e-mail is not available yet. Contact support.');
  const ids = [`forgot:${meta.ip}`];
  await guard(deps, ids);
  await record(deps, ids, false); // counts every request, so the endpoint cannot be used to flood inboxes
  const u = await authRepo.userByEmail(deps.db, d.email);
  // Same answer whether or not the account exists (does not reveal who is registered).
  if (!u || u.status !== 'active') return;
  const token = randomToken();
  const now = deps.clock.now();
  await deps.db.batch([
    { sql: `UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND purpose = 'password_reset' AND used_at IS NULL`,
      params: [now.toISOString(), u.id] },
    { sql: `INSERT INTO auth_tokens (id, user_id, purpose, token_hash, created_at, expires_at) VALUES (?, ?, 'password_reset', ?, ?, ?)`,
      params: [newId(), u.id, await sha256(token), now.toISOString(), new Date(now.getTime() + RESET_TOKEN_MIN * 60_000).toISOString()] },
    auditStatement(deps, { actorId: u.id, action: 'auth.password_reset_requested', ipHash: meta.ipHash, userAgent: meta.userAgent }),
  ]);
  await deps.mailer.send({
    to: u.email,
    subject: 'Hazluno — reset your password',
    text: `${deps.config.publicUrl}/reset-password?token=${token}\n\nThis link expires in ${RESET_TOKEN_MIN} minutes.`,
  });
}

export async function resetPassword(deps: Deps, input: unknown, meta: RequestMeta) {
  const d = parse(resetSchema, input);
  const now = deps.clock.now().toISOString();
  const t = await deps.db.one<{ id: string; user_id: string }>(
    `SELECT id, user_id FROM auth_tokens WHERE token_hash = ? AND purpose = 'password_reset' AND used_at IS NULL AND expires_at > ?`,
    [await sha256(d.token), now]);
  if (!t) throw new AppError('invalid_token', 410, 'This link is invalid or has expired. Request a new one.');
  await deps.db.batch([
    { sql: 'UPDATE auth_tokens SET used_at = ? WHERE id = ?', params: [now, t.id] },
    { sql: 'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
      params: [await hashPassword(d.password, deps.config.passwordPepper), now, t.user_id] },
    // A reset signs out every device (whoever had the old password loses access).
    { sql: 'UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', params: [now, t.user_id] },
    auditStatement(deps, { actorId: t.user_id, action: 'auth.password_reset', ipHash: meta.ipHash, userAgent: meta.userAgent }),
  ]);
}
