import { beforeEach, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.js';

let t: TestCtx;
beforeEach(async () => { t = await setup(); });

const ENTITIES = [
  'users', 'student_profiles', 'instructor_profiles', 'countries', 'languages', 'categories', 'courses', 'course_modules',
  'lessons', 'class_sessions', 'enrollments', 'payments', 'payment_transactions', 'platform_fees', 'instructor_payouts',
  'refunds', 'certificates', 'certificate_verifications', 'live_sessions', 'recordings', 'materials', 'reviews',
  'notifications', 'reports', 'moderation_actions', 'audit_logs', 'support_tickets', 'favorites', 'waitlist',
  'user_roles', 'sessions', 'consents', 'fee_rules', 'platform_settings', 'conversations', 'messages', 'attendances',
];

async function seedClass(over: Record<string, string | number> = {}) {
  const db = t.deps.db;
  const now = '2026-10-01T09:00:00.000Z';
  await db.run(`INSERT INTO users (id, email, display_name, country_code, language_code, created_at, updated_at)
                VALUES ('u1', 'prof@example.com', 'Prof', 'IT', 'it', ?, ?)`, [now, now]);
  await db.run(`INSERT INTO courses (id, instructor_id, category_id, title, language_code, created_at, updated_at)
                VALUES ('c1', 'u1', 'culinary', 'Pasta fresca', 'it', ?, ?)`, [now, now]);
  const v = { status: 'enrollment_open', capacity: 20, seats_taken: 0, deadline: '2026-10-05T08:00:00.000Z', starts: '2026-10-05T09:00:00.000Z', ...over };
  return db.run(`INSERT INTO class_sessions (id, course_id, instructor_id, timezone, starts_at, ends_at, capacity, seats_taken,
                   price_cents, language_code, enrollment_deadline, status, created_at, updated_at)
                 VALUES ('s1', 'c1', 'u1', 'Europe/Rome', ?, '2026-10-11T11:00:00.000Z', ?, ?, 2000, 'it', ?, ?, ?, ?)`,
    [v.starts, v.capacity, v.seats_taken, v.deadline, v.status, now, now]);
}

describe('schema', () => {
  it('has a table for every entity of the master prompt', async () => {
    const tables = new Set((await t.deps.db.all<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table'`)).map((r) => r.name));
    expect(ENTITIES.filter((e) => !tables.has(e))).toEqual([]);
  });

  it('accepts exactly the 8 class states', async () => {
    await expect(seedClass({ status: 'open' })).rejects.toThrow();
    t = await setup();
    await expect(seedClass({ status: 'scheduled' })).resolves.toBeTruthy();
  });

  it('never lets a class have more students than seats', async () => {
    await expect(seedClass({ capacity: 20, seats_taken: 21 })).rejects.toThrow();
  });

  it('closes enrollment before the class starts', async () => {
    await expect(seedClass({ deadline: '2026-10-05T09:30:00.000Z' })).rejects.toThrow();
  });

  it('a payment split must add up to the amount paid', async () => {
    const db = t.deps.db;
    await seedClass();
    await db.run(`INSERT INTO payments (id, payer_id, purpose, class_session_id, amount_cents, currency, provider, is_test, created_at, updated_at)
                  VALUES ('p1', 'u1', 'class_opening_fee', 's1', 500, 'EUR', 'sandbox', 1, 'x', 'x')`);
    const split = (net: number) => db.run(`INSERT INTO platform_fees (id, payment_id, gross_cents, provider_fee_cents, platform_fee_cents,
      instructor_net_cents, currency, created_at) VALUES ('f1', 'p1', 2000, 50, 200, ?, 'EUR', 'x')`, [net]);
    await expect(split(1800)).rejects.toThrow();
    await expect(split(1750)).resolves.toBeTruthy();
  });

  it('starts with the business rules defined by the owner, editable as data', async () => {
    const opening = await t.deps.db.one<{ fixed_cents: number; currency: string }>(`SELECT fixed_cents, currency FROM fee_rules WHERE kind = 'class_opening_fee'`);
    expect(opening).toEqual({ fixed_cents: 500, currency: 'EUR' });
    const setting = async (k: string) => JSON.parse((await t.deps.db.one<{ value: string }>('SELECT value FROM platform_settings WHERE key = ?', [k]))!.value);
    expect(await setting('class.max_capacity')).toBe(25);
    expect(await setting('withdrawal.retention_bp')).toBe(5000);
    expect(await setting('withdrawal.retention_platform_share_bp')).toBe(5000);
  });
});

describe('public catalog', () => {
  it('lists the 12 categories in each of the 6 languages', async () => {
    for (const [lang, culinary] of [['pt', 'Culinária'], ['en', 'Cooking'], ['es', 'Cocina'], ['fr', 'Cuisine'], ['it', 'Cucina'], ['de', 'Kochen']]) {
      const r = await t.call<{ id: string; name: string }[]>('GET', `/api/public/categories?lang=${lang}`);
      expect(r.json.data).toHaveLength(12);
      expect(r.json.data[0]).toMatchObject({ id: 'culinary', name: culinary });
    }
  });

  it('falls back to English for a language not supported yet', async () => {
    const r = await t.call<{ name: string }[]>('GET', '/api/public/categories?lang=nl');
    expect(r.json.data[0]!.name).toBe('Cooking');
  });

  it('only advertises features that are really configured', async () => {
    const r = await t.call<{ socialLogin: { google: boolean; apple: boolean }; passwordRecovery: boolean; languages: unknown[] }>('GET', '/api/public/config');
    expect(r.json.data.socialLogin).toEqual({ google: false, apple: false });
    expect(r.json.data.passwordRecovery).toBe(false);
    expect(r.json.data.languages).toHaveLength(6);
    const withMail = await setup({ withMailer: true });
    const r2 = await withMail.call<{ passwordRecovery: boolean }>('GET', '/api/public/config');
    expect(r2.json.data.passwordRecovery).toBe(true);
  });
});
