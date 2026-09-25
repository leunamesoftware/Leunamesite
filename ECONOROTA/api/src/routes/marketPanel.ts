import { Hono, type Context } from 'hono';

import { audit, requireAuth } from '../lib/auth';
import { newId } from '../lib/crypto';
import { badRequest, conflict, notFound } from '../lib/errors';
import { fold } from '../lib/listParser';
import { COLD_CATEGORIES } from '../lib/dispatch';
import { balance, payoutsOf, statement } from '../lib/ledger';
import { brl, notifyCourier, notifyCustomer } from '../lib/notifications';
import { refundPartial } from '../lib/refunds';
import { getSettings } from '../lib/settings';
import { seal, unsealRow } from '../lib/fieldCrypto';
import type { AppEnv, Env } from '../lib/types';
import { oneOf, readJson, str } from '../lib/validate';

/**
 * Painel do supermercado (Fase 8). Toda consulta é filtrada pelo mercado do usuário logado:
 * um mercado nunca vê nem altera dados de outro.
 */
const panel = new Hono<AppEnv>();
panel.use('*', requireAuth('mercado'));

type Market = {
  id: string; name: string; is_open: number; opens_at: string; closes_at: string; image_url: string | null; rating: number; pix_key: string | null;
  status: string; document: string | null; phone: string | null; address: string | null; district: string | null; city: string | null;
  state: string | null; lat: number | null; lng: number | null; eta_min: number;
};

/** O que falta para o mercado ser aprovado e aparecer nas buscas. */
const missingStore = (m: Market) =>
  [!m.document && 'document', !m.address && 'address', (m.lat == null || m.lng == null) && 'location', !m.pix_key && 'pix_key'].filter(Boolean);

async function myMarket(c: Context<AppEnv>): Promise<Market> {
  const m = await c.env.DB.prepare(
    `SELECT id, name, is_open, opens_at, closes_at, image_url, rating, pix_key, status, document, phone, address, district, city, state, lat, lng, eta_min
       FROM markets WHERE owner_user_id = ? ORDER BY created_at LIMIT 1`,
  )
    .bind(c.get('user').id)
    .first<Market>();
  if (!m) throw notFound('Nenhum mercado vinculado a esta conta. Fale com o suporte do EconoRota.');
  return unsealRow(c.env, m, ['pix_key']);
}

const COLD_SQL = [...COLD_CATEGORIES].map((x) => `'${x}'`).join(',');
const commissionPct = async (env: Env) => (await getSettings(env)).commission_pct;
const compareKey = (name: string, unit: string) => `${fold(name)}|${fold(unit).replace(/\s+/g, '')}`;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function int(b: Record<string, unknown>, key: string, min: number, max: number, optional = false) {
  const v = b[key];
  if (v === undefined || v === null) {
    if (optional) return undefined;
    throw badRequest(`Campo obrigatório: ${key}.`, 'validation');
  }
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw badRequest(`Valor inválido: ${key}.`, 'validation');
  return v;
}

/** Loja: dados e abrir/fechar. */
panel.get('/loja', async (c) => {
  const m = await myMarket(c);
  return c.json({ market: { ...m, missing: missingStore(m) } });
});

panel.patch('/loja', async (c) => {
  const m = await myMarket(c);
  const b = await readJson(c.req.raw);
  const sets: string[] = [];
  const args: unknown[] = [];
  if (b.is_open !== undefined) {
    if (typeof b.is_open !== 'boolean') throw badRequest('Valor inválido: is_open.', 'validation');
    sets.push('is_open = ?');
    args.push(b.is_open ? 1 : 0);
  }
  for (const k of ['opens_at', 'closes_at'] as const) {
    if (b[k] === undefined) continue;
    if (typeof b[k] !== 'string' || !HHMM.test(b[k] as string)) throw badRequest('Horário inválido (use HH:MM).', 'validation');
    sets.push(`${k} = ?`);
    args.push(b[k]);
  }
  // Dados cadastrais e localização (endereço pelo CEP; coordenadas para a distância até os clientes).
  if (b.document !== undefined) {
    const doc = String(b.document ?? '').replace(/\D/g, '');
    if (doc.length !== 14) throw badRequest('CNPJ inválido (14 números).', 'validation');
    sets.push('document = ?');
    args.push(doc);
  }
  for (const [k, max] of [['phone', 20], ['address', 160], ['district', 80], ['city', 80]] as const) {
    if (b[k] === undefined) continue;
    sets.push(`${k} = ?`);
    args.push(str(b, k, { min: 2, max }));
  }
  if (b.state !== undefined) {
    sets.push('state = ?');
    args.push(str(b, 'state', { min: 2, max: 2 })!.toUpperCase());
  }
  if (b.lat !== undefined || b.lng !== undefined) {
    const lat = Number(b.lat);
    const lng = Number(b.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw badRequest('Localização inválida.', 'validation');
    sets.push('lat = ?', 'lng = ?');
    args.push(lat, lng);
  }
  if (b.eta_min !== undefined) {
    const n = Number(b.eta_min);
    if (!Number.isInteger(n) || n < 5 || n > 120) throw badRequest('Tempo de separação de 5 a 120 minutos.', 'validation');
    sets.push('eta_min = ?', 'eta_max = ?');
    args.push(n, n + 15);
  }
  if (b.pix_key !== undefined) {
    sets.push('pix_key = ?');
    args.push(await seal(c.env, str(b, 'pix_key', { min: 3, max: 120 })));
  }
  if (!sets.length) throw badRequest('Nada para alterar.', 'validation');
  await c.env.DB.prepare(`UPDATE markets SET ${sets.join(', ')} WHERE id = ?`).bind(...args, m.id).run();
  await audit(c.env.DB, { userId: c.get('user').id, action: 'market.update', entity: 'market', entityId: m.id, data: b });
  const fresh = await myMarket(c);
  return c.json({ market: { ...fresh, missing: missingStore(fresh) } });
});

/** Dashboard: números de hoje e pedidos recentes. */
panel.get('/resumo', async (c) => {
  const m = await myMarket(c);
  const db = c.env.DB;
  const today = "date(o.created_at, '-3 hours') = date('now', '-3 hours')";
  const k = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM order_markets om JOIN orders o ON o.id = om.order_id
           WHERE om.market_id = ?1 AND om.status NOT IN ('aguardando','cancelado') AND ${today}) AS orders_today,
         (SELECT COALESCE(SUM(om.subtotal_cents),0) FROM order_markets om JOIN orders o ON o.id = om.order_id
           WHERE om.market_id = ?1 AND om.status NOT IN ('aguardando','cancelado') AND ${today}) AS revenue_today,
         (SELECT COUNT(*) FROM order_markets WHERE market_id = ?1 AND status = 'novo') AS new_orders,
         (SELECT COUNT(*) FROM order_markets WHERE market_id = ?1 AND status IN ('em_separacao','conferido')) AS separating,
         (SELECT COUNT(*) FROM products WHERE market_id = ?1 AND is_active = 1 AND stock > 0 AND stock <= min_stock) AS low_stock,
         (SELECT COUNT(*) FROM products WHERE market_id = ?1 AND is_active = 1 AND stock = 0) AS unavailable,
         (SELECT COUNT(*) FROM products WHERE market_id = ?1 AND is_active = 1 AND expires_on IS NOT NULL
           AND expires_on <= date('now', '-3 hours', '+3 day')) AS expiring`,
    )
    .bind(m.id)
    .first();
  return c.json({ market: m, kpis: k });
});

/** Categorias com a quantidade de produtos do mercado. */
panel.get('/categorias', async (c) => {
  const m = await myMarket(c);
  const { results } = await c.env.DB.prepare(
    `SELECT ca.id, ca.name, ca.icon, ca.color,
            (SELECT COUNT(*) FROM products p WHERE p.category_id = ca.id AND p.market_id = ? AND p.is_active = 1) AS products
       FROM categories ca ORDER BY ca.sort, ca.name`,
  )
    .bind(m.id)
    .all();
  return c.json({ items: results });
});

const PRODUCT_COLS = `id, category_id, name, brand, unit, barcode, price_cents, promo_price_cents, stock, min_stock, is_active,
  image_url, description, expires_on, updated_at`;

/** Produtos do mercado com busca e filtros (estoque baixo, indisponível, vencendo, inativos). */
panel.get('/produtos', async (c) => {
  const m = await myMarket(c);
  const where = ['market_id = ?'];
  const args: unknown[] = [m.id];
  const q = c.req.query('q')?.trim().slice(0, 60);
  if (q) {
    where.push("(name LIKE ? ESCAPE '\\' OR brand LIKE ? ESCAPE '\\' OR barcode = ?)");
    const like = `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    args.push(like, like, q);
  }
  const cat = c.req.query('categoria');
  if (cat) {
    where.push('category_id = ?');
    args.push(cat);
  }
  const f = c.req.query('filtro');
  where.push(
    f === 'inativos'
      ? 'is_active = 0'
      : f === 'baixo'
        ? 'is_active = 1 AND stock > 0 AND stock <= min_stock'
        : f === 'indisponivel'
          ? 'is_active = 1 AND stock = 0'
          : f === 'vencendo'
            ? "is_active = 1 AND expires_on IS NOT NULL AND expires_on <= date('now', '-3 hours', '+3 day')"
            : 'is_active = 1',
  );
  const { results } = await c.env.DB.prepare(
    `SELECT ${PRODUCT_COLS} FROM products WHERE ${where.join(' AND ')} ORDER BY name COLLATE NOCASE LIMIT 500`,
  )
    .bind(...args)
    .all();
  return c.json({ items: results });
});

async function productInput(c: Context<AppEnv>, b: Record<string, unknown>, partial: boolean) {
  const out: Record<string, unknown> = {};
  const opt = partial;
  const name = str(b, 'name', { min: 2, max: 80, optional: opt });
  if (name !== undefined) out.name = name;
  const unit = str(b, 'unit', { min: 1, max: 20, optional: opt });
  if (unit !== undefined) out.unit = unit;
  if (b.brand !== undefined) out.brand = str(b, 'brand', { max: 40, optional: true }) ?? null;
  if (b.description !== undefined) out.description = str(b, 'description', { max: 500, optional: true }) ?? null;
  if (b.barcode !== undefined) {
    const bc = str(b, 'barcode', { max: 14, optional: true }) ?? null;
    if (bc && !/^\d{8,14}$/.test(bc)) throw badRequest('Código de barras inválido (8 a 14 números).', 'validation');
    out.barcode = bc;
  }
  if (b.image_url !== undefined) {
    const u = str(b, 'image_url', { max: 500, optional: true }) ?? null;
    if (u && !/^https:\/\//.test(u)) throw badRequest('A imagem precisa de um endereço https.', 'validation');
    out.image_url = u;
  }
  if (b.expires_on !== undefined) {
    const d = b.expires_on === null || b.expires_on === '' ? null : str(b, 'expires_on', { max: 10 });
    if (d && !DATE.test(d)) throw badRequest('Validade inválida (use AAAA-MM-DD).', 'validation');
    out.expires_on = d;
  }
  const cat = str(b, 'category_id', { max: 40, optional: opt });
  if (cat !== undefined) {
    const ok = await c.env.DB.prepare('SELECT 1 FROM categories WHERE id = ?').bind(cat).first();
    if (!ok) throw badRequest('Categoria inválida.', 'validation');
    out.category_id = cat;
  }
  const price = int(b, 'price_cents', 1, 10_000_000, opt);
  if (price !== undefined) out.price_cents = price;
  if (b.promo_price_cents !== undefined) out.promo_price_cents = b.promo_price_cents === null ? null : int(b, 'promo_price_cents', 1, 10_000_000);
  const min = int(b, 'min_stock', 0, 100_000, true);
  if (min !== undefined) out.min_stock = min;
  if (b.is_active !== undefined) {
    if (typeof b.is_active !== 'boolean') throw badRequest('Valor inválido: is_active.', 'validation');
    out.is_active = b.is_active ? 1 : 0;
  }
  return out;
}

panel.post('/produtos', async (c) => {
  const m = await myMarket(c);
  const b = await readJson(c.req.raw);
  const p = await productInput(c, b, false);
  const stock = int(b, 'stock', 0, 100_000, true) ?? 0;
  if (p.promo_price_cents != null && (p.promo_price_cents as number) >= (p.price_cents as number)) {
    throw badRequest('O preço promocional precisa ser menor que o preço normal.', 'validation');
  }
  const id = newId();
  const db = c.env.DB;
  await db.batch([
    db
      .prepare(
        `INSERT INTO products (id, market_id, category_id, name, brand, unit, barcode, price_cents, promo_price_cents, stock, min_stock,
                               image_url, description, expires_on, compare_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id, m.id, p.category_id, p.name, p.brand ?? null, p.unit, p.barcode ?? null, p.price_cents, p.promo_price_cents ?? null, stock,
        p.min_stock ?? 0, p.image_url ?? null, p.description ?? null, p.expires_on ?? null, compareKey(p.name as string, p.unit as string),
      ),
    ...(stock > 0
      ? [
          db
            .prepare(
              `INSERT INTO stock_movements (id, market_id, product_id, type, quantity, stock_after, reason, user_id)
               VALUES (?, ?, ?, 'entrada', ?, ?, 'Cadastro do produto', ?)`,
            )
            .bind(newId(), m.id, id, stock, stock, c.get('user').id),
        ]
      : []),
  ]);
  await audit(db, { userId: c.get('user').id, action: 'product.create', entity: 'product', entityId: id });
  const row = await db.prepare(`SELECT ${PRODUCT_COLS} FROM products WHERE id = ?`).bind(id).first();
  return c.json({ product: row }, 201);
});

panel.patch('/produtos/:id', async (c) => {
  const m = await myMarket(c);
  const db = c.env.DB;
  const cur = await db
    .prepare('SELECT name, unit, price_cents, promo_price_cents FROM products WHERE id = ? AND market_id = ?')
    .bind(c.req.param('id'), m.id)
    .first<{ name: string; unit: string; price_cents: number; promo_price_cents: number | null }>();
  if (!cur) throw notFound('Produto não encontrado.');
  const p = await productInput(c, await readJson(c.req.raw), true);
  if (!Object.keys(p).length) throw badRequest('Nada para alterar.', 'validation');
  const price = (p.price_cents as number | undefined) ?? cur.price_cents;
  const promo = p.promo_price_cents === undefined ? cur.promo_price_cents : (p.promo_price_cents as number | null);
  if (promo != null && promo >= price) throw badRequest('O preço promocional precisa ser menor que o preço normal.', 'validation');
  if (p.name !== undefined || p.unit !== undefined) p.compare_key = compareKey((p.name as string) ?? cur.name, (p.unit as string) ?? cur.unit);
  const keys = Object.keys(p);
  await db
    .prepare(`UPDATE products SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND market_id = ?`)
    .bind(...keys.map((k) => p[k]), c.req.param('id'), m.id)
    .run();
  await audit(db, { userId: c.get('user').id, action: 'product.update', entity: 'product', entityId: c.req.param('id'), data: p });
  return c.json({ product: await db.prepare(`SELECT ${PRODUCT_COLS} FROM products WHERE id = ?`).bind(c.req.param('id')).first() });
});

/** Entrada, saída ou ajuste de estoque (a saída nunca deixa o estoque negativo). */
panel.post('/produtos/:id/estoque', async (c) => {
  const m = await myMarket(c);
  const db = c.env.DB;
  const b = await readJson(c.req.raw);
  const type = oneOf(b, 'tipo', ['entrada', 'saida', 'ajuste'] as const);
  const qty = int(b, 'quantidade', type === 'ajuste' ? 0 : 1, 100_000)!;
  const reason = str(b, 'motivo', { max: 120, optional: true }) ?? null;
  const cur = await db
    .prepare('SELECT stock FROM products WHERE id = ? AND market_id = ?')
    .bind(c.req.param('id'), m.id)
    .first<{ stock: number }>();
  if (!cur) throw notFound('Produto não encontrado.');
  const next = type === 'entrada' ? cur.stock + qty : type === 'saida' ? cur.stock - qty : qty;
  if (next < 0) throw badRequest(`Saída maior que o estoque atual (${cur.stock}).`, 'validation');
  const delta = next - cur.stock;
  // A condição "stock = ?" evita sobrescrever uma venda que aconteceu no mesmo instante.
  const res = await db.batch([
    db.prepare("UPDATE products SET stock = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND stock = ?").bind(next, c.req.param('id'), cur.stock),
    db
      .prepare(
        `INSERT INTO stock_movements (id, market_id, product_id, type, quantity, stock_after, reason, user_id)
         SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE changes() > 0`,
      )
      .bind(newId(), m.id, c.req.param('id'), type, delta, next, reason, c.get('user').id),
  ]);
  if (!res[0].meta.changes) throw conflict('O estoque mudou agora há pouco (venda). Tente de novo.', 'stock_changed');
  return c.json({ stock: next });
});

panel.get('/estoque/movimentos', async (c) => {
  const m = await myMarket(c);
  const pid = c.req.query('produto');
  const { results } = await c.env.DB.prepare(
    `SELECT sm.id, sm.product_id, p.name AS product_name, p.unit, sm.type, sm.quantity, sm.stock_after, sm.reason, sm.order_id, sm.created_at
       FROM stock_movements sm JOIN products p ON p.id = sm.product_id
      WHERE sm.market_id = ? ${pid ? 'AND sm.product_id = ?' : ''}
      ORDER BY sm.created_at DESC LIMIT 100`,
  )
    .bind(...(pid ? [m.id, pid] : [m.id]))
    .all();
  return c.json({ items: results });
});

const GROUPS: Record<string, string> = {
  novos: "om.status = 'novo'",
  separacao: "om.status IN ('em_separacao','conferido')",
  prontos: "om.status = 'pronto'",
  historico: "om.status IN ('pronto','retirado','entregue','cancelado')",
};

/** Pedidos recebidos (só depois do pagamento aprovado). */
panel.get('/pedidos', async (c) => {
  const m = await myMarket(c);
  const g = c.req.query('grupo') ?? 'novos';
  if (!GROUPS[g]) throw badRequest('Filtro inválido.', 'validation');
  const { results } = await c.env.DB.prepare(
    `SELECT om.id, om.order_id, om.status, om.subtotal_cents, om.sequence, om.accepted_at, om.ready_at, o.created_at,
            (SELECT COUNT(*) FROM order_markets x WHERE x.order_id = om.order_id) AS market_count,
            (SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_market_id = om.id) AS item_count
       FROM order_markets om JOIN orders o ON o.id = om.order_id
      WHERE om.market_id = ? AND ${GROUPS[g]}
      ORDER BY o.created_at ${g === 'historico' ? 'DESC' : 'ASC'} LIMIT 100`,
  )
    .bind(m.id)
    .all();
  return c.json({ items: results });
});

async function myOrder(c: Context<AppEnv>, marketId: string) {
  const om = await c.env.DB.prepare(
    `SELECT om.id, om.order_id, om.status, om.subtotal_cents, om.sequence, om.accepted_at, om.ready_at, o.created_at,
            (SELECT COUNT(*) FROM order_markets x WHERE x.order_id = om.order_id) AS market_count
       FROM order_markets om JOIN orders o ON o.id = om.order_id WHERE om.id = ? AND om.market_id = ?`,
  )
    .bind(c.req.param('id'), marketId)
    .first<{ id: string; order_id: string; status: string }>();
  if (!om || om.status === 'aguardando') throw notFound('Pedido não encontrado.');
  return om;
}

panel.get('/pedidos/:id', async (c) => {
  const m = await myMarket(c);
  const om = await myOrder(c, m.id);
  const { results: items } = await c.env.DB.prepare(
    // Refrigerados por último na separação (ficam menos tempo fora da geladeira).
    `SELECT oi.id, oi.product_id, oi.product_name AS name, oi.unit_price_cents, oi.quantity, oi.image_url, oi.checked, p.barcode,
            CASE WHEN p.category_id IN (${COLD_SQL}) THEN 1 ELSE 0 END AS cold
       FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_market_id = ? ORDER BY cold, oi.product_name`,
  )
    .bind(om.id)
    .all();
  return c.json({ order: { ...om, items } });
});

/** Recebimento → separação. */
panel.post('/pedidos/:id/aceitar', async (c) => {
  const m = await myMarket(c);
  const om = await myOrder(c, m.id);
  if (om.status !== 'novo') throw conflict('Este pedido já foi aceito.', 'invalid_state');
  const db = c.env.DB;
  await db.batch([
    db.prepare("UPDATE order_markets SET status = 'em_separacao', accepted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").bind(om.id),
    db.prepare("UPDATE orders SET status = 'em_separacao', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND status = 'pago'").bind(om.order_id),
  ]);
  await audit(db, { userId: c.get('user').id, action: 'market_order.accept', entity: 'order', entityId: om.order_id });
  await notifyCustomer(c.env, om.order_id, { kind: 'separacao', title: 'Separando seu pedido', body: `${m.name} começou a separar os seus produtos.` });
  return c.json({ status: 'em_separacao' });
});

/** Conferência item a item (ok ou em falta). */
panel.post('/pedidos/:id/conferencia', async (c) => {
  const m = await myMarket(c);
  const om = await myOrder(c, m.id);
  if (om.status !== 'em_separacao' && om.status !== 'conferido') throw conflict('Aceite o pedido antes de conferir.', 'invalid_state');
  const b = await readJson(c.req.raw);
  const list = Array.isArray(b.itens) ? (b.itens as { id?: unknown; ok?: unknown }[]) : [];
  const db = c.env.DB;
  const { results: items } = await db.prepare('SELECT id FROM order_items WHERE order_market_id = ?').bind(om.id).all<{ id: string }>();
  const byId = new Map(list.map((i) => [i.id, i.ok]));
  if (items.some((i) => typeof byId.get(i.id) !== 'boolean')) throw badRequest('Confira todos os itens do pedido.', 'validation');
  await db.batch([
    ...items.map((i) => db.prepare('UPDATE order_items SET checked = ? WHERE id = ?').bind(byId.get(i.id) ? 1 : 0, i.id)),
    db.prepare("UPDATE order_markets SET status = 'conferido' WHERE id = ?").bind(om.id),
  ]);
  const missing = items.filter((i) => !byId.get(i.id)).length;
  await audit(db, { userId: c.get('user').id, action: 'market_order.check', entity: 'order', entityId: om.order_id, data: { missing } });
  // Itens em falta: ocorrência automática (Fase 11) e reembolso na hora do valor desses itens.
  let refunded = 0;
  if (missing && om.status === 'em_separacao') {
    const { results: miss } = await db
      .prepare('SELECT id, quantity, unit_price_cents FROM order_items WHERE order_market_id = ? AND checked = 0')
      .bind(om.id)
      .all<{ id: string; quantity: number; unit_price_cents: number }>();
    const cents = miss.reduce((s, i) => s + i.quantity * i.unit_price_cents, 0);
    const o = await db.prepare('SELECT customer_user_id FROM orders WHERE id = ?').bind(om.order_id).first<{ customer_user_id: string }>();
    const occ = newId();
    refunded = await refundPartial(c.env, om.order_id, cents, `falta:${om.id}`, c.get('user').id);
    await db.batch([
      db
        .prepare(
          `INSERT INTO occurrences (id, order_id, customer_user_id, market_id, type, description, status, resolution, requested_cents, refund_cents, auto, resolved_at)
           VALUES (?, ?, ?, ?, 'produto_indisponivel', 'Itens em falta na separação do mercado.', 'resolvida', 'reembolso_parcial', ?, ?, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
        )
        .bind(occ, om.order_id, o!.customer_user_id, m.id, cents, refunded),
      ...miss.map((i) => db.prepare('INSERT INTO occurrence_items (occurrence_id, order_item_id, quantity) VALUES (?, ?, ?)').bind(occ, i.id, i.quantity)),
      db
        .prepare("INSERT INTO occurrence_events (id, occurrence_id, author_role, author_id, kind, message) VALUES (?, ?, 'sistema', NULL, 'reembolso_parcial', ?)")
        .bind(newId(), occ, `Reembolso automático de ${(refunded / 100).toFixed(2).replace('.', ',')} pelos itens em falta.`),
    ]);
  }
  if (refunded > 0) {
    await notifyCustomer(c.env, om.order_id, {
      kind: 'reembolso',
      title: 'Item em falta reembolsado',
      body: `${m.name} não tinha ${missing === 1 ? 'um item' : `${missing} itens`} do seu pedido. Devolvemos ${brl(refunded)} na hora.`,
      email: true,
    });
  }
  return c.json({ status: 'conferido', missing, refunded_cents: refunded });
});

/** Pedido pronto para o entregador retirar. */
panel.post('/pedidos/:id/pronto', async (c) => {
  const m = await myMarket(c);
  const om = await myOrder(c, m.id);
  if (om.status !== 'conferido') throw conflict('Confira os itens antes de marcar como pronto.', 'invalid_state');
  const db = c.env.DB;
  await db.batch([
    db.prepare("UPDATE order_markets SET status = 'pronto', ready_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").bind(om.id),
    // Quando todos os mercados do pedido terminam, o pedido fica pronto para coleta.
    db
      .prepare(
        `UPDATE orders SET status = 'pronto_coleta', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
          WHERE id = ? AND NOT EXISTS (SELECT 1 FROM order_markets WHERE order_id = ? AND status NOT IN ('pronto','cancelado'))`,
      )
      .bind(om.order_id, om.order_id),
  ]);
  await audit(db, { userId: c.get('user').id, action: 'market_order.ready', entity: 'order', entityId: om.order_id });
  const courier = await db.prepare('SELECT courier_id FROM orders WHERE id = ?').bind(om.order_id).first<{ courier_id: string | null }>();
  await notifyCourier(c.env, courier?.courier_id, {
    kind: 'pronto_retirada',
    title: 'Pedido pronto para retirada',
    body: `${m.name} terminou a separação. Pode retirar.`,
    link: '/entregador/entrega',
  });
  return c.json({ status: 'pronto' });
});

/** Financeiro: vendas, comissão do EconoRota (configurável) e valor a receber. */
panel.get('/financeiro', async (c) => {
  const m = await myMarket(c);
  const days = c.req.query('dias') === '30' ? 30 : 7;
  const pct = await commissionPct(c.env);
  const { results } = await c.env.DB.prepare(
    `SELECT date(o.created_at, '-3 hours') AS day, COUNT(*) AS orders, SUM(om.subtotal_cents) AS gross_cents
       FROM order_markets om JOIN orders o ON o.id = om.order_id
      WHERE om.market_id = ? AND om.status NOT IN ('aguardando','cancelado')
        AND o.created_at >= datetime('now', ?)
      GROUP BY day ORDER BY day DESC`,
  )
    .bind(m.id, `-${days} days`)
    .all<{ day: string; orders: number; gross_cents: number }>();
  const gross = results.reduce((s, r) => s + r.gross_cents, 0);
  const commission = Math.round((gross * pct) / 100);
  return c.json({
    days,
    commission_pct: pct,
    orders: results.reduce((s, r) => s + r.orders, 0),
    gross_cents: gross,
    commission_cents: commission,
    net_cents: gross - commission,
    by_day: results.map((r) => ({ ...r, net_cents: r.gross_cents - Math.round((r.gross_cents * pct) / 100) })),
  });
});

/** Extrato financeiro: saldo disponível para repasse, a liberar (prazo de reclamação), lançamentos e repasses. */
panel.get('/extrato', async (c) => {
  const m = await myMarket(c);
  const db = c.env.DB;
  return c.json({
    balance: await balance(db, 'mercado', m.id),
    hold_days: (await getSettings(c.env)).market_hold_days,
    entries: await statement(db, 'mercado', m.id),
    payouts: await payoutsOf(db, 'mercado', m.id),
  });
});

/** Ocorrências ligadas ao mercado (para acompanhar e melhorar a separação). */
panel.get('/ocorrencias', async (c) => {
  const m = await myMarket(c);
  const { results } = await c.env.DB.prepare(
    `SELECT id, order_id, type, status, resolution, requested_cents, refund_cents, created_at, auto
       FROM occurrences WHERE market_id = ? ORDER BY created_at DESC LIMIT 100`,
  )
    .bind(m.id)
    .all();
  return c.json({ items: results });
});

export default panel;
