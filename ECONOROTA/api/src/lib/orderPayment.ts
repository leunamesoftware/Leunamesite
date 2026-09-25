/**
 * Estados do pagamento → estados do pedido (idempotente: o provedor pode repetir eventos).
 *   aprovado  → pedido "pago" e baixa do estoque; sem estoque: estorna e cancela o pedido.
 *   recusado  → pedido continua aguardando pagamento (o cliente tenta de novo ou troca a forma).
 *   cancelado → cobrança expirada/apagada; o cliente pode gerar outra.
 *   estornado → pedido cancelado e estoque devolvido (se já tinha sido baixado).
 */
import { audit } from './auth';
import type { PaymentProvider } from './payments';

type Db = D1Database;
type Row = { id: string; order_id: string; status: string; provider_id: string | null; amount_cents: number };

const now = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

/** 6 dígitos aleatórios (criptograficamente seguros). */
export const deliveryCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');

async function items(db: Db, orderId: string) {
  const { results } = await db
    .prepare(
      `SELECT oi.product_id, oi.quantity, om.market_id FROM order_items oi JOIN order_markets om ON om.id = oi.order_market_id WHERE om.order_id = ?`,
    )
    .bind(orderId)
    .all<{ product_id: string; quantity: number; market_id: string }>();
  return results;
}

export async function approve(db: Db, p: Row, provider: PaymentProvider) {
  if (p.status === 'aprovado' || p.status === 'estornado') return 'noop';
  const list = await items(db, p.order_id);
  try {
    // Transação: se algum produto ficar com estoque negativo (CHECK stock >= 0), nada é gravado.
    await db.batch([
      db.prepare(`UPDATE payments SET status = 'aprovado', failure_reason = NULL, updated_at = ${now} WHERE id = ?`).bind(p.id),
      // Código de entrega: só o cliente vê; o entregador pede na porta (QR Code ou 6 dígitos).
      db
        .prepare(`UPDATE orders SET status = 'pago', delivery_code = ?, paid_at = ${now}, updated_at = ${now} WHERE id = ? AND status = 'aguardando_pagamento'`)
        .bind(deliveryCode(), p.order_id),
      // Os mercados recebem o pedido para separar.
      db.prepare("UPDATE order_markets SET status = 'novo' WHERE order_id = ? AND status = 'aguardando'").bind(p.order_id),
      ...list.map((i) => db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').bind(i.quantity, i.product_id)),
      ...list.map((i) =>
        db
          .prepare(
            `INSERT INTO stock_movements (id, market_id, product_id, type, quantity, stock_after, order_id)
             VALUES (?, ?, ?, 'venda', ?, (SELECT stock FROM products WHERE id = ?), ?)`,
          )
          .bind(crypto.randomUUID(), i.market_id, i.product_id, -i.quantity, i.product_id, p.order_id),
      ),
    ]);
    await audit(db, { action: 'payment.approved', entity: 'order', entityId: p.order_id });
    return 'approved';
  } catch {
    // Vendido por outro cliente enquanto este pagava: devolve o dinheiro e avisa.
    if (p.provider_id) await provider.refund(p.provider_id).catch((e) => console.error('refund', e));
    await db.batch([
      db.prepare(`UPDATE payments SET status = 'estornado', failure_reason = 'sem_estoque', updated_at = ${now} WHERE id = ?`).bind(p.id),
      db.prepare(`UPDATE orders SET status = 'cancelado', cancel_reason = 'sem_estoque', updated_at = ${now} WHERE id = ?`).bind(p.order_id),
    ]);
    await audit(db, { action: 'payment.refunded_no_stock', entity: 'order', entityId: p.order_id });
    return 'refunded_no_stock';
  }
}

export async function refuse(db: Db, p: Row, reason: string) {
  if (p.status !== 'pendente') return 'noop';
  await db.prepare(`UPDATE payments SET status = 'recusado', failure_reason = ?, updated_at = ${now} WHERE id = ?`).bind(reason, p.id).run();
  return 'refused';
}

export async function expire(db: Db, p: Row) {
  if (p.status !== 'pendente') return 'noop';
  await db.prepare(`UPDATE payments SET status = 'cancelado', failure_reason = 'expirado', updated_at = ${now} WHERE id = ?`).bind(p.id).run();
  return 'expired';
}

/** Estorno confirmado: cancela o pedido e devolve o estoque que tinha sido baixado. */
export async function refunded(db: Db, p: Row, reason = 'estorno') {
  if (p.status === 'estornado') return 'noop';
  const wasPaid = p.status === 'aprovado';
  const list = wasPaid ? await items(db, p.order_id) : [];
  await db.batch([
    db.prepare(`UPDATE payments SET status = 'estornado', failure_reason = ?, updated_at = ${now} WHERE id = ?`).bind(reason, p.id),
    db.prepare(`UPDATE orders SET status = 'cancelado', cancel_reason = COALESCE(cancel_reason, ?), updated_at = ${now} WHERE id = ?`).bind(reason, p.order_id),
    db.prepare("UPDATE order_markets SET status = 'cancelado' WHERE order_id = ?").bind(p.order_id),
    ...list.map((i) => db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').bind(i.quantity, i.product_id)),
    ...list.map((i) =>
      db
        .prepare(
          `INSERT INTO stock_movements (id, market_id, product_id, type, quantity, stock_after, order_id)
           VALUES (?, ?, ?, 'estorno', ?, (SELECT stock FROM products WHERE id = ?), ?)`,
        )
        .bind(crypto.randomUUID(), i.market_id, i.product_id, i.quantity, i.product_id, p.order_id),
    ),
  ]);
  return 'refunded';
}
