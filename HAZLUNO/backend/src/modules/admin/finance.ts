import type { AdminFinance, AdminMoneyLine } from '../../../../shared/contracts.js';
import type { Deps } from '../../common/env.js';

const PAGE = 25;

/** Telas 33–34: every euro that moved — sales, fees, refunds, withdrawals split and transfers to teachers. */
export async function finance(deps: Deps, q: { tab?: string; page?: string }): Promise<AdminFinance> {
  const db = deps.db;
  const sum = async (sql: string, p: (string | number)[] = []) => Number((await db.one<{ n: number | null }>(sql, p))?.n ?? 0);
  const withdrawalFees = await sum(`SELECT SUM(pf.provider_fee_cents) AS n FROM refunds r JOIN platform_fees pf ON pf.payment_id = r.payment_id WHERE r.reason = 'student_withdrawal'`);
  const summary = {
    paymentsAvailable: !!deps.payments,
    testMode: deps.payments ? deps.payments.testMode : null,
    salesCents: await sum(`SELECT SUM(amount_cents) AS n FROM payments WHERE purpose = 'enrollment' AND succeeded_at IS NOT NULL`),
    processorFeesCents: await sum(`SELECT SUM(provider_fee_cents) AS n FROM platform_fees`),
    openingFeesCents: await sum(`SELECT SUM(amount_cents) AS n FROM payments WHERE purpose = 'class_opening_fee' AND status = 'succeeded'`),
    platformRevenueCents: await sum(`SELECT SUM(platform_fee_cents) AS n FROM platform_fees`)
      + (await sum(`SELECT SUM(retained_platform_cents) AS n FROM refunds WHERE reason = 'student_withdrawal'`)) - withdrawalFees,
    refundedCents: await sum(`SELECT SUM(amount_cents) AS n FROM refunds WHERE status = 'succeeded'`),
    heldForTeachersCents: await sum(`SELECT SUM(pf.instructor_net_cents) AS n FROM enrollments e JOIN platform_fees pf ON pf.payment_id = e.payment_id
        WHERE e.settled_at IS NULL AND e.status IN ('confirmed', 'completed', 'no_show')`)
      + await sum(`SELECT SUM(r.retained_instructor_cents) AS n FROM refunds r JOIN enrollments e ON e.id = r.enrollment_id
        WHERE r.reason = 'student_withdrawal' AND r.status = 'succeeded' AND e.settled_at IS NULL`),
    transferredCents: -(await sum(`SELECT SUM(amount_cents) AS n FROM payment_transactions WHERE type = 'transfer'`)),
    failedRefunds: await sum(`SELECT COUNT(*) AS n FROM refunds WHERE status = 'failed'`),
  };

  const tab = q.tab === 'refunds' || q.tab === 'transfers' ? q.tab : 'payments';
  const offset = (Math.max(1, Number(q.page) || 1) - 1) * PAGE;
  let items: AdminMoneyLine[] = [];
  let total = 0;
  if (tab === 'payments') {
    total = await sum(`SELECT COUNT(*) AS n FROM payments WHERE status != 'created'`);
    const rows = await db.all<{ id: string; at: string; purpose: AdminMoneyLine['kind']; who: string; title: string | null; amount: number; fee: number | null; status: string; label: string | null; test: number }>(
      `SELECT p.id, COALESCE(p.succeeded_at, p.created_at) AS at, p.purpose, u.display_name AS who, c.title, p.amount_cents AS amount, pf.provider_fee_cents AS fee,
              p.status, cs.label, p.is_test AS test
       FROM payments p JOIN users u ON u.id = p.payer_id LEFT JOIN class_sessions cs ON cs.id = p.class_session_id LEFT JOIN courses c ON c.id = cs.course_id
       LEFT JOIN platform_fees pf ON pf.payment_id = p.id WHERE p.status != 'created' ORDER BY at DESC LIMIT ${PAGE} OFFSET ${offset}`);
    items = rows.map((r) => ({ id: r.id, at: r.at, kind: r.purpose, who: r.who, courseTitle: r.title, amountCents: r.amount, feeCents: r.fee ?? 0, status: r.status, detail: r.label, test: !!r.test }));
  } else if (tab === 'refunds') {
    total = await sum(`SELECT COUNT(*) AS n FROM refunds`);
    const rows = await db.all<{ id: string; at: string; who: string; title: string | null; amount: number; status: string; reason: string; kept_p: number; kept_t: number; test: number }>(
      `SELECT r.id, r.created_at AS at, u.display_name AS who, c.title, r.amount_cents AS amount, r.status, r.reason,
              r.retained_platform_cents AS kept_p, r.retained_instructor_cents AS kept_t, p.is_test AS test
       FROM refunds r JOIN payments p ON p.id = r.payment_id JOIN users u ON u.id = p.payer_id
       LEFT JOIN class_sessions cs ON cs.id = p.class_session_id LEFT JOIN courses c ON c.id = cs.course_id
       ORDER BY r.created_at DESC LIMIT ${PAGE} OFFSET ${offset}`);
    items = rows.map((r) => ({ id: r.id, at: r.at, kind: 'refund', who: r.who, courseTitle: r.title, amountCents: r.amount, feeCents: 0, status: r.status,
      detail: r.reason === 'student_withdrawal' ? `${r.reason}:${r.kept_p}:${r.kept_t}` : r.reason, test: !!r.test }));
  } else {
    total = await sum(`SELECT COUNT(*) AS n FROM payment_transactions WHERE type = 'transfer'`);
    const rows = await db.all<{ id: string; at: string; who: string; title: string | null; amount: number; ref: string | null; test: number }>(
      `SELECT pt.id, pt.created_at AS at, u.display_name AS who, c.title, -pt.amount_cents AS amount, pt.provider_ref AS ref, p.is_test AS test
       FROM payment_transactions pt JOIN payments p ON p.id = pt.payment_id JOIN class_sessions cs ON cs.id = p.class_session_id
       JOIN courses c ON c.id = cs.course_id JOIN users u ON u.id = cs.instructor_id
       WHERE pt.type = 'transfer' ORDER BY pt.created_at DESC LIMIT ${PAGE} OFFSET ${offset}`);
    items = rows.map((r) => ({ id: r.id, at: r.at, kind: 'transfer', who: r.who, courseTitle: r.title, amountCents: r.amount, feeCents: 0, status: 'paid', detail: r.ref, test: !!r.test }));
  }
  return { summary, items, total };
}
