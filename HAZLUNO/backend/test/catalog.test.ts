import { beforeEach, describe, expect, it } from 'vitest';
import type {
  AgendaItem, ClassSummary, CourseCard, CourseDetail, ExploreResult, InstructorCourse, InstructorProfile, InstructorPublic, Me, SessionCreated,
} from '../../shared/contracts.js';
import { setup, validSignup, type TestCtx } from './helpers.js';

// "Now" in these tests: Thu 1 Oct 2026, 09:00 UTC.
let t: TestCtx;
beforeEach(async () => { t = await setup(); });

const day = (d: number, hh: number, mm = 0) => new Date(Date.UTC(2026, 9, d, hh, mm)).toISOString();

async function account(email: string, intent: 'learn' | 'teach', over: Record<string, unknown> = {}) {
  const r = await t.call<SessionCreated>('POST', '/api/auth/signup', { body: validSignup({ email, intent, ...over }) });
  expect(r.status).toBe(201);
  return { token: r.json.data.token, id: r.json.data.me.id };
}

const legal = {
  headline: 'Pintora y profesora', bio: 'Doce años enseñando pintura al óleo.', specialties: ['Óleo', 'Acuarela'], teachingLanguages: ['es'],
  legalEntityType: 'individual', legalName: 'Laura Méndez Ruiz', taxId: 'X1234567L', taxCountry: 'ES', businessAddress: 'Calle Mayor 1, Madrid',
};

async function approvedTeacher(email = 'laura@example.com', name = 'Laura Méndez') {
  const teacher = await account(email, 'teach', { displayName: name });
  await t.call('PUT', '/api/instructor/profile', { token: teacher.token, body: legal });
  expect((await t.call('POST', '/api/instructor/profile/submit', { token: teacher.token })).status).toBe(200);
  const admin = await adminToken();
  expect((await t.call('POST', `/api/admin/instructors/${teacher.id}/approve`, { token: admin })).status).toBe(200);
  return teacher;
}

let adminTok: string | null = null;
async function adminToken() {
  if (adminTok && (await t.call('GET', '/api/me', { token: adminTok })).status === 200) return adminTok;
  const a = await account(`admin${Math.random().toString(36).slice(2)}@example.com`, 'learn');
  await t.deps.db.run(`INSERT INTO user_roles (user_id, role, granted_at) VALUES (?, 'admin', 'x')`, [a.id]);
  adminTok = a.token;
  return a.token;
}

const courseBody = (over: Record<string, unknown> = {}) => ({
  title: 'Pintura creativa para principiantes', summary: 'Aprende técnicas básicas de pintura.', description: 'Clase práctica en directo.',
  categoryId: 'art', languageCode: 'es', level: 'beginner', learningOutcomes: ['Mezclar colores'], requiredMaterials: ['Pinceles'], ...over,
});

const classBody = (over: Record<string, unknown> = {}) => ({
  label: 'Mañana', timezone: 'Europe/Madrid', capacity: 20, priceCents: 2000,
  meetings: [{ start: day(15, 7), end: day(15, 8, 30) }, { start: day(16, 7), end: day(16, 8, 30) }], ...over,
});

async function publishedCourseWithClass(teacher: { token: string }, course: Record<string, unknown> = {}, klass: Record<string, unknown> = {}) {
  const c = await t.call<InstructorCourse>('POST', '/api/instructor/courses', { token: teacher.token, body: courseBody(course) });
  expect(c.status).toBe(201);
  expect((await t.call('POST', `/api/instructor/courses/${c.json.data.id}/publish`, { token: teacher.token })).status).toBe(200);
  const k = await t.call<ClassSummary>('POST', `/api/instructor/courses/${c.json.data.id}/classes`, { token: teacher.token, body: classBody(klass) });
  expect(k.status).toBe(201);
  expect((await t.call('POST', `/api/instructor/classes/${k.json.data.id}/publish`, { token: teacher.token })).status).toBe(200);
  return { courseId: c.json.data.id, classId: k.json.data.id };
}

const explore = (query = '', token?: string) => t.call<ExploreResult>('GET', `/api/public/explore${query}`, { token });

async function upload(path: string, token: string, bytes: Uint8Array, name = 'img.png') {
  const form = new FormData();
  form.append('file', new Blob([bytes as unknown as ArrayBuffer]), name);
  const res = await t.app.request(path, { method: 'POST', headers: { authorization: `Bearer ${token}`, origin: 'http://localhost:5174' }, body: form });
  return { status: res.status, json: (await res.json()) as { ok: boolean; data: { avatarUrl?: string | null; coverUrl?: string | null }; error?: string } };
}
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

describe('teacher verification', () => {
  it('a new teacher can prepare a draft but cannot publish before approval', async () => {
    const teacher = await account('laura@example.com', 'teach');
    const c = await t.call<InstructorCourse>('POST', '/api/instructor/courses', { token: teacher.token, body: courseBody() });
    expect(c.json.data.status).toBe('draft');
    const pub = await t.call('POST', `/api/instructor/courses/${c.json.data.id}/publish`, { token: teacher.token });
    expect([pub.status, pub.json.error]).toEqual([403, 'instructor_not_approved']);
  });

  it('submitting needs the legal details; once under review they are locked', async () => {
    const teacher = await account('laura@example.com', 'teach');
    const empty = await t.call('POST', '/api/instructor/profile/submit', { token: teacher.token });
    expect(empty.json.fields).toMatchObject({ legalName: 'required', taxId: 'required', teachingLanguages: 'required' });
    await t.call('PUT', '/api/instructor/profile', { token: teacher.token, body: legal });
    const sent = await t.call<InstructorProfile>('POST', '/api/instructor/profile/submit', { token: teacher.token });
    expect(sent.json.data.verificationStatus).toBe('under_review');
    const change = await t.call('PUT', '/api/instructor/profile', { token: teacher.token, body: { ...legal, taxId: 'OTHER' } });
    expect(change.json.error).toBe('invalid_state');
    const bioOnly = await t.call<InstructorProfile>('PUT', '/api/instructor/profile', { token: teacher.token, body: { ...legal, bio: 'Nueva bio.' } });
    expect(bioOnly.json.data.bio).toBe('Nueva bio.');
  });

  it('an admin approves (recorded and notified); a rejected teacher can fix and resubmit', async () => {
    const teacher = await account('laura@example.com', 'teach');
    await t.call('PUT', '/api/instructor/profile', { token: teacher.token, body: legal });
    await t.call('POST', '/api/instructor/profile/submit', { token: teacher.token });
    const admin = await adminToken();
    const queue = await t.call<{ userId: string }[]>('GET', '/api/admin/instructors', { token: admin });
    expect(queue.json.data.map((r) => r.userId)).toEqual([teacher.id]);
    expect((await t.call('POST', `/api/admin/instructors/${teacher.id}/reject`, { token: admin, body: { reason: 'NIF ilegible' } })).status).toBe(200);
    const rejected = await t.call<InstructorProfile>('GET', '/api/instructor/profile', { token: teacher.token });
    expect(rejected.json.data).toMatchObject({ verificationStatus: 'rejected', rejectionReason: 'NIF ilegible' });
    await t.call('PUT', '/api/instructor/profile', { token: teacher.token, body: { ...legal, taxId: 'X7654321L' } });
    await t.call('POST', '/api/instructor/profile/submit', { token: teacher.token });
    await t.call('POST', `/api/admin/instructors/${teacher.id}/approve`, { token: admin });
    expect((await t.call<Me>('GET', '/api/me', { token: teacher.token })).json.data.instructor?.verificationStatus).toBe('approved');
    const actions = await t.deps.db.all<{ action: string }>('SELECT action FROM moderation_actions ORDER BY created_at, rowid');
    expect(actions.map((a) => a.action)).toEqual(['reject_instructor', 'approve_instructor']);
    expect(await t.deps.db.all('SELECT 1 FROM notifications WHERE user_id = ?', [teacher.id])).toHaveLength(2);
  });

  it('students cannot use the teacher area nor the admin area', async () => {
    const student = await account('lucia@example.com', 'learn');
    expect((await t.call('GET', '/api/instructor/courses', { token: student.token })).status).toBe(403);
    expect((await t.call('GET', '/api/admin/instructors', { token: student.token })).status).toBe(403);
    expect((await t.call('GET', '/api/instructor/courses')).status).toBe(401);
  });
});

describe('classes (turmas)', () => {
  it('validates seats (max 25), dates in the future, overlaps and the enrollment deadline', async () => {
    const teacher = await approvedTeacher();
    const c = await t.call<InstructorCourse>('POST', '/api/instructor/courses', { token: teacher.token, body: courseBody() });
    const create = (over: Record<string, unknown>) => t.call<ClassSummary>('POST', `/api/instructor/courses/${c.json.data.id}/classes`, { token: teacher.token, body: classBody(over) });
    expect((await create({ capacity: 30 })).json.fields).toEqual({ capacity: 'too_large' });
    expect((await create({ meetings: [{ start: day(1, 8), end: day(1, 9) }] })).json.fields).toMatchObject({ 'meetings.0.start': 'in_the_past' });
    expect((await create({ meetings: [{ start: day(15, 7), end: day(15, 9) }, { start: day(15, 8), end: day(15, 10) }] })).json.fields)
      .toMatchObject({ 'meetings.1.start': 'overlap' });
    expect((await create({ meetings: [{ start: day(15, 7), end: day(15, 7, 5) }] })).json.fields).toMatchObject({ 'meetings.0.end': 'too_small' });
    expect((await create({ enrollmentDeadline: day(15, 8) })).json.fields).toEqual({ enrollmentDeadline: 'after_start' });
    const ok = await create({});
    expect(ok.status).toBe(201);
    expect(ok.json.data).toMatchObject({ status: 'draft', startsAt: day(15, 7), endsAt: day(16, 8, 30), enrollmentDeadline: day(15, 7), seatsLeft: 20 });
    expect(ok.json.data.meetings.map((m) => m.sequence)).toEqual([1, 2]);
  });

  it('a teacher cannot have two classes at the same time', async () => {
    const teacher = await approvedTeacher();
    await publishedCourseWithClass(teacher);
    const other = await t.call<InstructorCourse>('POST', '/api/instructor/courses', { token: teacher.token, body: courseBody({ title: 'Acuarela' }) });
    const clash = await t.call('POST', `/api/instructor/courses/${other.json.data.id}/classes`, {
      token: teacher.token, body: classBody({ meetings: [{ start: day(16, 8), end: day(16, 9) }] }) });
    expect([clash.status, clash.json.error]).toEqual([409, 'schedule_conflict']);
  });

  it('only drafts are edited; a published class keeps what students bought', async () => {
    const teacher = await approvedTeacher();
    const { classId } = await publishedCourseWithClass(teacher);
    const edit = await t.call('PUT', `/api/instructor/classes/${classId}`, { token: teacher.token, body: classBody({ priceCents: 9900 }) });
    expect(edit.json.error).toBe('invalid_state');
  });

  it('cancelling a class without students removes it from the catalog', async () => {
    const teacher = await approvedTeacher();
    const { classId } = await publishedCourseWithClass(teacher);
    expect((await explore()).json.data.total).toBe(1);
    const r = await t.call<ClassSummary>('POST', `/api/instructor/classes/${classId}/cancel`, { token: teacher.token, body: { reason: 'Enfermedad' } });
    expect(r.json.data.status).toBe('canceled');
    expect((await explore()).json.data.total).toBe(0);
  });

  it('a course with open classes cannot be archived', async () => {
    const teacher = await approvedTeacher();
    const { courseId } = await publishedCourseWithClass(teacher);
    expect((await t.call('POST', `/api/instructor/courses/${courseId}/archive`, { token: teacher.token })).json.error).toBe('invalid_state');
  });

  it('the agenda lists every meeting in time order', async () => {
    const teacher = await approvedTeacher();
    await publishedCourseWithClass(teacher);
    const a = await t.call<AgendaItem[]>('GET', '/api/instructor/agenda', { token: teacher.token });
    expect(a.json.data.map((i) => i.start)).toEqual([day(15, 7), day(16, 7)]);
    expect(a.json.data[0]).toMatchObject({ courseTitle: 'Pintura creativa para principiantes', label: 'Mañana', capacity: 20, seatsTaken: 0 });
  });
});

describe('explore and course page (owner rule applied)', () => {
  it('drafts are invisible; a published class shows with "buy" for visitors', async () => {
    const teacher = await approvedTeacher();
    const c = await t.call<InstructorCourse>('POST', '/api/instructor/courses', { token: teacher.token, body: courseBody() });
    await t.call('POST', `/api/instructor/courses/${c.json.data.id}/classes`, { token: teacher.token, body: classBody() });
    expect((await explore()).json.data.total).toBe(0);
    expect((await t.call('GET', `/api/public/courses/${c.json.data.id}`)).status).toBe(404);

    t = await setup();
    const teacher2 = await approvedTeacher();
    const { courseId, classId } = await publishedCourseWithClass(teacher2);
    const list = (await explore()).json.data;
    expect(list.total).toBe(1);
    expect(list.items[0]).toMatchObject({ id: courseId, liveNow: false, minPriceCents: 2000, rating: null, reviewsCount: 0 });
    expect(list.items[0]!.nextClass).toMatchObject({ id: classId, startsAt: day(15, 7), seatsLeft: 20, priceCents: 2000 });
    const detail = await t.call<CourseDetail>('GET', `/api/public/courses/${courseId}`);
    expect(detail.json.data.classes[0]!.access).toMatchObject({ badge: 'starts_on', action: 'buy', clickable: true });
    expect(detail.json.data).toMatchObject({ requiredMaterials: ['Pinceles'], instructorHeadline: 'Pintora y profesora', studentsCount: 0 });
  });

  it('once the class starts nobody outside can buy; when it ends it leaves the catalog', async () => {
    const teacher = await approvedTeacher();
    const { courseId } = await publishedCourseWithClass(teacher);
    t.clock.at = new Date(day(15, 7, 10));
    expect((await explore()).json.data.items[0]!.nextClass).toBeNull();
    const detail = await t.call<CourseDetail>('GET', `/api/public/courses/${courseId}`);
    expect(detail.json.data.classes[0]!.access).toMatchObject({ badge: 'in_progress', action: 'none', clickable: false });
    t.clock.at = new Date(day(16, 9));
    expect((await explore()).json.data.total).toBe(0);
  });

  it('search by title, teacher name and category name; filters by category, language, price and level', async () => {
    const laura = await approvedTeacher('laura@example.com', 'Laura Méndez');
    await publishedCourseWithClass(laura);
    const carlos = await approvedTeacher('carlos@example.com', 'Carlos Ruiz');
    await publishedCourseWithClass(carlos, { title: 'Cocina saludable y fácil', summary: 'Recetas sanas para cada día.', categoryId: 'culinary', languageCode: 'en', level: 'intermediate' },
      { priceCents: 0, meetings: [{ start: day(20, 18), end: day(20, 19) }] });
    const titles = async (q: string) => (await explore(q)).json.data.items.map((i) => i.title);
    expect(await titles('?q=pintura')).toEqual(['Pintura creativa para principiantes']);
    expect(await titles('?q=carlos')).toEqual(['Cocina saludable y fácil']);
    expect(await titles('?q=Cocina')).toEqual(['Cocina saludable y fácil']);
    expect(await titles('?category=art')).toEqual(['Pintura creativa para principiantes']);
    expect(await titles('?language=en')).toEqual(['Cocina saludable y fácil']);
    expect(await titles('?price=free')).toEqual(['Cocina saludable y fácil']);
    expect(await titles('?level=beginner')).toEqual(['Pintura creativa para principiantes']);
    expect(await titles('?sort=price_asc')).toEqual(['Cocina saludable y fácil', 'Pintura creativa para principiantes']);
    expect(await titles('?sort=soonest')).toEqual(['Pintura creativa para principiantes', 'Cocina saludable y fácil']);
    expect(await titles('?q=50%25')).toEqual([]);
    expect((await explore('?level=expert')).status).toBe(400);
  });

  it('public teacher profile only for approved teachers, with their open courses', async () => {
    const pending = await account('nuevo@example.com', 'teach');
    expect((await t.call('GET', `/api/public/instructors/${pending.id}`)).status).toBe(404);
    const laura = await approvedTeacher();
    await publishedCourseWithClass(laura);
    const p = await t.call<InstructorPublic>('GET', `/api/public/instructors/${laura.id}`);
    expect(p.json.data).toMatchObject({ name: 'Laura Méndez', headline: 'Pintora y profesora', specialties: ['Óleo', 'Acuarela'], rating: null, studentsCount: 0 });
    expect(p.json.data.courses.map((c) => c.title)).toEqual(['Pintura creativa para principiantes']);
  });
});

describe('student account', () => {
  it('favorites are personal and show on the cards', async () => {
    const teacher = await approvedTeacher();
    const { courseId } = await publishedCourseWithClass(teacher);
    const lucia = await account('lucia@example.com', 'learn');
    expect((await t.call('PUT', `/api/me/favorites/${courseId}`, { token: lucia.token })).status).toBe(200);
    expect((await t.call('PUT', `/api/me/favorites/${courseId}`, { token: lucia.token })).status).toBe(200); // twice is fine
    expect((await t.call<CourseCard[]>('GET', '/api/me/favorites', { token: lucia.token })).json.data.map((c) => c.id)).toEqual([courseId]);
    expect((await explore('', lucia.token)).json.data.items[0]!.favorite).toBe(true);
    expect((await explore()).json.data.items[0]!.favorite).toBe(false);
    await t.call('DELETE', `/api/me/favorites/${courseId}`, { token: lucia.token });
    expect((await t.call<CourseCard[]>('GET', '/api/me/favorites', { token: lucia.token })).json.data).toEqual([]);
  });

  it('"Mis clases" is empty until the student buys a class (Phase 3)', async () => {
    const lucia = await account('lucia@example.com', 'learn');
    expect((await t.call('GET', '/api/me/classes', { token: lucia.token })).json.data).toEqual([]);
  });

  it('profile photo: only real images, served from its address', async () => {
    const lucia = await account('lucia@example.com', 'learn');
    const bad = await upload('/api/me/avatar', lucia.token, new TextEncoder().encode('<script>alert(1)</script>'), 'x.png');
    expect([bad.status, bad.json.error]).toEqual([400, 'file_invalid']);
    const good = await upload('/api/me/avatar', lucia.token, PNG);
    const url = good.json.data.avatarUrl!;
    expect(url).toMatch(/^\/api\/files\/public\/avatars\/[0-9a-f-]{36}\.png$/);
    const res = await t.app.request(url);
    expect([res.status, res.headers.get('content-type')]).toEqual([200, 'image/png']);
    expect((await t.app.request('/api/files/public/../secret.png')).status).toBe(404);
  });

  it('course cover upload by its teacher only', async () => {
    const teacher = await approvedTeacher();
    const { courseId } = await publishedCourseWithClass(teacher);
    const other = await approvedTeacher('otro@example.com', 'Otro');
    expect((await upload(`/api/instructor/courses/${courseId}/cover`, other.token, PNG)).status).toBe(404);
    const ok = await upload(`/api/instructor/courses/${courseId}/cover`, teacher.token, PNG);
    expect(ok.json.data.coverUrl).toMatch(/^\/api\/files\/public\/covers\//);
    expect((await explore()).json.data.items[0]!.coverUrl).toBe(ok.json.data.coverUrl);
  });
});
