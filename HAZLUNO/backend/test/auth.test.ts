import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Me, SessionCreated, SessionInfo } from '../../shared/contracts.js';
import type { AppEnv } from '../src/common/env.js';
import { AppError } from '../src/common/errors.js';
import { requireAuth, requireRole } from '../src/modules/auth/middleware.js';
import { setup, validSignup, type TestCtx } from './helpers.js';

let t: TestCtx;
beforeEach(async () => { t = await setup(); });

const signup = (over: Record<string, unknown> = {}) => t.call<SessionCreated>('POST', '/api/auth/signup', { body: validSignup(over) });

describe('signup', () => {
  it('"I want to learn" creates a student account and signs in', async () => {
    const r = await signup();
    expect(r.status).toBe(201);
    expect(r.json.data.me).toMatchObject({ email: 'lucia@example.com', languageCode: 'es', countryCode: 'ES', roles: ['student'], instructor: null });
    expect((await t.call<Me>('GET', '/api/me', { token: r.json.data.token })).json.data.displayName).toBe('Lucía Fernández');
  });

  it('"I want to teach" adds an instructor profile waiting for verification', async () => {
    const r = await signup({ intent: 'teach', email: 'marco@example.com' });
    expect(r.json.data.me.roles).toEqual(['instructor', 'student']);
    expect(r.json.data.me.instructor).toEqual({ verificationStatus: 'pending' });
  });

  it('records consent to the terms and privacy policy, with their version', async () => {
    const r = await signup();
    const rows = await t.deps.db.all<{ kind: string; version: string; granted: number }>(
      'SELECT kind, version, granted FROM consents WHERE user_id = ? ORDER BY kind', [r.json.data.me.id]);
    expect(rows).toEqual([{ kind: 'privacy', version: '2026-10-01', granted: 1 }, { kind: 'terms', version: '2026-10-01', granted: 1 }]);
  });

  it('answers with field codes the app can translate', async () => {
    const r = await signup({ password: 'short', acceptTerms: false, countryCode: 'XX', displayName: '', languageCode: 'nl' });
    expect(r.status).toBe(400);
    expect(r.json.fields).toMatchObject({ password: 'too_short', acceptTerms: 'must_accept', displayName: 'too_short', languageCode: 'invalid_option' });
    const country = await signup({ countryCode: 'XX' });
    expect(country.json.fields).toEqual({ countryCode: 'invalid_option' });
  });

  it('refuses an e-mail that already has an account (any capitalization)', async () => {
    await signup();
    const r = await signup({ email: 'LUCIA@Example.com' });
    expect(r.status).toBe(409);
    expect(r.json.error).toBe('email_taken');
  });

  it('never stores the password itself, and never stores the IP in clear', async () => {
    await signup();
    const u = await t.deps.db.one<{ password_hash: string }>('SELECT password_hash FROM users');
    expect(u!.password_hash).toMatch(/^pbkdf2\$100000\$/);
    expect(u!.password_hash).not.toContain('correct-horse-9');
    const logs = await t.deps.db.all<{ ip_hash: string }>('SELECT ip_hash FROM audit_logs');
    expect(logs.length).toBeGreaterThan(0);
    for (const l of logs) expect(l.ip_hash).not.toContain('10.0.0.1');
  });
});

describe('login and sessions', () => {
  it('signs in ignoring e-mail case and stray spaces, and signs out for real', async () => {
    await signup();
    const r = await t.call<SessionCreated>('POST', '/api/auth/login', { body: { email: ' Lucia@EXAMPLE.com', password: 'correct-horse-9 ' } });
    expect(r.status).toBe(200);
    const token = r.json.data.token;
    expect((await t.call('GET', '/api/me', { token })).status).toBe(200);
    await t.call('POST', '/api/auth/logout', { token });
    expect((await t.call('GET', '/api/me', { token })).status).toBe(401);
  });

  it('gives the same answer for a wrong password and an unknown e-mail', async () => {
    await signup();
    const wrong = await t.call('POST', '/api/auth/login', { body: { email: 'lucia@example.com', password: 'nope-nope' } });
    const unknown = await t.call('POST', '/api/auth/login', { body: { email: 'ghost@example.com', password: 'nope-nope' } });
    expect([wrong.status, wrong.json.error]).toEqual([401, 'invalid_credentials']);
    expect([unknown.status, unknown.json.error]).toEqual([401, 'invalid_credentials']);
  });

  it('locks an e-mail after 10 wrong passwords for 15 minutes', async () => {
    await signup();
    for (let i = 0; i < 10; i++) await t.call('POST', '/api/auth/login', { body: { email: 'lucia@example.com', password: 'wrong-pass' }, ip: `10.1.0.${i}` });
    const locked = await t.call('POST', '/api/auth/login', { body: { email: 'lucia@example.com', password: 'correct-horse-9' }, ip: '10.2.0.1' });
    expect(locked.status).toBe(429);
    t.clock.advanceMinutes(16);
    expect((await t.call('POST', '/api/auth/login', { body: { email: 'lucia@example.com', password: 'correct-horse-9' }, ip: '10.2.0.1' })).status).toBe(200);
  });

  it('sessions expire after the configured number of days', async () => {
    const token = (await signup()).json.data.token;
    t.clock.advanceMinutes(31 * 24 * 60);
    expect((await t.call('GET', '/api/me', { token })).status).toBe(401);
  });

  it('a suspended account cannot sign in and loses its open sessions', async () => {
    const token = (await signup()).json.data.token;
    await t.deps.db.run(`UPDATE users SET status = 'suspended'`);
    expect((await t.call('GET', '/api/me', { token })).status).toBe(401);
    const r = await t.call('POST', '/api/auth/login', { body: { email: 'lucia@example.com', password: 'correct-horse-9' } });
    expect([r.status, r.json.error]).toEqual([403, 'account_suspended']);
  });

  it('records sign-ups, sign-ins and failures in the audit log', async () => {
    await signup();
    await t.call('POST', '/api/auth/login', { body: { email: 'lucia@example.com', password: 'wrong-pass' } });
    await t.call('POST', '/api/auth/login', { body: { email: 'lucia@example.com', password: 'correct-horse-9' } });
    const actions = (await t.deps.db.all<{ action: string }>('SELECT action FROM audit_logs ORDER BY created_at, rowid')).map((a) => a.action);
    expect(actions).toEqual(['auth.signup', 'auth.login_failed', 'auth.login']);
  });
});

describe('account', () => {
  it('updates name, language and country', async () => {
    const token = (await signup()).json.data.token;
    const r = await t.call<Me>('PATCH', '/api/me', { token, body: { displayName: 'Lucía F.', languageCode: 'fr', countryCode: 'FR' } });
    expect(r.json.data).toMatchObject({ displayName: 'Lucía F.', languageCode: 'fr', countryCode: 'FR' });
  });

  it('changing the password signs out the other devices but keeps this one', async () => {
    const phone = (await signup()).json.data.token;
    const laptop = (await t.call<SessionCreated>('POST', '/api/auth/login', { body: { email: 'lucia@example.com', password: 'correct-horse-9' } })).json.data.token;
    const wrong = await t.call('POST', '/api/me/password', { token: phone, body: { currentPassword: 'bad-bad-bad', newPassword: 'new-password-1' } });
    expect(wrong.json.error).toBe('wrong_password');
    expect((await t.call('POST', '/api/me/password', { token: phone, body: { currentPassword: 'correct-horse-9', newPassword: 'new-password-1' } })).status).toBe(200);
    expect((await t.call('GET', '/api/me', { token: phone })).status).toBe(200);
    expect((await t.call('GET', '/api/me', { token: laptop })).status).toBe(401);
  });

  it('lists connected devices and disconnects one remotely', async () => {
    const phone = (await signup()).json.data.token;
    const laptop = (await t.call<SessionCreated>('POST', '/api/auth/login', { body: { email: 'lucia@example.com', password: 'correct-horse-9' } })).json.data.token;
    const list = (await t.call<SessionInfo[]>('GET', '/api/me/sessions', { token: phone })).json.data;
    expect(list).toHaveLength(2);
    const other = list.find((s) => !s.current)!;
    expect((await t.call('DELETE', `/api/me/sessions/${other.id}`, { token: phone })).status).toBe(200);
    expect((await t.call('GET', '/api/me', { token: laptop })).status).toBe(401);
  });

  it('cannot disconnect a device from someone else', async () => {
    const lucia = (await signup()).json.data.token;
    const marco = (await signup({ email: 'marco@example.com' })).json.data.token;
    const marcoSession = (await t.call<SessionInfo[]>('GET', '/api/me/sessions', { token: marco })).json.data[0]!;
    expect((await t.call('DELETE', `/api/me/sessions/${marcoSession.id}`, { token: lucia })).status).toBe(404);
    expect((await t.call('GET', '/api/me', { token: marco })).status).toBe(200);
  });

  it('a student can apply to teach later', async () => {
    const token = (await signup()).json.data.token;
    const r = await t.call<Me>('POST', '/api/me/instructor', { token });
    expect(r.json.data.roles).toEqual(['instructor', 'student']);
    expect(r.json.data.instructor?.verificationStatus).toBe('pending');
  });
});

describe('roles', () => {
  it('admin-only areas refuse students and accept admins (checked on the server)', async () => {
    const guarded = new Hono<AppEnv>();
    guarded.onError((e, c) => c.json({ error: (e as AppError).code }, (e as AppError).status));
    guarded.use('*', requireAuth(t.deps), requireRole('admin'));
    guarded.get('/admin', (c) => c.json({ ok: true }));
    const r = await signup();
    const token = r.json.data.token;
    expect((await guarded.request('/admin', { headers: { authorization: `Bearer ${token}` } })).status).toBe(403);
    await t.deps.db.run(`INSERT INTO user_roles (user_id, role, granted_at) VALUES (?, 'admin', 'x')`, [r.json.data.me.id]);
    expect((await guarded.request('/admin', { headers: { authorization: `Bearer ${token}` } })).status).toBe(200);
  });
});

describe('password recovery', () => {
  it('says it is unavailable when no e-mail provider is configured (never pretends it sent)', async () => {
    await signup();
    const r = await t.call('POST', '/api/auth/password/forgot', { body: { email: 'lucia@example.com' } });
    expect([r.status, r.json.error]).toEqual([503, 'email_unavailable']);
  });

  it('with e-mail configured: one-time link, new password works, every device is signed out', async () => {
    t = await setup({ withMailer: true });
    const oldToken = (await signup()).json.data.token;
    expect((await t.call('POST', '/api/auth/password/forgot', { body: { email: 'ghost@example.com' } })).status).toBe(200);
    expect(t.sentMail).toHaveLength(0); // unknown e-mail: same answer, nothing sent
    await t.call('POST', '/api/auth/password/forgot', { body: { email: 'lucia@example.com' } });
    expect(t.sentMail).toHaveLength(1);
    const resetToken = /token=([0-9a-f]+)/.exec(t.sentMail[0]!.text)![1]!;
    expect((await t.call('POST', '/api/auth/password/reset', { body: { token: resetToken, password: 'brand-new-pass' } })).status).toBe(200);
    expect((await t.call('GET', '/api/me', { token: oldToken })).status).toBe(401);
    expect((await t.call('POST', '/api/auth/login', { body: { email: 'lucia@example.com', password: 'brand-new-pass' } })).status).toBe(200);
    const again = await t.call('POST', '/api/auth/password/reset', { body: { token: resetToken, password: 'another-pass-1' } });
    expect([again.status, again.json.error]).toEqual([410, 'invalid_token']);
  });

  it('the recovery link expires after one hour', async () => {
    t = await setup({ withMailer: true });
    await signup();
    await t.call('POST', '/api/auth/password/forgot', { body: { email: 'lucia@example.com' } });
    const resetToken = /token=([0-9a-f]+)/.exec(t.sentMail[0]!.text)![1]!;
    t.clock.advanceMinutes(61);
    expect((await t.call('POST', '/api/auth/password/reset', { body: { token: resetToken, password: 'brand-new-pass' } })).status).toBe(410);
  });
});
