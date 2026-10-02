import { describe, expect, it } from 'vitest';
import type { AdminUserList, SessionCreated } from '../../shared/contracts.js';
import { setup, validSignup, type TestCtx } from './helpers.js';

async function account(t: TestCtx, email: string, intent: 'learn' | 'teach', name: string) {
  const r = await t.call<SessionCreated>('POST', '/api/auth/signup', { body: validSignup({ email, intent, displayName: name }) });
  return { token: r.json.data.token, id: r.json.data.me.id };
}

describe('admin: users (tela 30)', () => {
  it('lists, filters and searches people; suspending ends their sessions at once', async () => {
    const t = await setup();
    const admin = await account(t, 'admin@example.com', 'learn', 'Admin Hazluno');
    await t.deps.db.run(`INSERT INTO user_roles (user_id, role, granted_at) VALUES (?, 'admin', 'x')`, [admin.id]);
    const ana = await account(t, 'ana@example.com', 'learn', 'Ana Silva');
    await account(t, 'laura@example.com', 'teach', 'Laura Méndez');

    expect((await t.call('GET', '/api/admin/users', { token: ana.token })).status).toBe(403);
    const all = await t.call<AdminUserList>('GET', '/api/admin/users', { token: admin.token });
    expect(all.json.data.counts).toMatchObject({ all: 3, teachers: 1, suspended: 0 });
    const teachers = await t.call<AdminUserList>('GET', '/api/admin/users?role=instructor', { token: admin.token });
    expect(teachers.json.data.items.map((u) => u.name)).toEqual(['Laura Méndez']);
    const found = await t.call<AdminUserList>('GET', '/api/admin/users?q=ANA', { token: admin.token });
    expect(found.json.data.items.map((u) => u.email)).toEqual(['ana@example.com']);

    expect((await t.call('POST', `/api/admin/users/${ana.id}/suspend`, { token: admin.token, body: {} })).status).toBe(400); // a reason is required
    expect((await t.call('POST', `/api/admin/users/${admin.id}/suspend`, { token: admin.token, body: { reason: 'test' } })).status).toBe(409);
    expect((await t.call('POST', `/api/admin/users/${ana.id}/suspend`, { token: admin.token, body: { reason: 'Spam repetido' } })).status).toBe(200);
    expect((await t.call('GET', '/api/me', { token: ana.token })).status).toBe(401);
    const login = await t.call('POST', '/api/auth/login', { body: { email: 'ana@example.com', password: 'correct-horse-9' } });
    expect(login.json.error).toBe('account_suspended');
    expect((await t.call<AdminUserList>('GET', '/api/admin/users?status=suspended', { token: admin.token })).json.data.items[0]!.name).toBe('Ana Silva');

    expect((await t.call('POST', `/api/admin/users/${ana.id}/reinstate`, { token: admin.token })).status).toBe(200);
    expect((await t.call('POST', '/api/auth/login', { body: { email: 'ana@example.com', password: 'correct-horse-9' } })).status).toBe(200);
  });
});
