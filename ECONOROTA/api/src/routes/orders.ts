import { Hono } from 'hono';

import { audit, requireAuth } from '../lib/auth';
import { newId } from '../lib/crypto';
import { ApiError, badRequest, conflict } from '../lib/errors';
import { MAX_MARKETS } from '../lib/optimizer';
import type { AppEnv } from '../lib/types';
import { oneOf, readJson, str } from '../lib/validate';
import { orderGrams } from '../lib/dispatch';
import { getSettings } from '../lib/settings';
import { computeCompare } from './compare';

const orders = new Hono<AppEnv>();

const FILTERS: Record<string, string> = {
  andamento: "o.status NOT IN ('entregue','cancelado')",
  entregues: "o.status = 'entregue'",
  cancelados: "o.status = 'cancelado'",
};

/** Histórico do cliente (só os próprios pedidos), com prévia dos itens. */
orders.get('/orders', requireAuth(), async (c) => {
  const status = c.req.query('status');
  if (status && !FILTERS[status]) throw badRequest('Filtro inválido.', 'validation');
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 20, 1), 50);
  const offset = Math.max(Number(c.req.query('offset')) || 0, 0);

  const { results: list } = await c.env.DB.prepare(
    `SELECT o.id, o.status, o.total_cents, o.created_at,
            (SELECT COUNT(*) FROM order_markets om WHERE om.order_id = o.id) AS market_count,
            (SELECT m.name FROM order_markets om JOIN markets m ON m.id = om.market_id WHERE om.order_id = o.id ORDER BY om.sequence LIMIT 1) AS market_name,
            (SELECT m.image_url FROM order_markets om JOIN markets m ON m.id = om.market_id WHERE om.order_id = o.id ORDER BY om.sequence LIMIT 1) AS market_image_url,
            (SELECT SUM(oi.quantity) FROM order_markets om JOIN order_items oi ON oi.order_market_id = om.id WHERE om.order_id = o.id) AS item_count
       FROM orders o
      WHERE o.customer_user_id = ? ${status ? `AND ${FILTERS[status]}` : ''}
      ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(c.get('user').id, limit + 1, offset)
    .all<{ id: string }>();

  const page = list.slice(0, limit);
  const previews = new Map<string, unknown[]>();
  if (page.length) {
    const marks = page.map(() => '?').join(',');
    const { results } = await c.env.DB.prepare(
      `SELECT om.order_id, oi.product_name AS name, oi.image_url FROM order_items oi
         JOIN order_markets om ON om.id = oi.order_market_id
        WHERE om.order_id IN (${marks}) ORDER BY om.sequence, oi.rowid`,
    )
      .bind(...page.map((o) => o.id))
      .all<{ order_id: string; name: string; image_url: string | null }>();
    for (const r of results) {
      const arr = previews.get(r.order_id) ?? [];
      if (arr.length < 4) arr.push({ name: r.name, image_url: r.image_url });
      previews.set(r.order_id, arr);
    }
  }
  return c.json({
    items: page.map((o) => ({ ...o, items_preview: previews.get(o.id) ?? [] })),
    next_offset: list.length > limit ? offset + limit : null,
  });
});

/**
 * Confirma o pedido. Preços, estoque, entrega e total são SEMPRE recalculados aqui;
 * se algo mudou desde a tela do cliente, o pedido não é criado (409) e o app pede uma revisão.
 */
orders.post('/orders', requireAuth('cliente'), async (c) => {
  const userId = c.get('user').id;
  const b = await readJson(c.req.raw);

  const u = await c.env.DB.prepare('SELECT email_verified_at, phone_verified_at FROM users WHERE id = ?')
    .bind(userId)
    .first<{ email_verified_at: string | null; phone_verified_at: string | null }>();
  if (!u?.email_verified_at && !u?.phone_verified_at) throw new ApiError(403, 'unverified', 'Confirme seu e-mail ou telefone para fazer pedidos.');

  const recent = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM orders WHERE customer_user_id = ? AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ','now','-10 minutes')",
  )
    .bind(userId)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= 5) throw new ApiError(429, 'rate_limited', 'Muitos pedidos em pouco tempo. Aguarde alguns minutos.');

  const payment = oneOf(b, 'payment_method', ['pix', 'cartao'] as const);
  const marketIds = Array.isArray(b.market_ids) ? [...new Set((b.market_ids as unknown[]).filter((x): x is string => typeof x === 'string'))] : [];
  if (!marketIds.length || marketIds.length > MAX_MARKETS) throw badRequest('Mercados inválidos.', 'validation');
  const expected = Number(b.expected_total_cents);
  if (!Number.isInteger(expected) || expected <= 0) throw badRequest('Total inválido.', 'validation');

  const a = (b.address ?? {}) as Record<string, unknown>;
  if (typeof a !== 'object') throw badRequest('Endereço inválido.', 'validation');
  const lat = Number(a.lat);
  const lng = Number(a.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw badRequest('Confirme o endereço de entrega.', 'validation');
  }
  const address = {
    street: str(a, 'street', { min: 2, max: 160 })!,
    number: str(a, 'number', { optional: true, max: 20 }) ?? null,
    complement: str(a, 'complement', { optional: true, max: 80 }) ?? null,
    district: str(a, 'district', { optional: true, max: 80 }) ?? null,
    city: str(a, 'city', { min: 2, max: 80 })!,
    state: str(a, 'state', { min: 2, max: 2 })!.toUpperCase(),
    zip: (str(a, 'zip', { optional: true, max: 9 }) ?? '').replace(/\D/g, '') || null,
  };

  const { result, route, info } = await computeCompare(c.env, { items: b.items, lat, lng, market_ids: marketIds });
  const plan = result.cheapest;
  const same = plan && plan.marketIds.length === marketIds.length && plan.marketIds.every((id) => marketIds.includes(id));
  if (!plan || !same || plan.missing.length) {
    throw conflict('Preços ou estoque mudaram. Revise seu carrinho.', 'cart_changed');
  }
  if (plan.itemsCents < (await getSettings(c.env)).min_order_cents) throw badRequest('Pedido abaixo do mínimo.', 'min_order');
  if (plan.totalCents !== expected) throw conflict('Os preços foram atualizados. Revise seu carrinho.', 'cart_changed');

  const ids = plan.lines.map((l) => l.productId);
  const { results: prods } = await c.env.DB.prepare(
    `SELECT id, name, brand, unit, image_url FROM products WHERE id IN (${ids.map(() => '?').join(',')})`,
  )
    .bind(...ids)
    .all<{ id: string; name: string; brand: string | null; unit: string; image_url: string | null }>();
  const prod = new Map(prods.map((p) => [p.id, p]));

  const orderId = newId();
  const single = result.single;
  const savings = single && single.totalCents > plan.totalCents ? single.totalCents - plan.totalCents : 0;
  const order = route(plan)?.order ?? plan.marketIds;
  const db = c.env.DB;
  const stmts = [
    db.prepare(
      `INSERT INTO orders (id, customer_user_id, status, subtotal_cents, delivery_fee_cents, savings_cents, total_cents,
                           payment_method, delivery_address, delivery_lat, delivery_lng, eta_max_min, weight_grams)
       VALUES (?, ?, 'aguardando_pagamento', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      orderId, userId, plan.itemsCents, plan.deliveryCents, savings, plan.totalCents, payment, JSON.stringify(address), lat, lng, plan.etaMax,
      orderGrams(plan.lines.map((l) => ({ unit: prod.get(l.productId)?.unit, qty: l.qty }))),
    ),
  ];
  order.forEach((marketId, i) => {
    const omId = newId();
    const lines = plan.lines.filter((l) => l.marketId === marketId);
    stmts.push(
      db.prepare('INSERT INTO order_markets (id, order_id, market_id, sequence, subtotal_cents) VALUES (?, ?, ?, ?, ?)').bind(
        omId, orderId, marketId, i + 1, lines.reduce((s, l) => s + l.totalCents, 0),
      ),
    );
    for (const l of lines) {
      const p = prod.get(l.productId);
      const name = p ? [p.name, p.brand, p.unit].filter(Boolean).join(' · ') : (info.get(l.key)?.name ?? l.key);
      stmts.push(
        db.prepare(
          'INSERT INTO order_items (id, order_market_id, product_id, product_name, unit_price_cents, quantity, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ).bind(newId(), omId, l.productId, name, l.unitCents, l.qty, p?.image_url ?? null),
      );
    }
  });
  await db.batch(stmts);
  await audit(db, { userId, action: 'order.create', entity: 'order', entityId: orderId, ip: c.req.header('cf-connecting-ip') ?? undefined });

  return c.json(
    {
      order: {
        id: orderId,
        status: 'aguardando_pagamento',
        payment_method: payment,
        items_cents: plan.itemsCents,
        delivery_cents: plan.deliveryCents,
        savings_cents: savings,
        total_cents: plan.totalCents,
        market_ids: order,
        eta_max: plan.etaMax,
      },
    },
    201,
  );
});

export default orders;
