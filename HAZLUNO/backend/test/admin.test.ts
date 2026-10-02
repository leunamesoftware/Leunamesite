import { describe, expect, it } from 'vitest';
import type { AdminClassRow, AdminCourseRow, AdminPage, AdminUserList, SessionCreated } from '../../shared/contracts.js';
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

describe('admin: courses and groups (telas 31–32)', () => {
  it('hides a course from the catalog and cancels a group with full refunds', async () => {
    const t = await setup({ withPayments: true });
    const admin = await account(t, 'admin@example.com', 'learn', 'Admin');
    await t.deps.db.run(`INSERT INTO user_roles (user_id, role, granted_at) VALUES (?, 'admin', 'x')`, [admin.id]);
    const laura = await account(t, 'laura@example.com', 'teach', 'Laura Méndez');
    await t.call('PUT', '/api/instructor/profile', { token: laura.token, body: {
      phone: '+34 612 345 678', city: 'Madrid', headline: 'Pintora', bio: 'Doce años enseñando.', specialties: ['Óleo'], teachingLanguages: ['es'],
      legalEntityType: 'individual', legalName: 'Laura Méndez Ruiz', taxId: 'X1234567L', taxCountry: 'ES', businessAddress: 'Calle Mayor 1, Madrid' } });
    await t.call('POST', '/api/instructor/profile/submit', { token: laura.token, body: { acceptAgreement: true } });
    await t.call('POST', `/api/admin/instructors/${laura.id}/approve`, { token: admin.token });
    const c = await t.call<{ id: string }>('POST', '/api/instructor/courses', { token: laura.token, body: {
      title: 'Pintura creativa', summary: 'Aprende a pintar.', description: 'Clase práctica.', categoryId: 'art', languageCode: 'es', level: 'beginner', learningOutcomes: [], requiredMaterials: [] } });
    await t.call('POST', `/api/instructor/courses/${c.json.data.id}/publish`, { token: laura.token });
    const k = await t.call<{ id: string }>('POST', `/api/instructor/courses/${c.json.data.id}/classes`, { token: laura.token, body: {
      timezone: 'Europe/Madrid', capacity: 10, priceCents: 0, meetings: [{ start: '2026-10-15T07:00:00.000Z', end: '2026-10-15T08:00:00.000Z' }] } });
    // Opening a group costs €5 even when the group is free: paid through the fake provider.
    const fee = await t.call<{ url: string }>('POST', `/api/instructor/classes/${k.json.data.id}/opening-fee`, { token: laura.token });
    const s = [...t.stripe!.sessions.values()].find((x) => x.url === fee.json.data.url)!;
    await t.webhook('checkout.session.completed', { id: s.id, payment_status: 'paid', payment_intent: s.paymentIntent, metadata: s.metadata });
    const ana = await account(t, 'ana@example.com', 'learn', 'Ana Silva');
    expect((await t.call<{ status: string }>('POST', '/api/me/enrollments', { token: ana.token, body: { classId: k.json.data.id } })).json.data.status).toBe('confirmed');

    const courses = await t.call<AdminPage<AdminCourseRow>>('GET', '/api/admin/courses?status=published', { token: admin.token });
    expect(courses.json.data.items[0]).toMatchObject({ title: 'Pintura creativa', teacherName: 'Laura Méndez', groups: 1, openGroups: 1, students: 1 });
    expect((await t.call('POST', `/api/admin/courses/${c.json.data.id}/hide`, { token: admin.token, body: {} })).status).toBe(400);
    expect((await t.call('POST', `/api/admin/courses/${c.json.data.id}/hide`, { token: admin.token, body: { reason: 'Contenido engañoso' } })).status).toBe(200);
    expect((await t.call<{ items: unknown[] }>('GET', '/api/public/explore')).json.data.items).toHaveLength(0);
    expect((await t.call('POST', `/api/admin/courses/${c.json.data.id}/show`, { token: admin.token })).status).toBe(200);
    expect((await t.call<{ items: unknown[] }>('GET', '/api/public/explore')).json.data.items).toHaveLength(1);

    const groups = await t.call<AdminPage<AdminClassRow>>('GET', '/api/admin/classes?status=upcoming', { token: admin.token });
    expect(groups.json.data.items[0]).toMatchObject({ seatsTaken: 1, capacity: 10, openingFeePaid: true, meetings: 1 });
    expect((await t.call('POST', `/api/admin/classes/${k.json.data.id}/cancel`, { token: admin.token, body: { reason: 'Profesor no disponible' } })).status).toBe(200);
    expect((await t.deps.db.one<{ status: string }>('SELECT status FROM enrollments WHERE student_id = ?', [ana.id]))!.status).toBe('canceled_by_platform');
    expect((await t.call<AdminPage<AdminClassRow>>('GET', '/api/admin/classes?status=canceled', { token: admin.token })).json.data.total).toBe(1);
  });
});
