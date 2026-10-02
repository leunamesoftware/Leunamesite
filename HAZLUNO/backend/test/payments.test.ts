import { describe, expect, it } from 'vitest';
import type { ClassSummary, Earnings, EnrollmentInfo, EnrollmentStart, InstructorCourse, PayoutStatus, SessionCreated } from '../../shared/contracts.js';
import { setup, validSignup, type TestCtx } from './helpers.js';

// "Now" in these tests: Thu 1 Oct 2026, 09:00 UTC. Classes happen on 15–16 Oct.
const day = (d: number, hh: number, mm = 0) => new Date(Date.UTC(2026, 9, d, hh, mm)).toISOString();

async function account(t: TestCtx, email: string, intent: 'learn' | 'teach', name = 'Ana Silva') {
  const r = await t.call<SessionCreated>('POST', '/api/auth/signup', { body: validSignup({ email, intent, displayName: name }) });
  expect(r.status).toBe(201);
  return { token: r.json.data.token, id: r.json.data.me.id };
}

async function approvedTeacher(t: TestCtx) {
  const teacher = await account(t, 'laura@example.com', 'teach', 'Laura Méndez');
  await t.call('PUT', '/api/instructor/profile', { token: teacher.token, body: {
    phone: '+34 612 345 678', city: 'Madrid', headline: 'Pintora', bio: 'Doce años enseñando.', specialties: ['Óleo'], teachingLanguages: ['es'],
    legalEntityType: 'individual', legalName: 'Laura Méndez Ruiz', taxId: 'X1234567L', taxCountry: 'ES', businessAddress: 'Calle Mayor 1, Madrid' } });
  await t.call('POST', '/api/instructor/profile/submit', { token: teacher.token });
  const admin = await account(t, 'admin@example.com', 'learn', 'Admin');
  await t.deps.db.run(`INSERT INTO user_roles (user_id, role, granted_at) VALUES (?, 'admin', 'x')`, [admin.id]);
  expect((await t.call('POST', `/api/admin/instructors/${teacher.id}/approve`, { token: admin.token })).status).toBe(200);
  return { ...teacher, admin };
}

async function draftGroup(t: TestCtx, token: string, over: Record<string, unknown> = {}) {
  const c = await t.call<InstructorCourse>('POST', '/api/instructor/courses', { token, body: {
    title: 'Pintura creativa', summary: 'Aprende a pintar.', description: 'Clase práctica en directo.', categoryId: 'art', languageCode: 'es', level: 'beginner',
    learningOutcomes: [], requiredMaterials: [] } });
  expect((await t.call('POST', `/api/instructor/courses/${c.json.data.id}/publish`, { token })).status).toBe(200);
  const k = await t.call<ClassSummary>('POST', `/api/instructor/courses/${c.json.data.id}/classes`, { token, body: {
    label: 'Mañana', timezone: 'Europe/Madrid', capacity: 20, priceCents: 2000,
    meetings: [{ start: day(15, 7), end: day(15, 8, 30) }, { start: day(16, 7), end: day(16, 8, 30) }], ...over } });
  expect(k.status).toBe(201);
  return { courseId: c.json.data.id, classId: k.json.data.id };
}

const sessionFor = (t: TestCtx, paymentUrl: string) => [...t.stripe!.sessions.values()].find((s) => s.url === paymentUrl)!;
const pay = (t: TestCtx, url: string) => {
  const s = sessionFor(t, url);
  return t.webhook('checkout.session.completed', { id: s.id, payment_status: 'paid', payment_intent: s.paymentIntent, metadata: s.metadata });
};

/** Teacher with payouts on and a paid group open for enrollment. */
async function openPaidGroup(t: TestCtx, over: Record<string, unknown> = {}) {
  const laura = await approvedTeacher(t);
  const g = await draftGroup(t, laura.token, over);
  const connect = await t.call<{ url: string }>('POST', '/api/instructor/payouts/connect', { token: laura.token });
  const acct = [...t.stripe!.accounts.keys()][0]!;
  expect(connect.json.data.url).toContain(acct);
  await t.webhook('account.updated', { id: acct, payouts_enabled: true });
  const fee = await t.call<{ url: string }>('POST', `/api/instructor/classes/${g.classId}/opening-fee`, { token: laura.token });
  await pay(t, fee.json.data.url);
  return { laura, acct, ...g };
}

describe('payments are never pretended', () => {
  it('without a provider: paid seats answer "unavailable", free seats confirm at once', async () => {
    const t = await setup();
    const laura = await approvedTeacher(t);
    const paid = await draftGroup(t, laura.token);
    expect((await t.call('POST', `/api/instructor/classes/${paid.classId}/publish`, { token: laura.token })).status).toBe(200);
    const ana = await account(t, 'ana@example.com', 'learn');
    const r = await t.call('POST', '/api/me/enrollments', { token: ana.token, body: { classId: paid.classId, acceptWithdrawal: true } });
    expect([r.status, r.json.error]).toEqual([503, 'payments_unavailable']);
    expect((await t.deps.db.one<{ n: number }>('SELECT seats_taken AS n FROM class_sessions WHERE id = ?', [paid.classId]))!.n).toBe(0);

    const free = await draftGroup(t, laura.token, { priceCents: 0, label: 'Tarde', meetings: [{ start: day(20, 7), end: day(20, 8) }] });
    await t.call('POST', `/api/instructor/classes/${free.classId}/publish`, { token: laura.token });
    const f = await t.call<EnrollmentStart>('POST', '/api/me/enrollments', { token: ana.token, body: { classId: free.classId } });
    expect(f.json.data).toMatchObject({ status: 'confirmed', checkoutUrl: null });
    expect((await t.call('POST', '/api/me/enrollments', { token: ana.token, body: { classId: free.classId } })).json.error).toBe('already_enrolled');
  });

  it('a group opens only after payout account + opening fee confirmed by the provider', async () => {
    const t = await setup({ withPayments: true });
    const laura = await approvedTeacher(t);
    const g = await draftGroup(t, laura.token);
    expect((await t.call('POST', `/api/instructor/classes/${g.classId}/publish`, { token: laura.token })).json.error).toBe('payout_account_required');
    await t.call('POST', '/api/instructor/payouts/connect', { token: laura.token });
    const acct = [...t.stripe!.accounts.keys()][0]!;
    expect((await t.call<PayoutStatus>('GET', '/api/instructor/payouts', { token: laura.token })).json.data).toMatchObject({ connected: true, payoutsEnabled: false });
    await t.webhook('account.updated', { id: acct, payouts_enabled: true });
    expect((await t.call('POST', `/api/instructor/classes/${g.classId}/publish`, { token: laura.token })).json.error).toBe('opening_fee_required');

    const fee = await t.call<{ url: string }>('POST', `/api/instructor/classes/${g.classId}/opening-fee`, { token: laura.token });
    expect(sessionFor(t, fee.json.data.url).amount).toBe(500);
    const before = await t.deps.db.one<{ status: string }>('SELECT status FROM class_sessions WHERE id = ?', [g.classId]);
    expect(before!.status).toBe('draft'); // clicking "pay" is not paying
    await pay(t, fee.json.data.url);
    expect((await t.deps.db.one<{ status: string }>('SELECT status FROM class_sessions WHERE id = ?', [g.classId]))!.status).toBe('enrollment_open');
    const e = await t.call<Earnings>('GET', '/api/instructor/earnings', { token: laura.token });
    expect(e.json.data.openingFeesCents).toBe(500);
  });

  it('webhooks must be signed by the provider, and each event counts once', async () => {
    const t = await setup({ withPayments: true });
    const forged = await t.app.request('/api/payments/webhook', { method: 'POST', headers: { 'stripe-signature': 't=1,v1=abc' }, body: '{"id":"evt_x","type":"checkout.session.completed","data":{"object":{}}}' });
    expect(forged.status).toBe(400);
    const g = await openPaidGroup(t);
    const ana = await account(t, 'ana@example.com', 'learn');
    const start = await t.call<EnrollmentStart>('POST', '/api/me/enrollments', { token: ana.token, body: { classId: g.classId, acceptWithdrawal: true } });
    const s = sessionFor(t, start.json.data.checkoutUrl!);
    const w = await t.stripe!.webhook('checkout.session.completed', { id: s.id, payment_status: 'paid', payment_intent: s.paymentIntent, metadata: s.metadata }, t.clock.at);
    const send = () => t.app.request('/api/payments/webhook', { method: 'POST', headers: { 'stripe-signature': w.signature }, body: w.body });
    expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(200);
    expect((await t.deps.db.one<{ n: number }>(`SELECT COUNT(*) AS n FROM payment_transactions WHERE type = 'charge' AND payment_id = ?`, [s.metadata.payment_id!]))!.n).toBe(1);
  });
});

describe('student pays, withdraws, teacher gets paid after the group ends', () => {
  it('full money path with the real processor fee charged to the teacher', async () => {
    const t = await setup({ withPayments: true });
    const g = await openPaidGroup(t);
    const ana = await account(t, 'ana@example.com', 'learn', 'Ana Silva');
    const bea = await account(t, 'bea@example.com', 'learn', 'Beatriz Gómez');

    // Withdrawal rule must be accepted before paying.
    const noConsent = await t.call('POST', '/api/me/enrollments', { token: ana.token, body: { classId: g.classId } });
    expect([noConsent.status, noConsent.json.fields]).toEqual([400, { acceptWithdrawal: 'must_accept' }]);

    const a = await t.call<EnrollmentStart>('POST', '/api/me/enrollments', { token: ana.token, body: { classId: g.classId, acceptWithdrawal: true } });
    expect(a.json.data.status).toBe('pending_payment');
    expect(a.json.data.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.test\//);
    expect(Date.parse(a.json.data.holdExpiresAt!) - t.clock.at.getTime()).toBe(30 * 60_000);
    // Same student asking again gets the same page while the hold lasts.
    expect((await t.call<EnrollmentStart>('POST', '/api/me/enrollments', { token: ana.token, body: { classId: g.classId, acceptWithdrawal: true } })).json.data.checkoutUrl)
      .toBe(a.json.data.checkoutUrl);
    expect((await t.call<EnrollmentInfo>('GET', `/api/me/enrollments/${a.json.data.enrollmentId}`, { token: ana.token })).json.data.status).toBe('pending_payment');

    await pay(t, a.json.data.checkoutUrl!);
    const info = await t.call<EnrollmentInfo>('GET', `/api/me/enrollments/${a.json.data.enrollmentId}`, { token: ana.token });
    expect(info.json.data).toMatchObject({ status: 'confirmed', canWithdraw: true, withdrawalRefundCents: 1000 });
    const fee = t.stripe!.feeFor(2000); // 55
    const pf = await t.deps.db.one<{ provider_fee_cents: number; platform_fee_cents: number; instructor_net_cents: number }>(
      'SELECT provider_fee_cents, platform_fee_cents, instructor_net_cents FROM platform_fees pf JOIN payments p ON p.id = pf.payment_id WHERE p.enrollment_id = ?', [a.json.data.enrollmentId]);
    expect(pf).toEqual({ provider_fee_cents: fee, platform_fee_cents: 0, instructor_net_cents: 2000 - fee });

    // Bea pays, then withdraws before the class: 50% back, 50% kept and split.
    const b = await t.call<EnrollmentStart>('POST', '/api/me/enrollments', { token: bea.token, body: { classId: g.classId, acceptWithdrawal: true } });
    await pay(t, b.json.data.checkoutUrl!);
    const w = await t.call<EnrollmentInfo>('POST', `/api/me/enrollments/${b.json.data.enrollmentId}/withdraw`, { token: bea.token });
    expect(w.json.data.status).toBe('canceled');
    expect(t.stripe!.refunds.map((r) => r.amount)).toEqual([1000]);
    const refund = await t.deps.db.one<Record<string, number | string>>('SELECT amount_cents, retained_cents, retained_platform_cents, retained_instructor_cents, status FROM refunds');
    expect(refund).toEqual({ amount_cents: 1000, retained_cents: 1000, retained_platform_cents: 500, retained_instructor_cents: 500, status: 'succeeded' });
    expect((await t.deps.db.one<{ n: number }>('SELECT seats_taken AS n FROM class_sessions WHERE id = ?', [g.classId]))!.n).toBe(1);

    // Earnings before the group ends: everything held.
    let e = (await t.call<Earnings>('GET', '/api/instructor/earnings', { token: g.laura.token })).json.data;
    expect(e).toMatchObject({ heldCents: (2000 - fee) + (500 - fee), transferredCents: 0, salesCount: 1 });
    expect(e.lines.find((l) => l.kind === 'withdrawal')).toMatchObject({ student: 'Beatriz G.', netCents: 500 - fee, state: 'held' });

    // Nothing is transferred before the group ends.
    expect((await t.call<{ transferred: number }>('POST', '/api/admin/payments/settle', { token: g.laura.admin.token })).json.data.transferred).toBe(0);
    t.clock.at = new Date(day(16, 9));
    const settle = await t.call<{ transferred: number }>('POST', '/api/admin/payments/settle', { token: g.laura.admin.token });
    expect(settle.json.data.transferred).toBe(2);
    expect(t.stripe!.transfers.map((x) => [x.amount, x.destination]).sort()).toEqual([[2000 - fee, g.acct], [500 - fee, g.acct]].sort());
    await t.call('POST', '/api/admin/payments/settle', { token: g.laura.admin.token });
    expect(t.stripe!.transfers).toHaveLength(2); // running again never pays twice
    e = (await t.call<Earnings>('GET', '/api/instructor/earnings', { token: g.laura.token })).json.data;
    expect(e).toMatchObject({ heldCents: 0, transferredCents: (2000 - fee) + (500 - fee) });
  });

  it('an unpaid seat comes back after 30 minutes; a late payment is confirmed only if a seat is free', async () => {
    const t = await setup({ withPayments: true });
    const g = await openPaidGroup(t, { capacity: 1 });
    const ana = await account(t, 'ana@example.com', 'learn');
    const bea = await account(t, 'bea@example.com', 'learn', 'Bea');
    const a = await t.call<EnrollmentStart>('POST', '/api/me/enrollments', { token: ana.token, body: { classId: g.classId, acceptWithdrawal: true } });
    expect((await t.call('POST', '/api/me/enrollments', { token: bea.token, body: { classId: g.classId, acceptWithdrawal: true } })).json.error).toBe('class_full');

    t.clock.advanceMinutes(31);
    expect((await t.call<EnrollmentInfo>('GET', `/api/me/enrollments/${a.json.data.enrollmentId}`, { token: ana.token })).json.data.status).toBe('expired');
    const b = await t.call<EnrollmentStart>('POST', '/api/me/enrollments', { token: bea.token, body: { classId: g.classId, acceptWithdrawal: true } });
    expect(b.json.data.status).toBe('pending_payment');

    // Ana's page was still open and she paid late: no seat left, so she gets everything back.
    await pay(t, a.json.data.checkoutUrl!);
    expect((await t.call<EnrollmentInfo>('GET', `/api/me/enrollments/${a.json.data.enrollmentId}`, { token: ana.token })).json.data.status).toBe('expired');
    expect(t.stripe!.refunds.map((r) => r.amount)).toEqual([2000]);
  });

  it('teacher cancels a group: every student gets the full price back', async () => {
    const t = await setup({ withPayments: true });
    const g = await openPaidGroup(t);
    const ana = await account(t, 'ana@example.com', 'learn');
    const a = await t.call<EnrollmentStart>('POST', '/api/me/enrollments', { token: ana.token, body: { classId: g.classId, acceptWithdrawal: true } });
    await pay(t, a.json.data.checkoutUrl!);
    expect((await t.call('POST', `/api/instructor/classes/${g.classId}/cancel`, { token: g.laura.token, body: { reason: 'Enfermedad' } })).status).toBe(200);
    expect(t.stripe!.refunds.map((r) => r.amount)).toEqual([2000]);
    expect((await t.call<EnrollmentInfo>('GET', `/api/me/enrollments/${a.json.data.enrollmentId}`, { token: ana.token })).json.data.status).toBe('canceled');
  });
});
