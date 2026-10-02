import type { EarningLine, Earnings, EnrollmentInfo, EnrollmentStart, Me, PayoutStatus } from '../../../../shared/contracts.js';
import type { Deps } from '../../common/env.js';
import { AppError, errors } from '../../common/errors.js';
import { newId } from '../../common/security.js';
import type { Param } from '../../infra/db/types.js';
import type { PaymentProvider, WebhookEvent } from '../../infra/payments/types.js';
import { auditStatement } from '../audit/audit.js';
import { authRepo } from '../auth/repository.js';
import type { RequestMeta } from '../auth/service.js';

const MIN_CHECKOUT_MINUTES = 30; // Stripe keeps a checkout page open at least this long

const unavailable = () => new AppError('payments_unavailable', 503, 'Payments are not available yet.');
const iso = (deps: Deps) => deps.clock.now().toISOString();

function provider(deps: Deps): PaymentProvider {
  if (!deps.payments) throw unavailable();
  return deps.payments;
}

/** Splits an amount in basis points without losing a cent. */
const bp = (cents: number, basisPoints: number) => Math.round((cents * basisPoints) / 10_000);

interface ClassForSale {
  id: string; course_id: string; instructor_id: string; status: string; starts_at: string; enrollment_deadline: string;
  capacity: number; seats_taken: number; price_cents: number; currency: string; label: string | null;
  title: string; is_hazardous: number; course_status: string;
}

const loadClass = (deps: Deps, classId: string) => deps.db.one<ClassForSale>(
  `SELECT cs.id, cs.course_id, cs.instructor_id, cs.status, cs.starts_at, cs.enrollment_deadline, cs.capacity, cs.seats_taken,
          cs.price_cents, cs.currency, cs.label, c.title, c.is_hazardous, c.status AS course_status
   FROM class_sessions cs JOIN courses c ON c.id = cs.course_id WHERE cs.id = ?`, [classId]);

/** Params: [now, classId]. */
const RELEASE_SEAT = 'UPDATE class_sessions SET seats_taken = seats_taken - 1, updated_at = ? WHERE id = ? AND seats_taken > 0';

/** Seats held for an unfinished payment come back when the hold time is over (also if the provider never tells us). */
export async function releaseExpiredHolds(deps: Deps) {
  const now = iso(deps);
  const rows = await deps.db.all<{ id: string; class_session_id: string; payment_id: string | null; checkout: string | null }>(
    `SELECT e.id, e.class_session_id, e.payment_id, p.provider_checkout_id AS checkout FROM enrollments e
     LEFT JOIN payments p ON p.id = e.payment_id WHERE e.status = 'pending_payment' AND e.hold_expires_at <= ?`, [now]);
  for (const r of rows) {
    const changed = await deps.db.run(`UPDATE enrollments SET status = 'expired', canceled_at = ? WHERE id = ? AND status = 'pending_payment'`, [now, r.id]);
    if (!changed.changes) continue;
    await deps.db.batch([
      { sql: RELEASE_SEAT, params: [now, r.class_session_id] },
      ...(r.payment_id ? [{ sql: `UPDATE payments SET status = 'canceled', updated_at = ? WHERE id = ? AND status IN ('created', 'pending')`, params: [now, r.payment_id] }] : []),
    ]);
    if (r.checkout && deps.payments) await deps.payments.expireCheckout(r.checkout);
  }
}

async function legalVersion(deps: Deps) {
  return authRepo.setting(deps.db, 'legal.terms_version', '2026-10-01');
}

/** "Reservar plaza". Free group: confirmed at once. Paid group: seat held while the student pays on the provider's page. */
export async function startEnrollment(deps: Deps, me: Me, input: unknown, meta: RequestMeta): Promise<EnrollmentStart> {
  const body = (input ?? {}) as { classId?: unknown; acceptWithdrawal?: unknown; acceptSafety?: unknown };
  if (typeof body.classId !== 'string') throw errors.invalid({ classId: 'required' });
  await releaseExpiredHolds(deps);
  const k = await loadClass(deps, body.classId);
  if (!k || k.status === 'draft') throw errors.notFound('Class');
  const now = iso(deps);
  if (k.instructor_id === me.id) throw errors.forbidden();
  if (k.status !== 'enrollment_open' || k.course_status !== 'published' || k.enrollment_deadline <= now || k.starts_at <= now) {
    throw new AppError('enrollment_closed', 409, 'Enrollment for this class is closed.');
  }
  const paid = k.price_cents > 0;
  const fields: Record<string, string> = {};
  if (paid && body.acceptWithdrawal !== true) fields.acceptWithdrawal = 'must_accept';
  if (k.is_hazardous && body.acceptSafety !== true) fields.acceptSafety = 'must_accept';
  if (Object.keys(fields).length) throw errors.invalid(fields);
  if (paid && !deps.payments) throw unavailable();

  const existing = await deps.db.one<{ id: string; status: string; hold_expires_at: string | null; checkout_url: string | null }>(
    `SELECT e.id, e.status, e.hold_expires_at, p.checkout_url FROM enrollments e LEFT JOIN payments p ON p.id = e.payment_id
     WHERE e.class_session_id = ? AND e.student_id = ?`, [k.id, me.id]);
  if (existing && ['confirmed', 'completed'].includes(existing.status)) throw new AppError('already_enrolled', 409, 'You are already in this class.');
  if (existing?.status === 'pending_payment' && existing.checkout_url) {
    return { enrollmentId: existing.id, status: 'pending_payment', checkoutUrl: existing.checkout_url, holdExpiresAt: existing.hold_expires_at };
  }

  const seat = await deps.db.run(
    `UPDATE class_sessions SET seats_taken = seats_taken + 1, updated_at = ? WHERE id = ? AND status = 'enrollment_open' AND seats_taken < capacity`, [now, k.id]);
  if (!seat.changes) throw new AppError('class_full', 409, 'There are no seats left in this class.');

  const enrollmentId = existing?.id ?? newId();
  const version = await legalVersion(deps);
  const consents = [
    ...(paid ? [{ kind: 'withdrawal_policy' }] : []),
    ...(k.is_hazardous ? [{ kind: 'hazardous_course' }] : []),
  ].map((c) => ({ sql: `INSERT INTO consents (id, user_id, kind, version, granted, context_id, ip_hash, created_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
    params: [newId(), me.id, c.kind, version, k.id, meta.ipHash, now] as Param[] }));
  const upsert = (status: string, hold: string | null, paymentId: string | null) => existing
    ? { sql: `UPDATE enrollments SET status = ?, price_cents = ?, currency = ?, hold_expires_at = ?, payment_id = ?, created_at = ?, confirmed_at = ?,
                canceled_at = NULL, completed_at = NULL, settled_at = NULL WHERE id = ?`,
        params: [status, k.price_cents, k.currency, hold, paymentId, now, status === 'confirmed' ? now : null, enrollmentId] as Param[] }
    : { sql: `INSERT INTO enrollments (id, class_session_id, student_id, status, price_cents, currency, hold_expires_at, payment_id, created_at, confirmed_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [enrollmentId, k.id, me.id, status, k.price_cents, k.currency, hold, paymentId, now, status === 'confirmed' ? now : null] as Param[] };

  if (!paid) {
    await deps.db.batch([upsert('confirmed', null, null), ...consents,
      auditStatement(deps, { actorId: me.id, action: 'enrollment.confirmed', targetType: 'class_session', targetId: k.id, ipHash: meta.ipHash, userAgent: meta.userAgent })]);
    return { enrollmentId, status: 'confirmed', checkoutUrl: null, holdExpiresAt: null };
  }

  const p = provider(deps);
  const holdMinutes = Math.max(MIN_CHECKOUT_MINUTES, await authRepo.setting(deps.db, 'enrollment.seat_hold_minutes', MIN_CHECKOUT_MINUTES));
  const hold = new Date(deps.clock.now().getTime() + holdMinutes * 60_000);
  const paymentId = newId();
  await deps.db.batch([
    upsert('pending_payment', hold.toISOString(), paymentId),
    { sql: `INSERT INTO payments (id, payer_id, purpose, enrollment_id, class_session_id, amount_cents, currency, status, provider, is_test, created_at, updated_at)
            VALUES (?, ?, 'enrollment', ?, ?, ?, ?, 'created', ?, ?, ?, ?)`,
      params: [paymentId, me.id, enrollmentId, k.id, k.price_cents, k.currency, p.name, p.testMode ? 1 : 0, now, now] },
    ...consents,
  ]);
  try {
    const checkout = await p.createCheckout({
      amountCents: k.price_cents, currency: k.currency, description: k.label ? `${k.title} · ${k.label}` : k.title, customerEmail: me.email,
      successUrl: `${deps.config.publicUrl}/enrollment/${enrollmentId}?paid=1`, cancelUrl: `${deps.config.publicUrl}/course/${k.course_id}/choose`,
      expiresAt: hold, metadata: { payment_id: paymentId, enrollment_id: enrollmentId, class_id: k.id, purpose: 'enrollment' }, transferGroup: `class_${k.id}`,
    });
    await deps.db.run(`UPDATE payments SET status = 'pending', provider_checkout_id = ?, checkout_url = ?, updated_at = ? WHERE id = ?`, [checkout.id, checkout.url, now, paymentId]);
    return { enrollmentId, status: 'pending_payment', checkoutUrl: checkout.url, holdExpiresAt: hold.toISOString() };
  } catch (error) {
    console.error('[payments] checkout failed:', error);
    await deps.db.batch([
      { sql: `UPDATE enrollments SET status = 'expired', canceled_at = ? WHERE id = ?`, params: [now, enrollmentId] },
      { sql: `UPDATE payments SET status = 'failed', failure_reason = 'checkout_failed', updated_at = ? WHERE id = ?`, params: [now, paymentId] },
      { sql: RELEASE_SEAT, params: [now, k.id] },
    ]);
    throw unavailable();
  }
}

const STATE: Record<string, EnrollmentInfo['status']> = {
  pending_payment: 'pending_payment', confirmed: 'confirmed', completed: 'completed', expired: 'expired',
  canceled_by_student: 'canceled', canceled_by_instructor: 'canceled', canceled_by_platform: 'canceled', no_show: 'completed',
};

export async function enrollmentInfo(deps: Deps, me: Me, enrollmentId: string): Promise<EnrollmentInfo> {
  await releaseExpiredHolds(deps);
  const e = await deps.db.one<{ id: string; class_session_id: string; course_id: string; status: string; hold_expires_at: string | null;
    price_cents: number; currency: string; starts_at: string }>(
    `SELECT e.id, e.class_session_id, cs.course_id, e.status, e.hold_expires_at, e.price_cents, e.currency, cs.starts_at
     FROM enrollments e JOIN class_sessions cs ON cs.id = e.class_session_id WHERE e.id = ? AND e.student_id = ?`, [enrollmentId, me.id]);
  if (!e) throw errors.notFound('Enrollment');
  const retention = await authRepo.setting(deps.db, 'withdrawal.retention_bp', 5000);
  return {
    id: e.id, classId: e.class_session_id, courseId: e.course_id, status: STATE[e.status] ?? 'canceled', holdExpiresAt: e.hold_expires_at,
    priceCents: e.price_cents, currency: e.currency,
    canWithdraw: ['confirmed', 'pending_payment'].includes(e.status) && e.starts_at > iso(deps),
    withdrawalRefundCents: e.price_cents - bp(e.price_cents, retention),
  };
}

/** Student withdraws before the class starts: 50% returned, 50% kept and split half and half (owner's rule). */
export async function withdraw(deps: Deps, me: Me, enrollmentId: string, meta: RequestMeta): Promise<EnrollmentInfo> {
  const e = await deps.db.one<{ id: string; class_session_id: string; status: string; price_cents: number; currency: string; starts_at: string;
    payment_id: string | null; provider_payment_id: string | null; checkout: string | null }>(
    `SELECT e.id, e.class_session_id, e.status, e.price_cents, e.currency, cs.starts_at, e.payment_id, p.provider_payment_id, p.provider_checkout_id AS checkout
     FROM enrollments e JOIN class_sessions cs ON cs.id = e.class_session_id LEFT JOIN payments p ON p.id = e.payment_id
     WHERE e.id = ? AND e.student_id = ?`, [enrollmentId, me.id]);
  if (!e) throw errors.notFound('Enrollment');
  const now = iso(deps);
  if (!['confirmed', 'pending_payment'].includes(e.status) || e.starts_at <= now) {
    throw new AppError('invalid_state', 409, 'This enrollment can no longer be canceled.');
  }
  const audit = auditStatement(deps, { actorId: me.id, action: 'enrollment.withdrawn', targetType: 'class_session', targetId: e.class_session_id, ipHash: meta.ipHash, userAgent: meta.userAgent });
  const cancel = { sql: `UPDATE enrollments SET status = 'canceled_by_student', canceled_at = ? WHERE id = ?`, params: [now, e.id] as Param[] };

  if (e.status === 'pending_payment' || e.price_cents === 0 || !e.payment_id) {
    await deps.db.batch([cancel, { sql: RELEASE_SEAT, params: [now, e.class_session_id] }, audit,
      ...(e.payment_id ? [{ sql: `UPDATE payments SET status = 'canceled', updated_at = ? WHERE id = ? AND status IN ('created', 'pending')`, params: [now, e.payment_id] as Param[] }] : [])]);
    if (e.checkout && deps.payments) await deps.payments.expireCheckout(e.checkout);
    return enrollmentInfo(deps, me, e.id);
  }

  const p = provider(deps);
  const retentionBp = await authRepo.setting(deps.db, 'withdrawal.retention_bp', 5000);
  const platformShareBp = await authRepo.setting(deps.db, 'withdrawal.retention_platform_share_bp', 5000);
  const retained = bp(e.price_cents, retentionBp);
  const retainedPlatform = bp(retained, platformShareBp);
  const refundCents = e.price_cents - retained;
  const refundId = newId();
  await deps.db.batch([
    cancel, { sql: RELEASE_SEAT, params: [now, e.class_session_id] }, audit,
    { sql: `INSERT INTO refunds (id, payment_id, enrollment_id, reason, amount_cents, retained_cents, retained_platform_cents, retained_instructor_cents, currency, status, requested_by, created_at)
            VALUES (?, ?, ?, 'student_withdrawal', ?, ?, ?, ?, ?, 'requested', ?, ?)`,
      params: [refundId, e.payment_id, e.id, refundCents, retained, retainedPlatform, retained - retainedPlatform, e.currency, me.id, now] },
  ]);
  await sendRefund(deps, p, { refundId, paymentId: e.payment_id, providerPaymentId: e.provider_payment_id, amountCents: refundCents, full: refundCents >= e.price_cents });
  return enrollmentInfo(deps, me, e.id);
}

async function sendRefund(deps: Deps, p: PaymentProvider, r: { refundId: string; paymentId: string; providerPaymentId: string | null; amountCents: number; full: boolean }) {
  const now = iso(deps);
  if (r.amountCents <= 0 || !r.providerPaymentId) {
    await deps.db.run(`UPDATE refunds SET status = 'succeeded', processed_at = ? WHERE id = ?`, [now, r.refundId]);
    return;
  }
  try {
    const res = await p.refund(r.providerPaymentId, r.amountCents, { refund_id: r.refundId, payment_id: r.paymentId });
    await deps.db.batch([
      { sql: `UPDATE refunds SET status = ?, provider_refund_id = ?, processed_at = ? WHERE id = ?`, params: [res.status, res.id, now, r.refundId] },
      { sql: `UPDATE payments SET status = ?, updated_at = ? WHERE id = ?`, params: [r.full ? 'refunded' : 'partially_refunded', now, r.paymentId] },
      { sql: `INSERT INTO payment_transactions (id, payment_id, type, amount_cents, currency, provider_ref, created_at)
              SELECT ?, id, 'refund', ?, currency, ?, ? FROM payments WHERE id = ?`, params: [newId(), -r.amountCents, res.id, now, r.paymentId] },
    ]);
  } catch (error) {
    // The enrollment is already canceled; the refund stays 'requested' and shows up for the team to retry.
    console.error('[payments] refund failed:', error);
    await deps.db.run(`UPDATE refunds SET status = 'failed', processed_at = ? WHERE id = ?`, [now, r.refundId]);
  }
}

/** Teacher or platform cancels a group: every student gets everything back. */
export async function refundWholeClass(deps: Deps, classId: string, reason: 'instructor_cancel' | 'platform_cancel', actorId: string) {
  const now = iso(deps);
  const rows = await deps.db.all<{ id: string; payment_id: string | null; provider_payment_id: string | null; price_cents: number; currency: string; status: string; checkout: string | null }>(
    `SELECT e.id, e.payment_id, p.provider_payment_id, e.price_cents, e.currency, e.status, p.provider_checkout_id AS checkout
     FROM enrollments e LEFT JOIN payments p ON p.id = e.payment_id
     WHERE e.class_session_id = ? AND e.status IN ('confirmed', 'pending_payment')`, [classId]);
  const status = reason === 'instructor_cancel' ? 'canceled_by_instructor' : 'canceled_by_platform';
  for (const e of rows) {
    await deps.db.run(`UPDATE enrollments SET status = ?, canceled_at = ? WHERE id = ?`, [status, now, e.id]);
    if (e.status === 'pending_payment') {
      if (e.payment_id) await deps.db.run(`UPDATE payments SET status = 'canceled', updated_at = ? WHERE id = ? AND status IN ('created', 'pending')`, [now, e.payment_id]);
      if (e.checkout && deps.payments) await deps.payments.expireCheckout(e.checkout);
      continue;
    }
    if (!e.payment_id || e.price_cents === 0) continue;
    const refundId = newId();
    await deps.db.run(`INSERT INTO refunds (id, payment_id, enrollment_id, reason, amount_cents, currency, status, requested_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'requested', ?, ?)`, [refundId, e.payment_id, e.id, reason, e.price_cents, e.currency, actorId, now]);
    if (deps.payments) await sendRefund(deps, deps.payments, { refundId, paymentId: e.payment_id, providerPaymentId: e.provider_payment_id, amountCents: e.price_cents, full: true });
  }
  await deps.db.run(`UPDATE class_sessions SET seats_taken = 0, updated_at = ? WHERE id = ?`, [now, classId]);
}

// ---------- webhook (the only place where a payment becomes "succeeded") ----------

export async function handleWebhook(deps: Deps, rawBody: string, signature: string | null) {
  const p = provider(deps);
  let event: WebhookEvent;
  try { event = await p.parseWebhook(rawBody, signature, deps.clock.now()); } catch {
    throw new AppError('webhook_invalid', 400, 'Invalid webhook signature.');
  }
  const seen = await deps.db.one('SELECT 1 FROM payment_transactions WHERE provider_event_id = ?', [event.id]);
  if (seen) return { handled: false };
  const o = event.object as { id?: string; payment_status?: string; payment_intent?: string; metadata?: Record<string, string>; payouts_enabled?: boolean; status?: string };
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      if (o.payment_status === 'paid' && o.metadata?.payment_id && o.payment_intent) await onPaid(deps, p, o.metadata.payment_id, o.payment_intent, event.id);
      break;
    case 'checkout.session.expired':
    case 'checkout.session.async_payment_failed':
      if (o.metadata?.payment_id) await onCheckoutClosed(deps, o.metadata.payment_id);
      break;
    case 'account.updated':
      if (o.id) await deps.db.run(`UPDATE instructor_profiles SET payouts_enabled = ?, updated_at = ? WHERE payout_account_ref = ?`, [o.payouts_enabled ? 1 : 0, iso(deps), o.id]);
      break;
    case 'refund.updated':
      if (o.id && o.status) await deps.db.run(`UPDATE refunds SET status = ? WHERE provider_refund_id = ?`,
        [o.status === 'succeeded' ? 'succeeded' : o.status === 'failed' || o.status === 'canceled' ? 'failed' : 'pending', o.id]);
      break;
    default:
      return { handled: false };
  }
  return { handled: true };
}

async function commissionCents(deps: Deps, gross: number) {
  const rule = await deps.db.one<{ calc: string; fixed_cents: number; percent_bp: number; id: string }>(
    `SELECT id, calc, fixed_cents, percent_bp FROM fee_rules WHERE kind = 'enrollment_commission' AND is_active = 1 AND valid_from <= ?
     AND (valid_to IS NULL OR valid_to > ?) ORDER BY valid_from DESC LIMIT 1`, [iso(deps), iso(deps)]);
  if (!rule) return { cents: 0, ruleId: null };
  const cents = (rule.calc === 'percent' ? 0 : rule.fixed_cents) + (rule.calc === 'fixed' ? 0 : bp(gross, rule.percent_bp));
  return { cents, ruleId: rule.id };
}

async function onPaid(deps: Deps, p: PaymentProvider, paymentId: string, providerPaymentId: string, eventId: string) {
  const pay = await deps.db.one<{ id: string; purpose: string; status: string; amount_cents: number; currency: string; enrollment_id: string | null; class_session_id: string | null }>(
    'SELECT id, purpose, status, amount_cents, currency, enrollment_id, class_session_id FROM payments WHERE id = ?', [paymentId]);
  if (!pay || pay.status === 'succeeded') return;
  const { chargeId, feeCents } = await p.chargeDetails(providerPaymentId);
  const now = iso(deps);
  const ledger = [
    { sql: `UPDATE payments SET status = 'succeeded', provider_payment_id = ?, provider_charge_id = ?, succeeded_at = ?, updated_at = ? WHERE id = ?`,
      params: [providerPaymentId, chargeId, now, now, pay.id] as Param[] },
    { sql: `INSERT INTO payment_transactions (id, payment_id, type, amount_cents, currency, provider_ref, provider_event_id, created_at) VALUES (?, ?, 'charge', ?, ?, ?, ?, ?)`,
      params: [newId(), pay.id, pay.amount_cents, pay.currency, chargeId, eventId, now] as Param[] },
    { sql: `INSERT INTO payment_transactions (id, payment_id, type, amount_cents, currency, provider_ref, created_at) VALUES (?, ?, 'provider_fee', ?, ?, ?, ?)`,
      params: [newId(), pay.id, -feeCents, pay.currency, chargeId, now] as Param[] },
  ];

  if (pay.purpose === 'class_opening_fee') {
    const opening = await deps.db.one<{ id: string }>(`SELECT id FROM fee_rules WHERE kind = 'class_opening_fee' AND is_active = 1 ORDER BY valid_from DESC LIMIT 1`);
    await deps.db.batch([...ledger,
      { sql: `INSERT INTO platform_fees (id, payment_id, fee_rule_id, gross_cents, provider_fee_cents, platform_fee_cents, instructor_net_cents, currency, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        params: [newId(), pay.id, opening?.id ?? null, pay.amount_cents, feeCents, pay.amount_cents - feeCents, pay.currency, now] },
      { sql: `UPDATE class_sessions SET opening_fee_payment_id = ?, updated_at = ? WHERE id = ?`, params: [pay.id, now, pay.class_session_id] },
      // Paying the fee is the teacher's "publish": the group opens if it can still take students.
      { sql: `UPDATE class_sessions SET status = 'enrollment_open', enrollment_opens_at = ?, updated_at = ?
              WHERE id = ? AND status = 'draft' AND enrollment_deadline > ? AND course_id IN (SELECT id FROM courses WHERE status = 'published')`,
        params: [now, now, pay.class_session_id, now] },
    ]);
    return;
  }

  const e = await deps.db.one<{ id: string; status: string; class_session_id: string }>('SELECT id, status, class_session_id FROM enrollments WHERE id = ?', [pay.enrollment_id]);
  if (!e) return;
  const commission = await commissionCents(deps, pay.amount_cents);
  const platformFee = Math.min(commission.cents, Math.max(0, pay.amount_cents - feeCents));
  const fees = { sql: `INSERT INTO platform_fees (id, payment_id, fee_rule_id, gross_cents, provider_fee_cents, platform_fee_cents, instructor_net_cents, currency, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [newId(), pay.id, commission.ruleId, pay.amount_cents, feeCents, platformFee, pay.amount_cents - feeCents - platformFee, pay.currency, now] as Param[] };

  let seatOk = e.status === 'pending_payment';
  if (!seatOk && e.status === 'expired') {
    // Paid after the hold ended: confirm only if a seat is still free; otherwise give everything back.
    const seat = await deps.db.run(`UPDATE class_sessions SET seats_taken = seats_taken + 1, updated_at = ? WHERE id = ? AND status = 'enrollment_open' AND seats_taken < capacity AND starts_at > ?`,
      [now, e.class_session_id, now]);
    seatOk = seat.changes > 0;
  }
  if (seatOk) {
    await deps.db.batch([...ledger, fees,
      { sql: `UPDATE enrollments SET status = 'confirmed', confirmed_at = ?, hold_expires_at = NULL, payment_id = ? WHERE id = ?`, params: [now, pay.id, e.id] },
      auditStatement(deps, { actorId: null, action: 'enrollment.confirmed', targetType: 'class_session', targetId: e.class_session_id }),
    ]);
    return;
  }
  await deps.db.batch([...ledger, fees]);
  const refundId = newId();
  await deps.db.run(`INSERT INTO refunds (id, payment_id, enrollment_id, reason, amount_cents, currency, status, created_at) VALUES (?, ?, ?, 'other', ?, ?, 'requested', ?)`,
    [refundId, pay.id, e.id, pay.amount_cents, pay.currency, now]);
  await sendRefund(deps, p, { refundId, paymentId: pay.id, providerPaymentId, amountCents: pay.amount_cents, full: true });
}

async function onCheckoutClosed(deps: Deps, paymentId: string) {
  const pay = await deps.db.one<{ enrollment_id: string | null; status: string }>('SELECT enrollment_id, status FROM payments WHERE id = ?', [paymentId]);
  if (!pay || !['created', 'pending'].includes(pay.status)) return;
  const now = iso(deps);
  await deps.db.run(`UPDATE payments SET status = 'canceled', updated_at = ? WHERE id = ?`, [now, paymentId]);
  if (!pay.enrollment_id) return;
  const e = await deps.db.one<{ class_session_id: string }>('SELECT class_session_id FROM enrollments WHERE id = ?', [pay.enrollment_id]);
  const changed = await deps.db.run(`UPDATE enrollments SET status = 'expired', canceled_at = ? WHERE id = ? AND status = 'pending_payment'`, [now, pay.enrollment_id]);
  if (changed.changes && e) await deps.db.run(RELEASE_SEAT, [now, e.class_session_id]);
}

// ---------- teacher: payout account, opening fee, earnings ----------

export async function openingFeeCents(deps: Deps) {
  const rule = await deps.db.one<{ fixed_cents: number }>(`SELECT fixed_cents FROM fee_rules WHERE kind = 'class_opening_fee' AND is_active = 1 ORDER BY valid_from DESC LIMIT 1`);
  return rule?.fixed_cents ?? 0;
}

export async function payoutStatus(deps: Deps, me: Me): Promise<PayoutStatus> {
  const prof = await deps.db.one<{ payout_account_ref: string | null; payouts_enabled: number }>(
    'SELECT payout_account_ref, payouts_enabled FROM instructor_profiles WHERE user_id = ?', [me.id]);
  let enabled = !!prof?.payouts_enabled;
  if (prof?.payout_account_ref && !enabled && deps.payments) {
    const s = await deps.payments.accountStatus(prof.payout_account_ref).catch(() => null);
    if (s?.payoutsEnabled) {
      enabled = true;
      await deps.db.run('UPDATE instructor_profiles SET payouts_enabled = 1, updated_at = ? WHERE user_id = ?', [iso(deps), me.id]);
    }
  }
  return { paymentsAvailable: !!deps.payments, connected: !!prof?.payout_account_ref, payoutsEnabled: enabled, openingFeeCents: await openingFeeCents(deps) };
}

/** Opens (or continues) the provider's own onboarding page where the teacher adds identity and bank details. */
export async function connectPayouts(deps: Deps, me: Me): Promise<{ url: string }> {
  const p = provider(deps);
  const prof = await deps.db.one<{ verification_status: string; payout_account_ref: string | null; tax_country: string | null; legal_entity_type: string | null }>(
    'SELECT verification_status, payout_account_ref, tax_country, legal_entity_type FROM instructor_profiles WHERE user_id = ?', [me.id]);
  if (!prof || prof.verification_status !== 'approved') throw new AppError('instructor_not_approved', 403, 'Your teacher profile must be approved first.');
  let account = prof.payout_account_ref;
  if (!account) {
    account = (await p.createAccount({ email: me.email, country: prof.tax_country ?? 'ES', businessType: prof.legal_entity_type === 'company' ? 'company' : 'individual', userId: me.id })).id;
    await deps.db.run('UPDATE instructor_profiles SET payout_account_ref = ?, updated_at = ? WHERE user_id = ?', [account, iso(deps), me.id]);
  }
  const base = `${deps.config.publicUrl}/teach/earnings`;
  return { url: await p.onboardingLink(account, `${base}?connect=retry`, `${base}?connect=done`) };
}

/** Teacher pays the opening fee on the provider's page; the webhook then opens the group. */
export async function openingFeeCheckout(deps: Deps, me: Me, classId: string): Promise<{ url: string }> {
  const p = provider(deps);
  const k = await loadClass(deps, classId);
  if (!k || k.instructor_id !== me.id) throw errors.notFound('Class');
  if (k.status !== 'draft') throw new AppError('invalid_state', 409, 'Only draft classes need the opening fee.');
  if (k.course_status !== 'published') throw new AppError('invalid_state', 409, 'Publish the course first.');
  const now = iso(deps);
  if (k.enrollment_deadline <= now) throw new AppError('invalid_state', 409, 'The enrollment deadline has passed. Change the dates.');
  const status = await payoutStatus(deps, me);
  if (k.price_cents > 0 && !status.payoutsEnabled) throw new AppError('payout_account_required', 409, 'Connect your payout account first.');
  const amount = await openingFeeCents(deps);
  const paymentId = newId();
  await deps.db.run(`INSERT INTO payments (id, payer_id, purpose, class_session_id, amount_cents, currency, status, provider, is_test, created_at, updated_at)
    VALUES (?, ?, 'class_opening_fee', ?, ?, 'EUR', 'created', ?, ?, ?, ?)`, [paymentId, me.id, k.id, amount, p.name, p.testMode ? 1 : 0, now, now]);
  const checkout = await p.createCheckout({
    amountCents: amount, currency: 'EUR', description: `Apertura de grupo · ${k.title}${k.label ? ` · ${k.label}` : ''}`, customerEmail: me.email,
    successUrl: `${deps.config.publicUrl}/teach/courses/${k.course_id}?step=3&opened=1`, cancelUrl: `${deps.config.publicUrl}/teach/courses/${k.course_id}?step=3`,
    expiresAt: new Date(deps.clock.now().getTime() + MIN_CHECKOUT_MINUTES * 60_000), metadata: { payment_id: paymentId, class_id: k.id, purpose: 'class_opening_fee' },
  });
  await deps.db.run(`UPDATE payments SET status = 'pending', provider_checkout_id = ?, checkout_url = ?, updated_at = ? WHERE id = ?`, [checkout.id, checkout.url, now, paymentId]);
  return { url: checkout.url };
}

/** True when the group may open without paying now (no provider yet, fee 0, or already paid). */
export async function openingFeeSettled(deps: Deps, classId: string) {
  if (!deps.payments || (await openingFeeCents(deps)) === 0) return true;
  return !!(await deps.db.one(`SELECT 1 FROM class_sessions cs JOIN payments p ON p.id = cs.opening_fee_payment_id AND p.status = 'succeeded' WHERE cs.id = ?`, [classId]));
}

const shortName = (name: string | null) => {
  if (!name) return null;
  const [first, second] = name.trim().split(/\s+/);
  return second ? `${first} ${second[0]!.toUpperCase()}.` : first ?? null;
};

export async function earnings(deps: Deps, me: Me): Promise<Earnings> {
  const status = await payoutStatus(deps, me);
  const rows = await deps.db.all<{ at: string; purpose: string; pstatus: string; title: string; label: string | null; student: string | null; gross: number;
    fee: number | null; net: number | null; settled_at: string | null; estatus: string | null; refunded: number | null; retained_teacher: number | null }>(
    `SELECT p.succeeded_at AS at, p.purpose, p.status AS pstatus, c.title, cs.label, u.display_name AS student, p.amount_cents AS gross,
            pf.provider_fee_cents AS fee, pf.instructor_net_cents AS net, e.settled_at, e.status AS estatus,
            (SELECT SUM(r.amount_cents) FROM refunds r WHERE r.payment_id = p.id AND r.status != 'rejected') AS refunded,
            (SELECT SUM(r.retained_instructor_cents) FROM refunds r WHERE r.payment_id = p.id) AS retained_teacher
     FROM payments p JOIN class_sessions cs ON cs.id = p.class_session_id JOIN courses c ON c.id = cs.course_id
     LEFT JOIN enrollments e ON e.id = p.enrollment_id LEFT JOIN users u ON u.id = e.student_id
     LEFT JOIN platform_fees pf ON pf.payment_id = p.id
     WHERE cs.instructor_id = ? AND p.succeeded_at IS NOT NULL ORDER BY p.succeeded_at DESC LIMIT 200`, [me.id]);
  let transferred = 0, held = 0, gross = 0, fees = 0, opening = 0, sales = 0;
  const lines: EarningLine[] = rows.map((r) => {
    const fee = r.fee ?? 0;
    if (r.purpose === 'class_opening_fee') {
      opening += r.gross;
      return { at: r.at, kind: 'opening_fee', courseTitle: r.title, classLabel: r.label, student: null, grossCents: r.gross, feeCents: 0, netCents: -r.gross, state: 'paid' };
    }
    const withdrawn = r.estatus === 'canceled_by_student';
    const fullyRefunded = !withdrawn && (r.refunded ?? 0) >= r.gross;
    const net = withdrawn ? Math.max(0, (r.retained_teacher ?? 0) - fee) : fullyRefunded ? 0 : r.net ?? 0;
    if (!fullyRefunded) { gross += r.gross - (r.refunded ?? 0); fees += fee; sales += withdrawn ? 0 : 1; }
    const state: EarningLine['state'] = fullyRefunded ? 'refunded' : r.settled_at ? 'transferred' : 'held';
    if (state === 'transferred') transferred += net; else if (state === 'held') held += net;
    return { at: r.at, kind: withdrawn ? 'withdrawal' : fullyRefunded ? 'refund' : 'sale', courseTitle: r.title, classLabel: r.label, student: shortName(r.student),
      grossCents: r.gross, feeCents: fee, netCents: net, state };
  });
  return { paymentsAvailable: status.paymentsAvailable, payoutsEnabled: status.payoutsEnabled, currency: 'EUR', transferredCents: transferred, heldCents: held,
    grossCents: gross, feesCents: fees, openingFeesCents: opening, salesCount: sales, lines };
}

/**
 * After a group ends, each teacher receives the net of every sale (and their share of withdrawals).
 * Runs on a schedule and from the admin panel; safe to run many times.
 */
export async function settleFinishedClasses(deps: Deps) {
  if (!deps.payments) return { transferred: 0, waiting: 0 };
  const p = deps.payments;
  const now = iso(deps);
  const rows = await deps.db.all<{ enrollment_id: string; payment_id: string; charge: string | null; currency: string; class_id: string; account: string | null;
    enabled: number; status: string; net: number | null; fee: number | null; retained_teacher: number | null }>(
    `SELECT e.id AS enrollment_id, p.id AS payment_id, p.provider_charge_id AS charge, p.currency, cs.id AS class_id, ip.payout_account_ref AS account,
            ip.payouts_enabled AS enabled, e.status, pf.instructor_net_cents AS net, pf.provider_fee_cents AS fee,
            (SELECT SUM(r.retained_instructor_cents) FROM refunds r WHERE r.payment_id = p.id AND r.status = 'succeeded') AS retained_teacher
     FROM enrollments e JOIN payments p ON p.id = e.payment_id AND p.succeeded_at IS NOT NULL
     JOIN class_sessions cs ON cs.id = e.class_session_id JOIN instructor_profiles ip ON ip.user_id = cs.instructor_id
     LEFT JOIN platform_fees pf ON pf.payment_id = p.id
     WHERE e.settled_at IS NULL AND cs.ends_at <= ? AND cs.status != 'canceled'
       AND e.status IN ('confirmed', 'completed', 'no_show', 'canceled_by_student')`, [now]);
  let transferred = 0, waiting = 0;
  for (const r of rows) {
    const amount = r.status === 'canceled_by_student' ? Math.max(0, (r.retained_teacher ?? 0) - (r.fee ?? 0)) : r.net ?? 0;
    if (amount > 0 && (!r.account || !r.enabled || !r.charge)) { waiting++; continue; }
    const marked = await deps.db.run('UPDATE enrollments SET settled_at = ? WHERE id = ? AND settled_at IS NULL', [now, r.enrollment_id]);
    if (!marked.changes || amount <= 0) continue;
    try {
      const t = await p.transfer({ amountCents: amount, currency: r.currency, destination: r.account!, sourceChargeId: r.charge!, transferGroup: `class_${r.class_id}`,
        metadata: { payment_id: r.payment_id, enrollment_id: r.enrollment_id, kind: r.status === 'canceled_by_student' ? 'withdrawal_share' : 'net' } });
      await deps.db.run(`INSERT INTO payment_transactions (id, payment_id, type, amount_cents, currency, provider_ref, created_at) VALUES (?, ?, 'transfer', ?, ?, ?, ?)`,
        [newId(), r.payment_id, -amount, r.currency, t.id, now]);
      transferred++;
    } catch (error) {
      console.error('[payments] transfer failed:', error);
      await deps.db.run('UPDATE enrollments SET settled_at = NULL WHERE id = ?', [r.enrollment_id]);
      waiting++;
    }
  }
  return { transferred, waiting };
}
