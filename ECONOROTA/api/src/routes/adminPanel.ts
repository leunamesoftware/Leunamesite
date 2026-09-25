import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';

import { audit } from '../lib/auth';
import { hashPassword, newId } from '../lib/crypto';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors';
import { streamFile } from '../lib/files';
import { distanceKm } from '../lib/geo';
import { balance, PLATFORM, statement } from '../lib/ledger';
import { brl, notifyCourier, notifyCustomer, notifyMarketOwner } from '../lib/notifications';
import { refunded, expire } from '../lib/orderPayment';
import { paymentProvider } from '../lib/payments';
import { RULES, clearSettingsCache, getSettings, type Settings } from '../lib/settings';
import { unsealRow } from '../lib/fieldCrypto';
import type { AppEnv } from '../lib/types';
import { email, oneOf, password, readJson, str } from '../lib/validate';

/**
 * Painel administrativo (Fase 13). Áreas de permissão da equipe:
 * operacao (clientes, mercados, entregadores, produtos, pedidos, entregas, regiões, avaliações, ocorrências),
 * financeiro (pagamentos, relatórios, repasses) e sistema (configurações, equipe, auditoria).
 */
export const AREAS = ['operacao', 'financeiro', 'sistema'] as const;
export type Area = (typeof AREAS)[number];

export async function adminPerms(db: D1Database, userId: string): Promise<Area[]> {
  const row = await db.prepare('SELECT admin_perms FROM users WHERE id = ?').bind(userId).first<{ admin_perms: string | null }>();
  if (!row?.admin_perms) return [...AREAS];
  try {
    const list = JSON.parse(row.admin_perms) as string[];
    return AREAS.filter((a) => list.includes(a));
  } catch {
    return [];
  }
}

export const perm = (area: Area) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (!(await adminPerms(c.env.DB, c.get('user').id)).includes(area)) throw forbidden('Sem permissão para esta área.');
    await next();
  });

/** Montado dentro de `admin` (que já exige login de administrador). */
const panel = new Hono<AppEnv>();
for (const p of ['/clientes', '/mercados', '/entregadores', '/produtos', '/pedidos', '/entregas', '/regioes', '/avaliacoes', '/usuarios-status']) {
  panel.use(p, perm('operacao'));
  panel.use(`${p}/*`, perm('operacao'));
}
for (const p of ['/pagamentos', '/relatorios', '/financeiro', '/repasses', '/extrato']) {
  panel.use(p, perm('financeiro'));
  panel.use(`${p}/*`, perm('financeiro'));
}
for (const p of ['/configuracoes', '/equipe', '/auditoria']) {
  panel.use(p, perm('sistema'));
  panel.use(`${p}/*`, perm('sistema'));
}

const like = (q: string) => `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
const q = (v: string | undefined) => (v ?? '').trim().slice(0, 80);
/** Início do dia (horário de Brasília) em ISO UTC. */
const todayStart = () => {
  const d = new Date(Date.now() - 3 * 3600_000);
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() + 3 * 3600_000).toISOString();
};
const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000).toISOString();
const days = (v: string | undefined, def = 30) => Math.min(Math.max(Number(v) || def, 1), 365);

/** Quem sou eu no painel (áreas liberadas). */
panel.get('/eu', async (c) => c.json({ perms: await adminPerms(c.env.DB, c.get('user').id) }));

/** Dashboard. */
panel.get('/resumo', async (c) => {
  const db = c.env.DB;
  const today = todayStart();
  const kpis = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM orders WHERE paid_at >= ?1) AS orders_today,
        (SELECT COALESCE(SUM(total_cents), 0) FROM orders WHERE paid_at >= ?1 AND status != 'cancelado') AS gmv_today,
        (SELECT COUNT(*) FROM orders WHERE status IN ('pago','em_separacao','pronto_coleta','em_rota')) AS active_orders,
        (SELECT COUNT(*) FROM orders WHERE status = 'em_rota') AS on_route,
        (SELECT COUNT(*) FROM users WHERE role = 'cliente') AS customers,
        (SELECT COUNT(*) FROM users WHERE role = 'cliente' AND created_at >= ?1) AS new_customers,
        (SELECT COUNT(*) FROM markets WHERE status = 'ativo') AS markets_active,
        (SELECT COUNT(*) FROM markets WHERE status = 'pendente') AS markets_pending,
        (SELECT COUNT(*) FROM couriers WHERE status = 'aprovado') AS couriers_approved,
        (SELECT COUNT(*) FROM couriers WHERE status = 'aprovado' AND is_online = 1) AS couriers_online,
        (SELECT COUNT(*) FROM couriers WHERE status = 'pendente' AND submitted_at IS NOT NULL) AS couriers_pending,
        (SELECT COUNT(*) FROM occurrences WHERE status IN ('aberta','em_analise')) AS occurrences_open,
        (SELECT COUNT(*) FROM products WHERE is_active = 1 AND stock = 0) AS products_out`,
    )
    .bind(today)
    .first();
  const { results: byDay } = await db
    .prepare(
      `SELECT date(paid_at, '-3 hours') AS day, COUNT(*) AS orders, COALESCE(SUM(total_cents), 0) AS gmv_cents
         FROM orders WHERE paid_at >= ? AND status != 'cancelado' GROUP BY day ORDER BY day`,
    )
    .bind(daysAgo(7))
    .all();
  return c.json({ kpis, by_day: byDay });
});

// ── Clientes ──────────────────────────────────────────────────────────────────
panel.get('/clientes', async (c) => {
  const term = q(c.req.query('q'));
  const status = c.req.query('status');
  if (status && !['ativo', 'bloqueado'].includes(status)) throw badRequest('Filtro inválido.', 'validation');
  const where = ["u.role = 'cliente'"];
  const args: unknown[] = [];
  if (term) {
    where.push("(u.name LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\' OR u.phone LIKE ? ESCAPE '\\')");
    args.push(like(term), like(term), like(term));
  }
  if (status) {
    where.push('u.status = ?');
    args.push(status);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.phone, u.status, u.created_at, COALESCE(cu.rating, 0) AS rating, COALESCE(cu.rating_count, 0) AS rating_count,
            (SELECT COUNT(*) FROM orders o WHERE o.customer_user_id = u.id AND o.paid_at IS NOT NULL) AS orders,
            (SELECT COALESCE(SUM(o.total_cents), 0) FROM orders o WHERE o.customer_user_id = u.id AND o.paid_at IS NOT NULL AND o.status != 'cancelado') AS spent_cents,
            (SELECT COUNT(*) FROM occurrences oc WHERE oc.customer_user_id = u.id) AS occurrences
       FROM users u LEFT JOIN customers cu ON cu.user_id = u.id
      WHERE ${where.join(' AND ')} ORDER BY u.created_at DESC LIMIT 100`,
  )
    .bind(...args)
    .all();
  return c.json({ items: results });
});

/** Bloquear/desbloquear cliente, dono de mercado ou entregador (nunca administradores por aqui). */
panel.post('/usuarios-status/:id', async (c) => {
  const id = c.req.param('id');
  if (id === c.get('user').id) throw badRequest('Você não pode alterar a própria conta.', 'validation');
  const b = await readJson(c.req.raw);
  const status = oneOf(b, 'status', ['ativo', 'bloqueado'] as const);
  const reason = str(b, 'motivo', { max: 300, optional: true }) ?? null;
  const u = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(id).first<{ role: string }>();
  if (!u || u.role === 'admin') throw notFound('Usuário não encontrado.');
  // Bloqueio encerra as sessões abertas.
  await c.env.DB.prepare(
    `UPDATE users SET status = ?, token_version = token_version + ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
  )
    .bind(status, status === 'bloqueado' ? 1 : 0, id)
    .run();
  await audit(c.env.DB, { userId: c.get('user').id, action: `user.${status === 'bloqueado' ? 'block' : 'unblock'}`, entity: 'user', entityId: id, data: { reason } });
  return c.json({ ok: true, status });
});

// ── Mercados ──────────────────────────────────────────────────────────────────
panel.get('/mercados', async (c) => {
  const status = c.req.query('status');
  if (status && !['pendente', 'ativo', 'suspenso'].includes(status)) throw badRequest('Filtro inválido.', 'validation');
  const term = q(c.req.query('q'));
  const where: string[] = [];
  const args: unknown[] = [daysAgo(30)];
  if (status) {
    where.push('m.status = ?');
    args.push(status);
  }
  if (term) {
    where.push("(m.name LIKE ? ESCAPE '\\' OR m.city LIKE ? ESCAPE '\\')");
    args.push(like(term), like(term));
  }
  const { results } = await c.env.DB.prepare(
    `SELECT m.id, m.name, m.district, m.city, m.state, m.status, m.is_open, m.rating, m.rating_count, m.image_url, m.created_at,
            u.id AS owner_id, u.name AS owner_name, u.email AS owner_email, u.status AS owner_status,
            (SELECT COUNT(*) FROM products p WHERE p.market_id = m.id AND p.is_active = 1) AS products,
            (SELECT COUNT(*) FROM order_markets om JOIN orders o ON o.id = om.order_id WHERE om.market_id = m.id AND o.paid_at >= ?1 AND om.status != 'cancelado') AS orders_30d,
            (SELECT COALESCE(SUM(om.subtotal_cents), 0) FROM order_markets om JOIN orders o ON o.id = om.order_id WHERE om.market_id = m.id AND o.paid_at >= ?1 AND om.status != 'cancelado') AS sales_30d
       FROM markets m JOIN users u ON u.id = m.owner_user_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY CASE m.status WHEN 'pendente' THEN 0 WHEN 'suspenso' THEN 1 ELSE 2 END, m.name LIMIT 200`,
  )
    .bind(...args)
    .all();
  return c.json({ items: results });
});

/** Aprovar (ativo) ou suspender um mercado. Suspenso some das buscas e fecha a loja. */
panel.post('/mercados/:id/status', async (c) => {
  const b = await readJson(c.req.raw);
  const status = oneOf(b, 'status', ['ativo', 'suspenso'] as const);
  const reason = str(b, 'motivo', { max: 300, optional: true }) ?? null;
  if (status === 'suspenso' && !reason) throw badRequest('Informe o motivo da suspensão.', 'validation');
  if (status === 'ativo') {
    const m = await c.env.DB.prepare('SELECT address, lat, lng FROM markets WHERE id = ?').bind(c.req.param('id')).first<{ address: string | null; lat: number | null }>();
    if (m && (!m.address || m.lat == null)) throw conflict('O mercado ainda não informou endereço e localização no painel.', 'incomplete');
  }
  const r = await c.env.DB.prepare(`UPDATE markets SET status = ?, is_open = CASE WHEN ? = 'suspenso' THEN 0 ELSE is_open END WHERE id = ?`)
    .bind(status, status, c.req.param('id'))
    .run();
  if (!r.meta.changes) throw notFound('Mercado não encontrado.');
  await audit(c.env.DB, { userId: c.get('user').id, action: `market.${status}`, entity: 'market', entityId: c.req.param('id'), data: { reason } });
  await notifyMarketOwner(c.env, c.req.param('id'), {
    kind: 'mercado',
    title: status === 'ativo' ? 'Mercado ativo no EconoRota' : 'Mercado suspenso',
    body: status === 'ativo' ? 'Sua loja já aparece para os clientes da região.' : `Motivo: ${reason}. Fale com o suporte para regularizar.`,
    link: '/mercado',
    email: true,
  });
  return c.json({ ok: true, status });
});

// ── Entregadores ──────────────────────────────────────────────────────────────
const courierCols = `co.id, co.user_id, u.name, u.email, u.phone, u.status AS user_status, co.status, co.vehicle_type, co.vehicle_plate,
  co.vehicle_model, co.vehicle_color, co.cnh_number, co.birth_date, co.work_radius_km, co.is_online, co.last_seen_at, co.submitted_at,
  co.review_note, co.rating, co.rating_count, co.document_photo_key IS NOT NULL AS has_document, co.vehicle_doc_key IS NOT NULL AS has_vehicle_doc,
  (SELECT COUNT(*) FROM orders o WHERE o.courier_id = co.id AND o.status = 'entregue') AS deliveries`;

panel.get('/entregadores', async (c) => {
  const f = c.req.query('status');
  const filters: Record<string, string> = {
    analise: "co.status = 'pendente' AND co.submitted_at IS NOT NULL",
    incompleto: "co.status = 'pendente' AND co.submitted_at IS NULL",
    aprovado: "co.status = 'aprovado'",
    bloqueado: "co.status = 'bloqueado'",
    online: "co.status = 'aprovado' AND co.is_online = 1",
  };
  if (f && !filters[f]) throw badRequest('Filtro inválido.', 'validation');
  const { results } = await c.env.DB.prepare(
    `SELECT ${courierCols} FROM couriers co JOIN users u ON u.id = co.user_id
      ${f ? `WHERE ${filters[f]}` : ''} ORDER BY co.submitted_at IS NULL, co.submitted_at DESC LIMIT 200`,
  ).all();
  // Documentos só na ficha (e sempre decifrados lá).
  return c.json({ items: results.map((r) => ({ ...r, cnh_number: undefined })) });
});

panel.get('/entregadores/:id', async (c) => {
  const row = await c.env.DB.prepare(`SELECT ${courierCols}, co.cpf, co.pix_key FROM couriers co JOIN users u ON u.id = co.user_id WHERE co.id = ?`)
    .bind(c.req.param('id'))
    .first<Record<string, unknown> & { cpf: string | null; cnh_number: string | null; pix_key: string | null }>()
    .then((r) => (r ? unsealRow(c.env, r, ['cpf', 'cnh_number', 'pix_key']) : null));
  if (!row) throw notFound('Entregador não encontrado.');
  const cpf = row.cpf ? `${row.cpf.slice(0, 3)}.${row.cpf.slice(3, 6)}.${row.cpf.slice(6, 9)}-${row.cpf.slice(9)}` : null;
  return c.json({ courier: { ...row, cpf } });
});

/** Documentos do entregador (CNH/documento com foto e CRLV) — só a administração vê. */
panel.get('/entregadores/:id/arquivos/:tipo', async (c) => {
  const col = { documento: 'document_photo_key', crlv: 'vehicle_doc_key' }[c.req.param('tipo')];
  if (!col) throw notFound();
  const row = await c.env.DB.prepare(`SELECT ${col} AS k FROM couriers WHERE id = ?`).bind(c.req.param('id')).first<{ k: string | null }>();
  const res = row?.k ? await streamFile(c.env.FILES, row.k) : null;
  if (!res) throw notFound('Arquivo não enviado.');
  await audit(c.env.DB, { userId: c.get('user').id, action: 'courier.view_document', entity: 'courier', entityId: c.req.param('id'), data: { tipo: c.req.param('tipo') } });
  return res;
});

/** Decisão sobre o cadastro: aprovar, recusar (volta para correção), bloquear ou desbloquear. */
panel.post('/entregadores/:id/decidir', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const b = await readJson(c.req.raw);
  const decision = oneOf(b, 'decisao', ['aprovar', 'recusar', 'bloquear', 'desbloquear'] as const);
  const note = str(b, 'nota', { max: 500, optional: true }) ?? null;
  if ((decision === 'recusar' || decision === 'bloquear') && !note) throw badRequest('Explique o motivo para o entregador.', 'validation');
  const co = await db.prepare('SELECT id, status, submitted_at, is_online FROM couriers WHERE id = ?').bind(id).first<{ status: string; submitted_at: string | null }>();
  if (!co) throw notFound('Entregador não encontrado.');
  const active = await db
    .prepare("SELECT COUNT(*) AS n FROM orders WHERE courier_id = ? AND status IN ('pronto_coleta','em_rota','em_separacao','pago') AND delivered_at IS NULL")
    .bind(id)
    .first<{ n: number }>();
  let sql: string;
  switch (decision) {
    case 'aprovar':
      if (co.status !== 'pendente' || !co.submitted_at) throw conflict('Cadastro não está em análise.', 'invalid_state');
      sql = "UPDATE couriers SET status = 'aprovado', review_note = ? WHERE id = ?";
      break;
    case 'recusar':
      if (co.status !== 'pendente' || !co.submitted_at) throw conflict('Cadastro não está em análise.', 'invalid_state');
      sql = 'UPDATE couriers SET submitted_at = NULL, review_note = ? WHERE id = ?';
      break;
    case 'bloquear':
      if ((active?.n ?? 0) > 0) throw conflict('O entregador está com uma entrega em andamento.', 'busy');
      sql = "UPDATE couriers SET status = 'bloqueado', is_online = 0, review_note = ? WHERE id = ?";
      break;
    default:
      if (co.status !== 'bloqueado') throw conflict('Entregador não está bloqueado.', 'invalid_state');
      sql = "UPDATE couriers SET status = 'aprovado', review_note = ? WHERE id = ?";
  }
  await db.prepare(sql).bind(note, id).run();
  await audit(db, { userId: c.get('user').id, action: `courier.${decision}`, entity: 'courier', entityId: id, data: { note } });
  const msg = {
    aprovar: ['Cadastro aprovado!', 'Você já pode ficar disponível e receber entregas.'],
    recusar: ['Ajuste seu cadastro', note ?? 'Revise os dados e envie de novo.'],
    bloquear: ['Cadastro bloqueado', note ?? 'Fale com o suporte do EconoRota.'],
    desbloquear: ['Cadastro liberado', 'Você já pode voltar a receber entregas.'],
  }[decision];
  await notifyCourier(c.env, id, { kind: 'cadastro', title: msg[0], body: msg[1], link: '/entregador/perfil', email: true });
  return c.json({ ok: true });
});

// ── Produtos e estoque (todos os mercados) ─────────────────────────────────────
panel.get('/produtos', async (c) => {
  const term = q(c.req.query('q'));
  const f = c.req.query('filtro');
  const filters: Record<string, string> = {
    baixo: 'p.stock > 0 AND p.stock <= p.min_stock',
    indisponivel: 'p.stock = 0',
    vencendo: "p.expires_on IS NOT NULL AND p.expires_on <= date('now', '+3 days')",
    inativo: 'p.is_active = 0',
  };
  if (f && !filters[f]) throw badRequest('Filtro inválido.', 'validation');
  const where: string[] = [];
  const args: unknown[] = [];
  if (f) where.push(filters[f]);
  if (f !== 'inativo') where.push('p.is_active = 1');
  const market = c.req.query('mercado');
  if (market) {
    where.push('p.market_id = ?');
    args.push(market);
  }
  if (term) {
    where.push("(p.name LIKE ? ESCAPE '\\' OR p.brand LIKE ? ESCAPE '\\' OR p.barcode = ?)");
    args.push(like(term), like(term), term);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT p.id, p.name, p.brand, p.unit, p.price_cents, p.promo_price_cents, p.stock, p.min_stock, p.is_active, p.expires_on, p.image_url,
            p.market_id, m.name AS market_name
       FROM products p JOIN markets m ON m.id = p.market_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY p.stock = 0 DESC, p.name LIMIT 200`,
  )
    .bind(...args)
    .all();
  return c.json({ items: results });
});

/** Moderação: tirar do ar (ou devolver) um produto irregular. */
panel.post('/produtos/:id/ativo', async (c) => {
  const b = await readJson(c.req.raw);
  const on = b.ativo === true;
  const reason = str(b, 'motivo', { max: 300, optional: true }) ?? null;
  if (!on && !reason) throw badRequest('Informe o motivo.', 'validation');
  const r = await c.env.DB.prepare("UPDATE products SET is_active = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?")
    .bind(on ? 1 : 0, c.req.param('id'))
    .run();
  if (!r.meta.changes) throw notFound('Produto não encontrado.');
  await audit(c.env.DB, { userId: c.get('user').id, action: on ? 'product.activate' : 'product.deactivate', entity: 'product', entityId: c.req.param('id'), data: { reason } });
  return c.json({ ok: true });
});

// ── Pedidos e entregas ────────────────────────────────────────────────────────
const ORDER_GROUPS: Record<string, string> = {
  pagamento: "o.status = 'aguardando_pagamento'",
  andamento: "o.status IN ('pago','em_separacao','pronto_coleta','em_rota')",
  entregues: "o.status = 'entregue'",
  cancelados: "o.status = 'cancelado'",
};

panel.get('/pedidos', async (c) => {
  const g = c.req.query('grupo');
  if (g && !ORDER_GROUPS[g]) throw badRequest('Filtro inválido.', 'validation');
  const term = q(c.req.query('q'));
  const where: string[] = [];
  const args: unknown[] = [];
  if (g) where.push(ORDER_GROUPS[g]);
  if (term) {
    where.push("(o.id LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\')");
    args.push(`${term.replace(/[\\%_]/g, (m) => `\\${m}`)}%`, like(term), like(term));
  }
  const { results } = await c.env.DB.prepare(
    `SELECT o.id, o.status, o.total_cents, o.delivery_fee_cents, o.payment_method, o.created_at, o.paid_at, o.delivered_at, o.eta_max_min,
            u.name AS customer_name, cu.name AS courier_name,
            (SELECT GROUP_CONCAT(m.name, ', ') FROM order_markets om JOIN markets m ON m.id = om.market_id WHERE om.order_id = o.id) AS markets,
            (SELECT COUNT(*) FROM occurrences oc WHERE oc.order_id = o.id AND oc.status IN ('aberta','em_analise')) AS open_occurrences
       FROM orders o JOIN users u ON u.id = o.customer_user_id
       LEFT JOIN couriers co ON co.id = o.courier_id LEFT JOIN users cu ON cu.id = co.user_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY o.created_at DESC LIMIT 200`,
  )
    .bind(...args)
    .all();
  return c.json({ items: results });
});

panel.get('/pedidos/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const o = await db
    .prepare(
      `SELECT o.id, o.status, o.subtotal_cents, o.delivery_fee_cents, o.savings_cents, o.total_cents, o.payment_method, o.delivery_address,
              o.cancel_reason, o.created_at, o.paid_at, o.courier_status, o.courier_accepted_at, o.delivered_at, o.eta_max_min, o.courier_earning_cents,
              u.id AS customer_id, u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
              co.id AS courier_id, cu.name AS courier_name, cu.phone AS courier_phone
         FROM orders o JOIN users u ON u.id = o.customer_user_id
         LEFT JOIN couriers co ON co.id = o.courier_id LEFT JOIN users cu ON cu.id = co.user_id WHERE o.id = ?`,
    )
    .bind(id)
    .first<Record<string, unknown> & { delivery_address: string | null }>();
  if (!o) throw notFound('Pedido não encontrado.');
  const [markets, items, pays, occ] = await db.batch([
    db.prepare(
      `SELECT om.id, om.market_id, om.sequence, om.status, om.subtotal_cents, om.accepted_at, om.ready_at, om.picked_at, m.name
         FROM order_markets om JOIN markets m ON m.id = om.market_id WHERE om.order_id = ? ORDER BY om.sequence`,
    ).bind(id),
    db.prepare(
      `SELECT oi.id, oi.order_market_id, oi.product_name AS name, oi.unit_price_cents, oi.quantity, oi.checked
         FROM order_items oi JOIN order_markets om ON om.id = oi.order_market_id WHERE om.order_id = ?`,
    ).bind(id),
    db.prepare('SELECT id, method, status, amount_cents, refunded_cents, failure_reason, created_at FROM payments WHERE order_id = ? ORDER BY created_at DESC').bind(id),
    db.prepare('SELECT id, type, status, refund_cents, created_at FROM occurrences WHERE order_id = ? ORDER BY created_at DESC').bind(id),
  ]);
  const its = items.results as { order_market_id: string }[];
  return c.json({
    order: {
      ...o,
      delivery_address: o.delivery_address ? JSON.parse(o.delivery_address) : null,
      markets: (markets.results as { id: string }[]).map((m) => ({ ...m, items: its.filter((i) => i.order_market_id === m.id) })),
      payments: pays.results,
      occurrences: occ.results,
    },
  });
});

/** Cancelamento administrativo (antes de o entregador sair para entrega). Pago → estorno integral. */
panel.post('/pedidos/:id/cancelar', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const reason = str(await readJson(c.req.raw), 'motivo', { min: 3, max: 300 })!;
  const o = await db.prepare('SELECT id, status FROM orders WHERE id = ?').bind(id).first<{ status: string }>();
  if (!o) throw notFound('Pedido não encontrado.');
  const last = await db.prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1').bind(id).first<Parameters<typeof refunded>[1] & { refunded_cents: number }>();
  if (o.status === 'aguardando_pagamento') {
    if (last?.status === 'pendente') {
      if (last.provider_id) await paymentProvider(c.env).cancel(last.provider_id).catch(() => undefined);
      await expire(db, last);
    }
    await db.batch([
      db.prepare("UPDATE orders SET status = 'cancelado', cancel_reason = 'administracao' WHERE id = ?").bind(id),
      db.prepare("UPDATE order_markets SET status = 'cancelado' WHERE order_id = ?").bind(id),
    ]);
  } else if (['pago', 'em_separacao', 'pronto_coleta'].includes(o.status) && last?.status === 'aprovado') {
    const left = last.amount_cents - (last.refunded_cents ?? 0);
    if (last.provider_id && left > 0) await paymentProvider(c.env).refund(last.provider_id, left);
    await db.prepare("UPDATE orders SET cancel_reason = 'administracao', courier_id = NULL WHERE id = ?").bind(id).run();
    await refunded(db, last, 'administracao');
  } else {
    throw conflict('Este pedido não pode mais ser cancelado (em rota, entregue ou já cancelado).', 'not_cancellable');
  }
  await audit(db, { userId: c.get('user').id, action: 'order.admin_cancel', entity: 'order', entityId: id, data: { reason } });
  await notifyCustomer(c.env, id, {
    kind: 'cancelado',
    title: 'Pedido cancelado',
    body: `${reason}. Se você já pagou, o valor integral foi devolvido.`,
    email: true,
  });
  return c.json({ ok: true });
});

/** Entregas em andamento com posição do entregador e atraso. */
panel.get('/entregas', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT o.id, o.status, o.courier_status, o.paid_at, o.courier_accepted_at, o.eta_max_min, o.delivery_lat, o.delivery_lng,
            cu.name AS courier_name, co.lat AS courier_lat, co.lng AS courier_lng, co.last_seen_at, co.vehicle_type,
            (SELECT COUNT(*) FROM order_markets om WHERE om.order_id = o.id) AS stops,
            (SELECT COUNT(*) FROM order_markets om WHERE om.order_id = o.id AND om.picked_at IS NOT NULL) AS picked
       FROM orders o LEFT JOIN couriers co ON co.id = o.courier_id LEFT JOIN users cu ON cu.id = co.user_id
      WHERE o.status IN ('pago','em_separacao','pronto_coleta','em_rota') ORDER BY o.paid_at LIMIT 200`,
  ).all<{ paid_at: string | null; eta_max_min: number | null; last_seen_at: string | null }>();
  const now = Date.now();
  return c.json({
    items: results.map((r) => {
      const promised = r.paid_at && r.eta_max_min ? Date.parse(r.paid_at) + r.eta_max_min * 60_000 : null;
      return {
        ...r,
        late: promised != null && now > promised,
        minutes_left: promised == null ? null : Math.round((promised - now) / 60_000),
        gps_stale: r.last_seen_at ? now - Date.parse(r.last_seen_at) > 120_000 : null,
      };
    }),
  });
});

// ── Regiões ───────────────────────────────────────────────────────────────────
function regionBody(b: Record<string, unknown>, partial = false) {
  const out: Record<string, unknown> = {};
  for (const k of ['name', 'city', 'state'] as const) {
    const v = str(b, k, { min: 2, max: k === 'state' ? 2 : 80, optional: partial });
    if (v !== undefined) out[k] = k === 'state' ? v.toUpperCase() : v;
  }
  for (const [k, min, max] of [['lat', -90, 90], ['lng', -180, 180], ['radius_km', 0.5, 100]] as const) {
    if (b[k] === undefined) {
      if (!partial && k !== 'radius_km') throw badRequest(`Campo obrigatório: ${k}.`, 'validation');
      continue;
    }
    const n = Number(b[k]);
    if (!Number.isFinite(n) || n < min || n > max) throw badRequest(`Valor inválido: ${k}.`, 'validation');
    out[k] = n;
  }
  if (b.is_active !== undefined) out.is_active = b.is_active === true ? 1 : 0;
  return out;
}

panel.get('/regioes', async (c) => {
  const { results: regions } = await c.env.DB.prepare('SELECT * FROM regions ORDER BY is_active DESC, name').all<{ id: string; lat: number; lng: number; radius_km: number }>();
  const { results: markets } = await c.env.DB.prepare("SELECT lat, lng FROM markets WHERE status = 'ativo' AND lat IS NOT NULL").all<{ lat: number; lng: number }>();
  const { results: couriers } = await c.env.DB.prepare("SELECT lat, lng FROM couriers WHERE status = 'aprovado' AND is_online = 1 AND lat IS NOT NULL").all<{ lat: number; lng: number }>();
  const inside = (r: { lat: number; lng: number; radius_km: number }, p: { lat: number; lng: number }) => distanceKm(r.lat, r.lng, p.lat, p.lng) <= r.radius_km;
  return c.json({
    items: regions.map((r) => ({ ...r, markets: markets.filter((m) => inside(r, m)).length, couriers_online: couriers.filter((m) => inside(r, m)).length })),
  });
});

panel.post('/regioes', async (c) => {
  const v = regionBody(await readJson(c.req.raw));
  const id = newId();
  await c.env.DB.prepare('INSERT INTO regions (id, name, city, state, lat, lng, radius_km) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, v.name, v.city, v.state, v.lat, v.lng, v.radius_km ?? 8)
    .run();
  await audit(c.env.DB, { userId: c.get('user').id, action: 'region.create', entity: 'region', entityId: id, data: v });
  return c.json({ region: await c.env.DB.prepare('SELECT * FROM regions WHERE id = ?').bind(id).first() }, 201);
});

panel.patch('/regioes/:id', async (c) => {
  const v = regionBody(await readJson(c.req.raw), true);
  const keys = Object.keys(v);
  if (!keys.length) throw badRequest('Nada para alterar.', 'validation');
  const r = await c.env.DB.prepare(`UPDATE regions SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .bind(...keys.map((k) => v[k]), c.req.param('id'))
    .run();
  if (!r.meta.changes) throw notFound('Região não encontrada.');
  await audit(c.env.DB, { userId: c.get('user').id, action: 'region.update', entity: 'region', entityId: c.req.param('id'), data: v });
  return c.json({ region: await c.env.DB.prepare('SELECT * FROM regions WHERE id = ?').bind(c.req.param('id')).first() });
});

// ── Avaliações (moderação) ────────────────────────────────────────────────────
panel.get('/avaliacoes', async (c) => {
  const max = Number(c.req.query('estrelas_max')) || 5;
  const hidden = c.req.query('ocultas') === '1' ? 1 : 0;
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM (SELECT 'loja' AS source, r.id, r.order_id, 'cliente' AS from_role, u.name AS from_name, 'mercado' AS to_type, m.name AS to_name,
            r.rating AS stars, r.comment, r.tags, r.hidden, r.created_at
       FROM market_reviews r JOIN users u ON u.id = r.user_id JOIN markets m ON m.id = r.market_id WHERE r.rating <= ?1 AND r.hidden = ?2
     UNION ALL
     SELECT 'interna', r.id, r.order_id, r.from_role, u.name, r.to_type,
            CASE r.to_type WHEN 'mercado' THEN (SELECT name FROM markets WHERE id = r.to_id)
                           WHEN 'entregador' THEN (SELECT uu.name FROM couriers co JOIN users uu ON uu.id = co.user_id WHERE co.id = r.to_id)
                           ELSE (SELECT name FROM users WHERE id = r.to_id) END,
            r.stars, r.comment, r.tags, r.hidden, r.created_at
       FROM ratings r JOIN users u ON u.id = r.from_user_id WHERE r.stars <= ?1 AND r.hidden = ?2)
     ORDER BY created_at DESC LIMIT 200`,
  )
    .bind(max, hidden)
    .all<{ tags: string | null }>();
  return c.json({ items: results.map((r) => ({ ...r, tags: r.tags ? JSON.parse(r.tags) : [] })) });
});

/** Ocultar (ou reexibir) uma avaliação ofensiva/indevida; recalcula a nota. */
panel.post('/avaliacoes/:fonte/:id/ocultar', async (c) => {
  const db = c.env.DB;
  const src = c.req.param('fonte');
  const id = c.req.param('id');
  const b = await readJson(c.req.raw);
  const hide = b.oculta !== false;
  if (src === 'loja') {
    const r = await db.prepare('SELECT market_id FROM market_reviews WHERE id = ?').bind(id).first<{ market_id: string }>();
    if (!r) throw notFound('Avaliação não encontrada.');
    await db.batch([
      db.prepare('UPDATE market_reviews SET hidden = ? WHERE id = ?').bind(hide ? 1 : 0, id),
      db.prepare(
        `UPDATE markets SET rating = COALESCE((SELECT ROUND(AVG(rating), 1) FROM market_reviews WHERE market_id = ?1 AND hidden = 0), 0),
                            rating_count = (SELECT COUNT(*) FROM market_reviews WHERE market_id = ?1 AND hidden = 0) WHERE id = ?1`,
      ).bind(r.market_id),
    ]);
  } else if (src === 'interna') {
    const r = await db.prepare('SELECT to_type, to_id FROM ratings WHERE id = ?').bind(id).first<{ to_type: string; to_id: string }>();
    if (!r) throw notFound('Avaliação não encontrada.');
    const stmts = [db.prepare('UPDATE ratings SET hidden = ? WHERE id = ?').bind(hide ? 1 : 0, id)];
    if (r.to_type !== 'mercado') {
      const [table, col] = r.to_type === 'entregador' ? ['couriers', 'id'] : ['customers', 'user_id'];
      stmts.push(
        db.prepare(
          `UPDATE ${table} SET rating = COALESCE((SELECT ROUND(AVG(stars), 1) FROM ratings WHERE to_type = ?1 AND to_id = ?2 AND hidden = 0), 0),
                                rating_count = (SELECT COUNT(*) FROM ratings WHERE to_type = ?1 AND to_id = ?2 AND hidden = 0) WHERE ${col} = ?2`,
        ).bind(r.to_type, r.to_id),
      );
    }
    await db.batch(stmts);
  } else {
    throw notFound();
  }
  await audit(db, { userId: c.get('user').id, action: hide ? 'rating.hide' : 'rating.show', entity: 'rating', entityId: id });
  return c.json({ ok: true });
});

// ── Pagamentos e relatórios ───────────────────────────────────────────────────
panel.get('/pagamentos', async (c) => {
  const status = c.req.query('status');
  if (status && !['pendente', 'aprovado', 'recusado', 'cancelado', 'estornado'].includes(status)) throw badRequest('Filtro inválido.', 'validation');
  const { results } = await c.env.DB.prepare(
    `SELECT p.id, p.order_id, p.method, p.status, p.amount_cents, p.refunded_cents, p.failure_reason, p.created_at, u.name AS customer_name
       FROM payments p JOIN orders o ON o.id = p.order_id JOIN users u ON u.id = o.customer_user_id
      ${status ? 'WHERE p.status = ?' : ''} ORDER BY p.created_at DESC LIMIT 200`,
  )
    .bind(...(status ? [status] : []))
    .all();
  const totals = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(CASE WHEN status IN ('aprovado','estornado') THEN amount_cents END), 0) AS received_cents,
            COALESCE(SUM(CASE WHEN status = 'estornado' THEN amount_cents ELSE refunded_cents END), 0) AS refunded_cents,
            COUNT(CASE WHEN status = 'pendente' THEN 1 END) AS pending
       FROM payments WHERE created_at >= ?`,
  )
    .bind(daysAgo(30))
    .first();
  return c.json({ items: results, totals_30d: totals });
});

panel.get('/relatorios', async (c) => {
  const db = c.env.DB;
  const n = days(c.req.query('dias'));
  const since = daysAgo(n);
  const s = await getSettings(c.env);
  const [summary, byDay, byMarket, top, delivery] = await db.batch([
    db.prepare(
      `SELECT COUNT(*) AS orders, COALESCE(SUM(total_cents), 0) AS gmv_cents, COALESCE(SUM(subtotal_cents), 0) AS items_cents,
              COALESCE(SUM(delivery_fee_cents), 0) AS delivery_cents, COALESCE(SUM(savings_cents), 0) AS savings_cents,
              COUNT(DISTINCT customer_user_id) AS customers,
              (SELECT COUNT(*) FROM orders WHERE created_at >= ?1 AND status = 'cancelado' AND paid_at IS NOT NULL) AS cancelled_paid
         FROM orders WHERE paid_at >= ?1 AND status != 'cancelado'`,
    ).bind(since),
    db.prepare(
      `SELECT date(paid_at, '-3 hours') AS day, COUNT(*) AS orders, SUM(total_cents) AS gmv_cents
         FROM orders WHERE paid_at >= ? AND status != 'cancelado' GROUP BY day ORDER BY day`,
    ).bind(since),
    db.prepare(
      `SELECT m.id, m.name, COUNT(*) AS orders, SUM(om.subtotal_cents) AS sales_cents
         FROM order_markets om JOIN orders o ON o.id = om.order_id JOIN markets m ON m.id = om.market_id
        WHERE o.paid_at >= ? AND om.status != 'cancelado' GROUP BY m.id ORDER BY sales_cents DESC LIMIT 20`,
    ).bind(since),
    db.prepare(
      `SELECT oi.product_name AS name, SUM(oi.quantity) AS quantity, SUM(oi.quantity * oi.unit_price_cents) AS sales_cents
         FROM order_items oi JOIN order_markets om ON om.id = oi.order_market_id JOIN orders o ON o.id = om.order_id
        WHERE o.paid_at >= ? AND om.status != 'cancelado' AND COALESCE(oi.checked, 1) = 1
        GROUP BY oi.product_name ORDER BY quantity DESC LIMIT 15`,
    ).bind(since),
    db.prepare(
      `SELECT COUNT(*) AS delivered,
              AVG((julianday(delivered_at) - julianday(paid_at)) * 1440) AS avg_minutes,
              SUM(CASE WHEN eta_max_min IS NOT NULL AND (julianday(delivered_at) - julianday(paid_at)) * 1440 <= eta_max_min THEN 1 ELSE 0 END) AS on_time
         FROM orders WHERE status = 'entregue' AND delivered_at >= ? AND paid_at IS NOT NULL`,
    ).bind(since),
  ]);
  const sm = summary.results[0] as { orders: number; gmv_cents: number; items_cents: number; delivery_cents: number };
  const commission = Math.round((sm.items_cents * s.commission_pct) / 100);
  const courierShare = Math.round((sm.delivery_cents * s.courier_share_pct) / 100);
  return c.json({
    days: n,
    summary: {
      ...sm,
      avg_ticket_cents: sm.orders ? Math.round(sm.gmv_cents / sm.orders) : 0,
      commission_cents: commission,
      platform_delivery_cents: sm.delivery_cents - courierShare,
      platform_revenue_cents: commission + sm.delivery_cents - courierShare,
    },
    by_day: byDay.results,
    by_market: byMarket.results,
    top_products: top.results,
    delivery: delivery.results[0],
  });
});

// ── Financeiro: receita, saldos a repassar e repasses ─────────────────────────
panel.get('/financeiro', async (c) => {
  const db = c.env.DB;
  const since = daysAgo(days(c.req.query('dias')));
  const [platform, toPay, pending, refunds] = await db.batch([
    db.prepare(
      `SELECT kind, COALESCE(SUM(amount_cents), 0) AS cents FROM ledger_entries
        WHERE party_type = 'plataforma' AND created_at >= ? GROUP BY kind`,
    ).bind(since),
    db.prepare(
      `SELECT party_type, COUNT(DISTINCT party_id) AS parties,
              COALESCE(SUM(CASE WHEN available_at <= strftime('%Y-%m-%dT%H:%M:%fZ','now') THEN amount_cents END), 0) AS available_cents,
              COALESCE(SUM(CASE WHEN available_at > strftime('%Y-%m-%dT%H:%M:%fZ','now') THEN amount_cents END), 0) AS held_cents
         FROM ledger_entries WHERE payout_id IS NULL AND party_type IN ('mercado','entregador') GROUP BY party_type`,
    ),
    db.prepare("SELECT party_type, COUNT(*) AS n, COALESCE(SUM(amount_cents), 0) AS cents FROM payouts WHERE status = 'pendente' GROUP BY party_type"),
    db.prepare("SELECT COALESCE(SUM(-amount_cents), 0) AS cents FROM ledger_entries WHERE kind = 'reembolso' AND created_at >= ?").bind(since),
  ]);
  const by = <T extends { party_type: string }>(rows: T[], t: string) => rows.find((r) => r.party_type === t);
  const plat = platform.results as { kind: string; cents: number }[];
  const tp = toPay.results as { party_type: string; parties: number; available_cents: number; held_cents: number }[];
  const pe = pending.results as { party_type: string; n: number; cents: number }[];
  return c.json({
    platform: {
      commission_cents: plat.find((r) => r.kind === 'comissao')?.cents ?? 0,
      delivery_cents: plat.find((r) => r.kind === 'taxa_plataforma')?.cents ?? 0,
      refunds_cents: -(plat.find((r) => r.kind === 'reembolso')?.cents ?? 0),
      net_cents: plat.reduce((a, r) => a + r.cents, 0),
    },
    markets: { ...(by(tp, 'mercado') ?? { parties: 0, available_cents: 0, held_cents: 0 }), pending_payouts_cents: by(pe, 'mercado')?.cents ?? 0 },
    couriers: { ...(by(tp, 'entregador') ?? { parties: 0, available_cents: 0, held_cents: 0 }), pending_payouts_cents: by(pe, 'entregador')?.cents ?? 0 },
    refunds_cents: (refunds.results[0] as { cents: number }).cents,
  });
});

panel.get('/repasses', async (c) => {
  const status = c.req.query('status');
  if (status && !['pendente', 'pago', 'cancelado'].includes(status)) throw badRequest('Filtro inválido.', 'validation');
  const { results } = await c.env.DB.prepare(
    `SELECT p.id, p.party_type, p.party_id, p.amount_cents, p.status, p.pix_key, p.reference, p.created_at, p.paid_at,
            CASE p.party_type WHEN 'mercado' THEN (SELECT name FROM markets WHERE id = p.party_id)
                              ELSE (SELECT u.name FROM couriers co JOIN users u ON u.id = co.user_id WHERE co.id = p.party_id) END AS party_name,
            (SELECT COUNT(*) FROM ledger_entries l WHERE l.payout_id = p.id) AS entries
       FROM payouts p ${status ? 'WHERE p.status = ?' : ''} ORDER BY p.status = 'pendente' DESC, p.created_at DESC LIMIT 200`,
  )
    .bind(...(status ? [status] : []))
    .all<{ pix_key: string | null }>();
  return c.json({ items: await Promise.all(results.map((r) => unsealRow(c.env, r, ['pix_key']))) });
});

/** Gera um repasse para cada mercado/entregador com saldo liberado positivo (saldo negativo fica para o próximo). */
panel.post('/repasses/gerar', async (c) => {
  const db = c.env.DB;
  const cut = new Date().toISOString();
  const user = c.get('user').id;
  const { results: parties } = await db
    .prepare(
      `SELECT party_type, party_id, SUM(amount_cents) AS cents FROM ledger_entries
        WHERE payout_id IS NULL AND party_type IN ('mercado','entregador') AND available_at <= ?1 AND created_at <= ?1
        GROUP BY party_type, party_id HAVING cents > 0`,
    )
    .bind(cut)
    .all<{ party_type: string; party_id: string; cents: number }>();
  let total = 0;
  for (const p of parties) {
    const id = newId();
    const pix = await db
      .prepare(p.party_type === 'mercado' ? 'SELECT pix_key AS k FROM markets WHERE id = ?' : 'SELECT pix_key AS k FROM couriers WHERE id = ?')
      .bind(p.party_id)
      .first<{ k: string | null }>();
    // Mesma transação: o valor do repasse é exatamente a soma dos lançamentos vinculados.
    await db.batch([
      db.prepare(
        `INSERT INTO payouts (id, party_type, party_id, amount_cents, pix_key, created_by)
         SELECT ?1, ?2, ?3, SUM(amount_cents), ?4, ?5 FROM ledger_entries
          WHERE payout_id IS NULL AND party_type = ?2 AND party_id = ?3 AND available_at <= ?6 AND created_at <= ?6 HAVING SUM(amount_cents) > 0`,
      ).bind(id, p.party_type, p.party_id, pix?.k ?? null, user, cut),
      db.prepare(
        `UPDATE ledger_entries SET payout_id = ?1 WHERE EXISTS (SELECT 1 FROM payouts WHERE id = ?1)
            AND payout_id IS NULL AND party_type = ?2 AND party_id = ?3 AND available_at <= ?4 AND created_at <= ?4`,
      ).bind(id, p.party_type, p.party_id, cut),
    ]);
    total += p.cents;
  }
  await audit(db, { userId: user, action: 'payout.generate', entity: 'payout', data: { count: parties.length, total_cents: total } });
  return c.json({ created: parties.length, total_cents: total });
});

/** Confirma que o repasse foi transferido (Pix), com a referência/comprovante. */
panel.post('/repasses/:id/pagar', async (c) => {
  const ref = str(await readJson(c.req.raw), 'referencia', { min: 3, max: 120 })!;
  const r = await c.env.DB.prepare(
    "UPDATE payouts SET status = 'pago', reference = ?, paid_by = ?, paid_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND status = 'pendente'",
  )
    .bind(ref, c.get('user').id, c.req.param('id'))
    .run();
  if (!r.meta.changes) throw conflict('Repasse não está pendente.', 'invalid_state');
  await audit(c.env.DB, { userId: c.get('user').id, action: 'payout.paid', entity: 'payout', entityId: c.req.param('id'), data: { ref } });
  const po = await c.env.DB.prepare('SELECT party_type, party_id, amount_cents FROM payouts WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ party_type: string; party_id: string; amount_cents: number }>();
  if (po) {
    const n = { kind: 'repasse', title: `Repasse de ${brl(po.amount_cents)} enviado`, body: `Pix enviado. Referência: ${ref}.` };
    if (po.party_type === 'mercado') await notifyMarketOwner(c.env, po.party_id, { ...n, link: '/mercado/financeiro' });
    else await notifyCourier(c.env, po.party_id, { ...n, link: '/entregador/ganhos' });
  }
  return c.json({ ok: true });
});

/** Cancela um repasse pendente: os lançamentos voltam para o saldo. */
panel.post('/repasses/:id/cancelar', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const p = await db.prepare('SELECT status FROM payouts WHERE id = ?').bind(id).first<{ status: string }>();
  if (!p) throw notFound('Repasse não encontrado.');
  if (p.status !== 'pendente') throw conflict('Só repasses pendentes podem ser cancelados.', 'invalid_state');
  await db.batch([
    db.prepare("UPDATE payouts SET status = 'cancelado' WHERE id = ?").bind(id),
    db.prepare('UPDATE ledger_entries SET payout_id = NULL WHERE payout_id = ?').bind(id),
  ]);
  await audit(db, { userId: c.get('user').id, action: 'payout.cancel', entity: 'payout', entityId: id });
  return c.json({ ok: true });
});

/** Extrato de um mercado, entregador ou da plataforma. */
panel.get('/extrato/:tipo/:id', async (c) => {
  const type = c.req.param('tipo');
  if (!['mercado', 'entregador', 'plataforma'].includes(type)) throw notFound();
  const id = type === 'plataforma' ? PLATFORM : c.req.param('id');
  return c.json({ balance: await balance(c.env.DB, type, id), entries: await statement(c.env.DB, type, id) });
});

// ── Configurações ─────────────────────────────────────────────────────────────
panel.get('/configuracoes', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT s.key, s.updated_at, u.name AS updated_by FROM settings s LEFT JOIN users u ON u.id = s.updated_by',
  ).all<{ key: string }>();
  return c.json({
    settings: await getSettings(c.env),
    limits: Object.fromEntries(Object.entries(RULES).map(([k, r]) => [k, { min: r.min, max: r.max, default: r.def }])),
    changed: results,
  });
});

panel.put('/configuracoes', async (c) => {
  const b = await readJson(c.req.raw);
  const changes: [keyof Settings, number][] = [];
  for (const [key, rule] of Object.entries(RULES) as [keyof Settings, (typeof RULES)[keyof Settings]][]) {
    if (b[key] === undefined) continue;
    const v = Number(b[key]);
    if (!Number.isInteger(v) || v < rule.min || v > rule.max) throw badRequest(`Valor inválido para ${key} (${rule.min}–${rule.max}).`, 'validation');
    changes.push([key, v]);
  }
  if (!changes.length) throw badRequest('Nada para alterar.', 'validation');
  const before = await getSettings(c.env);
  const user = c.get('user').id;
  await c.env.DB.batch(
    changes.map(([k, v]) =>
      c.env.DB.prepare(
        `INSERT INTO settings (key, value, updated_by) VALUES (?1, ?2, ?3)
         ON CONFLICT(key) DO UPDATE SET value = ?2, updated_by = ?3, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
      ).bind(k, String(v), user),
    ),
  );
  clearSettingsCache();
  await audit(c.env.DB, {
    userId: user,
    action: 'settings.update',
    entity: 'settings',
    data: Object.fromEntries(changes.map(([k, v]) => [k, { de: before[k], para: v }])),
  });
  return c.json({ settings: await getSettings(c.env) });
});

// ── Equipe administrativa e permissões ────────────────────────────────────────
const perms = (b: Record<string, unknown>) => {
  const list = Array.isArray(b.permissoes) ? (b.permissoes as unknown[]).filter((p): p is Area => AREAS.includes(p as Area)) : null;
  if (!list || !list.length) throw badRequest('Escolha ao menos uma área.', 'validation');
  return list.length === AREAS.length ? null : JSON.stringify([...new Set(list)]);
};

panel.get('/equipe', async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, name, email, status, admin_perms, created_at FROM users WHERE role = 'admin' ORDER BY created_at",
  ).all<{ admin_perms: string | null }>();
  return c.json({ items: results.map((u) => ({ ...u, admin_perms: undefined, permissoes: u.admin_perms ? JSON.parse(u.admin_perms) : [...AREAS] })) });
});

panel.post('/equipe', async (c) => {
  const b = await readJson(c.req.raw);
  const name = str(b, 'name', { min: 3, max: 80 })!;
  const mail = email(b);
  const pass = password(b);
  const p = perms(b);
  const exists = await c.env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(mail).first();
  if (exists) throw conflict('E-mail já cadastrado.', 'email_taken');
  const id = newId();
  await c.env.DB.prepare(
    `INSERT INTO users (id, name, email, password_hash, role, status, admin_perms, email_verified_at, accepted_terms_at)
     VALUES (?, ?, ?, ?, 'admin', 'ativo', ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
  )
    .bind(id, name, mail, await hashPassword(pass), p)
    .run();
  await audit(c.env.DB, { userId: c.get('user').id, action: 'admin.create', entity: 'user', entityId: id, data: { permissoes: p ?? 'todas' } });
  return c.json({ id }, 201);
});

panel.patch('/equipe/:id', async (c) => {
  const id = c.req.param('id');
  if (id === c.get('user').id) throw badRequest('Peça a outro administrador para alterar o seu acesso.', 'validation');
  const b = await readJson(c.req.raw);
  const sets: string[] = [];
  const args: unknown[] = [];
  if (b.permissoes !== undefined) {
    sets.push('admin_perms = ?');
    args.push(perms(b));
  }
  if (b.status !== undefined) {
    const st = oneOf(b, 'status', ['ativo', 'bloqueado'] as const);
    sets.push('status = ?', 'token_version = token_version + ?');
    args.push(st, st === 'bloqueado' ? 1 : 0);
  }
  if (!sets.length) throw badRequest('Nada para alterar.', 'validation');
  const r = await c.env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ? AND role = 'admin'`).bind(...args, id).run();
  if (!r.meta.changes) throw notFound('Administrador não encontrado.');
  // Sempre precisa sobrar alguém com acesso ao sistema.
  const left = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND status = 'ativo' AND (admin_perms IS NULL OR admin_perms LIKE '%sistema%')",
  ).first<{ n: number }>();
  if (!left?.n) throw conflict('Precisa existir ao menos um administrador ativo com acesso ao sistema.', 'last_admin');
  await audit(c.env.DB, { userId: c.get('user').id, action: 'admin.update', entity: 'user', entityId: id, data: b });
  return c.json({ ok: true });
});

// ── Logs e auditoria ──────────────────────────────────────────────────────────
panel.get('/auditoria', async (c) => {
  const where: string[] = [];
  const args: unknown[] = [];
  const action = q(c.req.query('acao'));
  if (action) {
    where.push("a.action LIKE ? ESCAPE '\\'");
    args.push(`${action.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
  }
  const entity = q(c.req.query('entidade'));
  if (entity) {
    where.push('a.entity = ?');
    args.push(entity);
  }
  const entityId = q(c.req.query('id'));
  if (entityId) {
    where.push('a.entity_id = ?');
    args.push(entityId);
  }
  const only = c.req.query('perfil');
  if (only) {
    where.push('u.role = ?');
    args.push(only);
  }
  const offset = Math.max(Number(c.req.query('offset')) || 0, 0);
  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.action, a.entity, a.entity_id, a.data, a.ip, a.created_at, u.name AS user_name, u.role AS user_role
       FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY a.created_at DESC LIMIT 101 OFFSET ?`,
  )
    .bind(...args, offset)
    .all<{ data: string | null }>();
  return c.json({
    items: results.slice(0, 100).map((r) => ({ ...r, data: r.data ? JSON.parse(r.data) : null })),
    next_offset: results.length > 100 ? offset + 100 : null,
  });
});

export default panel;
