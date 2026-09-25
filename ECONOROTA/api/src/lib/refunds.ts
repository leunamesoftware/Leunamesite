/** Reembolsos parciais (itens em falta, ocorrências). Nunca devolve mais do que o valor pago. */
import { audit } from './auth';
import { paymentProvider } from './payments';
import type { Env } from './types';

export async function refundPartial(env: Env, orderId: string, cents: number, reason: string, userId?: string) {
  const db = env.DB;
  const p = await db
    .prepare("SELECT id, provider_id, amount_cents, refunded_cents FROM payments WHERE order_id = ? AND status = 'aprovado' ORDER BY created_at DESC LIMIT 1")
    .bind(orderId)
    .first<{ id: string; provider_id: string | null; amount_cents: number; refunded_cents: number }>();
  if (!p || cents <= 0) return 0;
  const value = Math.min(cents, p.amount_cents - p.refunded_cents);
  if (value <= 0) return 0;
  if (p.provider_id) await paymentProvider(env).refund(p.provider_id, value);
  await db.prepare('UPDATE payments SET refunded_cents = refunded_cents + ? WHERE id = ?').bind(value, p.id).run();
  await audit(db, { userId, action: 'payment.partial_refund', entity: 'order', entityId: orderId, data: { cents: value, reason } });
  return value;
}
