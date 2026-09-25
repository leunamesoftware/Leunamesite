import { Hono } from 'hono';

import { audit, requireAuth } from '../lib/auth';
import { maskCpf, normalizeCpf } from '../lib/cpf';
import { newId, safeEqualText } from '../lib/crypto';
import { ApiError, badRequest, conflict, forbidden, notFound } from '../lib/errors';
import { approve, expire, refunded, refuse } from '../lib/orderPayment';
import { notifyCustomer, onOrderPaid } from '../lib/notifications';
import { paymentProvider, type Method } from '../lib/payments';
import { seal, unseal } from '../lib/fieldCrypto';
import type { AppEnv } from '../lib/types';
import { oneOf, readJson } from '../lib/validate';

const payments = new Hono<AppEnv>();
const webhooks = new Hono<AppEnv>();

const MAX_ATTEMPTS = 6;
type PayRow = {
  id: string; order_id: string; provider: string; provider_id: string | null; method: Method; status: string; amount_cents: number;
  pix_payload: string | null; pix_image: string | null; pix_expires_at: string | null; invoice_url: string | null; failure_reason: string | null;
};

const view = (p: PayRow | null) =>
  p && {
    id: p.id,
    method: p.method,
    status: p.status,
    amount_cents: p.amount_cents,
    pix: p.pix_payload ? { payload: p.pix_payload, image: p.pix_image, expires_at: p.pix_expires_at } : null,
    invoice_url: p.invoice_url,
    failure_reason: p.failure_reason,
    simulated: p.provider === 'simulado',
  };

async function ownOrder(db: D1Database, orderId: string, userId: string) {
  const o = await db
    .prepare('SELECT id, status, total_cents, cancel_reason FROM orders WHERE id = ? AND customer_user_id = ?')
    .bind(orderId, userId)
    .first<{ id: string; status: string; total_cents: number; cancel_reason: string | null }>();
  if (!o) throw notFound('Pedido não encontrado.');
  return o;
}

const lastPayment = (db: D1Database, orderId: string) =>
  db.prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1').bind(orderId).first<PayRow>();

/** Detalhe do pedido do próprio cliente (mercados, itens e último pagamento). */
payments.get('/orders/:id', requireAuth(), async (c) => {
  const o = await ownOrder(c.env.DB, c.req.param('id'), c.get('user').id);
  const full = await c.env.DB.prepare(
    `SELECT id, status, subtotal_cents, delivery_fee_cents, savings_cents, total_cents, payment_method, delivery_address, cancel_reason, created_at,
            courier_status, delivered_at, CASE WHEN status IN ('pago','em_separacao','pronto_coleta','em_rota') THEN delivery_code END AS delivery_code
       FROM orders WHERE id = ?`,
  )
    .bind(o.id)
    .first<Record<string, unknown> & { delivery_address: string | null }>();
  const { results: markets } = await c.env.DB.prepare(
    `SELECT om.id, om.market_id, om.sequence, om.status, om.subtotal_cents, m.name, m.image_url
       FROM order_markets om JOIN markets m ON m.id = om.market_id WHERE om.order_id = ? ORDER BY om.sequence`,
  )
    .bind(o.id)
    .all<{ id: string }>();
  const { results: items } = await c.env.DB.prepare(
    `SELECT oi.id, oi.order_market_id, oi.product_name AS name, oi.unit_price_cents, oi.quantity, oi.image_url, oi.checked
       FROM order_items oi JOIN order_markets om ON om.id = oi.order_market_id WHERE om.order_id = ?`,
  )
    .bind(o.id)
    .all<{ order_market_id: string }>();
  return c.json({
    order: {
      ...full,
      delivery_address: full?.delivery_address ? JSON.parse(full.delivery_address) : null,
      markets: markets.map((m) => ({ ...m, items: items.filter((i) => i.order_market_id === m.id) })),
      payment: view(await lastPayment(c.env.DB, o.id)),
    },
  });
});

/** Status do pagamento (o app consulta enquanto o cliente paga o Pix). */
payments.get('/orders/:id/payment', requireAuth(), async (c) => {
  const o = await ownOrder(c.env.DB, c.req.param('id'), c.get('user').id);
  return c.json({ order_status: o.status, cancel_reason: o.cancel_reason, payment: view(await lastPayment(c.env.DB, o.id)) });
});

/** Gera a cobrança (Pix ou cartão). Repetir o pedido devolve a mesma cobrança pendente (sem cobrar duas vezes). */
payments.post('/orders/:id/pay', requireAuth('cliente'), async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const b = await readJson(c.req.raw);
  const method = oneOf(b, 'method', ['pix', 'cartao'] as const);
  const o = await ownOrder(db, c.req.param('id'), user.id);
  if (o.status !== 'aguardando_pagamento') throw conflict('Este pedido não está aguardando pagamento.', 'not_payable');

  const last = await lastPayment(db, o.id);
  const stillValid = last?.status === 'pendente' && (!last.pix_expires_at || Date.parse(last.pix_expires_at) > Date.now() + 60_000);
  if (last && stillValid && last.method === method) return c.json({ payment: view(last) });

  const count = await db.prepare('SELECT COUNT(*) AS n FROM payments WHERE order_id = ?').bind(o.id).first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_ATTEMPTS) throw new ApiError(429, 'too_many_attempts', 'Muitas tentativas de pagamento. Fale com o suporte.');

  const u = await db
    .prepare('SELECT id, name, email, phone, cpf, asaas_customer_id FROM users WHERE id = ?')
    .bind(user.id)
    .first<{ id: string; name: string; email: string; phone: string | null; cpf: string | null; asaas_customer_id: string | null }>();
  if (!u) throw forbidden();
  let cpf = await unseal(c.env, u.cpf);
  if (!cpf) {
    cpf = normalizeCpf(b.cpf);
    if (!cpf) throw badRequest('Informe um CPF válido.', 'invalid_cpf');
  }

  const provider = paymentProvider(c.env);
  // Troca de forma de pagamento: cancela a cobrança anterior para não existirem duas em aberto.
  if (last?.status === 'pendente' && last.provider_id) {
    await provider.cancel(last.provider_id).catch(() => undefined);
    await expire(db, last);
  }
  const customerId = await provider.customer({ id: u.id, name: u.name, email: u.email, phone: u.phone, cpf, providerCustomerId: u.asaas_customer_id });
  const ch = await provider.charge({
    customerId,
    method,
    amountCents: o.total_cents,
    orderId: o.id,
    description: `EconoRota — pedido ${o.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`,
  });
  const id = newId();
  await db.batch([
    db.prepare('UPDATE users SET cpf = ?, asaas_customer_id = ? WHERE id = ?').bind(await seal(c.env, cpf), provider.name === 'asaas' ? customerId : u.asaas_customer_id, u.id),
    db.prepare(`UPDATE orders SET payment_method = ? WHERE id = ?`).bind(method, o.id),
    db.prepare(
      `INSERT INTO payments (id, order_id, provider, provider_id, method, amount_cents, pix_payload, pix_image, pix_expires_at, invoice_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, o.id, provider.name, ch.providerId, method, o.total_cents, ch.pix?.payload ?? null, ch.pix?.image ?? null, ch.pix?.expiresAt ?? null, ch.invoiceUrl),
  ]);
  await audit(db, { userId: user.id, action: 'payment.create', entity: 'order', entityId: o.id, data: { method } });
  return c.json({ payment: view(await lastPayment(db, o.id)), cpf: maskCpf(cpf) }, 201);
});

/** Cancelamento pelo cliente: antes de pagar, cancela; pago e ainda não em separação, estorna. */
payments.post('/orders/:id/cancel', requireAuth('cliente'), async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const o = await ownOrder(db, c.req.param('id'), user.id);
  const last = await lastPayment(db, o.id);
  if (o.status === 'aguardando_pagamento') {
    if (last?.status === 'pendente' && last.provider_id) {
      await paymentProvider(c.env).cancel(last.provider_id).catch(() => undefined);
      await expire(db, last);
    }
    await db.batch([
      db.prepare("UPDATE orders SET status = 'cancelado', cancel_reason = 'cliente' WHERE id = ?").bind(o.id),
      db.prepare("UPDATE order_markets SET status = 'cancelado' WHERE order_id = ?").bind(o.id),
    ]);
  } else if (o.status === 'pago' && last?.status === 'aprovado') {
    if (last.provider_id) await paymentProvider(c.env).refund(last.provider_id);
    await db.prepare("UPDATE orders SET cancel_reason = 'cliente' WHERE id = ?").bind(o.id).run();
    await refunded(db, last, 'cliente');
  } else {
    throw conflict('Este pedido já está em andamento e não pode ser cancelado aqui. Abra uma ocorrência.', 'not_cancellable');
  }
  await audit(db, { userId: user.id, action: 'order.cancel', entity: 'order', entityId: o.id });
  return c.json({ order_status: 'cancelado', refunded: o.status === 'pago' });
});

/** Somente em desenvolvimento (simulador): aprova ou recusa o pagamento pendente. */
payments.post('/orders/:id/pay/simulate', requireAuth('cliente'), async (c) => {
  if (c.env.DEV_MODE !== 'true' || c.env.ASAAS_API_KEY) throw notFound();
  const db = c.env.DB;
  const o = await ownOrder(db, c.req.param('id'), c.get('user').id);
  const last = await lastPayment(db, o.id);
  if (!last || last.status !== 'pendente') throw conflict('Nenhum pagamento pendente.', 'no_pending');
  const result = oneOf(await readJson(c.req.raw), 'result', ['aprovado', 'recusado'] as const);
  const r = result === 'aprovado' ? await approve(db, last, paymentProvider(c.env)) : await refuse(db, last, 'cartao_recusado');
  await onOrderPaid(c.env, o.id, r);
  return c.json({ result: r });
});

/** Webhook do Asaas. Autenticado pelo token configurado no painel do Asaas; eventos repetidos são ignorados. */
webhooks.post('/asaas', async (c) => {
  const token = c.req.header('asaas-access-token') ?? '';
  if (!c.env.ASAAS_WEBHOOK_TOKEN || !safeEqualText(token, c.env.ASAAS_WEBHOOK_TOKEN)) throw new ApiError(401, 'unauthorized', 'Não autorizado.');
  const b = (await readJson(c.req.raw)) as { id?: string; event?: string; payment?: { id?: string; value?: number } };
  const db = c.env.DB;
  if (!b.event || !b.payment?.id) return c.json({ ok: true });
  if (b.id) {
    const seen = await db.prepare('INSERT OR IGNORE INTO webhook_events (id) VALUES (?)').bind(b.id).run();
    if (!seen.meta.changes) return c.json({ ok: true, duplicate: true });
  }
  const p = await db.prepare("SELECT * FROM payments WHERE provider = 'asaas' AND provider_id = ?").bind(b.payment.id).first<PayRow>();
  if (!p) return c.json({ ok: true, ignored: true });
  if (typeof b.payment.value === 'number' && Math.round(b.payment.value * 100) !== p.amount_cents) {
    await audit(db, { action: 'payment.value_mismatch', entity: 'order', entityId: p.order_id, data: b.payment });
    return c.json({ ok: true, ignored: true });
  }
  const provider = paymentProvider(c.env);
  switch (b.event) {
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED':
      await onOrderPaid(c.env, p.order_id, await approve(db, p, provider));
      break;
    case 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED':
    case 'PAYMENT_REPROVED_BY_RISK_ANALYSIS':
      await refuse(db, p, 'cartao_recusado');
      break;
    case 'PAYMENT_OVERDUE':
    case 'PAYMENT_DELETED':
      await expire(db, p);
      break;
    case 'PAYMENT_REFUNDED':
    case 'PAYMENT_CHARGEBACK_REQUESTED':
      if ((await refunded(db, p)) === 'refunded') {
        await notifyCustomer(c.env, p.order_id, {
          kind: 'estorno',
          title: 'Pagamento devolvido',
          body: 'O valor do seu pedido foi estornado. O prazo para aparecer depende do banco ou do cartão.',
          email: true,
        });
      }
      break;
  }
  return c.json({ ok: true });
});

export { webhooks };
export default payments;
