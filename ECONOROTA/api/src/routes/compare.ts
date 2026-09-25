import { Hono } from 'hono';

import { badRequest } from '../lib/errors';
import { distanceKm, isOpenNow, clock } from '../lib/geo';
import { COLD_CATEGORIES } from '../lib/dispatch';
import {
  averageItemsCents, bestRoute, combinedFee, forecastMinutes, MAX_MARKETS, MIN_ITEMS_PER_MARKET, optimize, type MarketIn, type Plan, type Want,
} from '../lib/optimizer';
import { getSettings } from '../lib/settings';
import type { AppEnv } from '../lib/types';
import { readJson } from '../lib/validate';

const RADIUS_KM = 15;
const MAX_ITEMS = 60;
const MAX_MARKETS_CONSIDERED = 12;
// "nome|unidade" (qualquer marca) ou "nome|unidade#marca" (só aquela marca — nunca substituída).
const KEY = /^[^|#]{1,120}\|[^|#]{1,30}(#[^|#]{1,40})?$/;
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

const compare = new Hono<AppEnv>();

/** Catálogo por produto (sem mercado): menor preço e em quantos mercados existe. */
compare.get('/catalog/items', async (c) => {
  const q = c.req.query('q')?.trim().slice(0, 80);
  const category = c.req.query('category_id');
  const where = ['p.is_active = 1', "m.status = 'ativo'", 'p.stock > 0'];
  const args: unknown[] = [];
  if (q) {
    where.push("p.name LIKE ? ESCAPE '\\'");
    args.push(`%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`);
  }
  if (category) {
    where.push('p.category_id = ?');
    args.push(category);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT p.compare_key AS key, MIN(p.name) AS name, MIN(p.unit) AS unit, MIN(p.category_id) AS category_id,
            MAX(p.image_url) AS image_url, MIN(COALESCE(p.promo_price_cents, p.price_cents)) AS min_price_cents,
            COUNT(DISTINCT p.market_id) AS markets
       FROM products p JOIN markets m ON m.id = p.market_id
      WHERE ${where.join(' AND ')} AND p.compare_key IS NOT NULL
      GROUP BY p.compare_key ORDER BY markets DESC, name LIMIT 100`,
  )
    .bind(...args)
    .all();
  return c.json({ items: results });
});

type CompareInput = { items?: unknown; lat?: unknown; lng?: unknown; market_ids?: unknown };

/**
 * Núcleo da comparação (usado por /compare e pela criação do pedido, que sempre recalcula no servidor):
 * valida a lista, busca mercados abertos próximos e as ofertas, e roda o otimizador.
 */
export async function computeCompare(env: AppEnv['Bindings'], body: CompareInput) {
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const hasHere = Number.isFinite(lat) && Number.isFinite(lng) && body.lat !== undefined && body.lng !== undefined;
  if (!Array.isArray(body.items) || !body.items.length) throw badRequest('Adicione produtos à lista para comparar.', 'validation');
  if (body.items.length > MAX_ITEMS) throw badRequest(`Limite de ${MAX_ITEMS} produtos por comparação.`, 'validation');

  const wants = new Map<string, number>();
  for (const it of body.items as { key?: unknown; qty?: unknown }[]) {
    const key = typeof it?.key === 'string' ? fold(it.key) : '';
    const qty = Number(it?.qty);
    if (!KEY.test(key) || !Number.isInteger(qty) || qty < 1 || qty > 99) throw badRequest('Item inválido na lista.', 'validation');
    wants.set(key, (wants.get(key) ?? 0) + qty);
  }
  // Mercados escolhidos pelo cliente (opcional, até MAX_MARKETS).
  const chosen = Array.isArray(body.market_ids) ? (body.market_ids as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  if (chosen.length > MAX_MARKETS) throw badRequest(`Escolha no máximo ${MAX_MARKETS} mercados.`, 'validation');

  const wantList: Want[] = [...wants].map(([key, qty]) => ({ key, qty }));
  const keys = [...new Set(wantList.map((w) => w.key.split('#')[0]))];
  const wanted = new Set(wantList.map((w) => w.key));

  const { results: mRows } = await env.DB.prepare(
    `SELECT id, name, address, image_url, lat, lng, delivery_fee_cents, min_order_cents, eta_min, eta_max, is_open, opens_at, closes_at, rating
       FROM markets WHERE status = 'ativo'`,
  ).all<{
    id: string; name: string; address: string | null; image_url: string | null; lat: number | null; lng: number | null; delivery_fee_cents: number;
    min_order_cents: number; eta_min: number; eta_max: number; is_open: number; opens_at: string; closes_at: string; rating: number;
  }>();
  const now = clock(env);
  const nearby = mRows
    .map((m) => ({
      ...m,
      open: isOpenNow(m.opens_at, m.closes_at, m.is_open, now),
      distance: hasHere && m.lat != null && m.lng != null ? Math.round(distanceKm(lat, lng, m.lat, m.lng) * 10) / 10 : null,
    }))
    .filter((m) => m.open && (!hasHere || (m.distance !== null && m.distance <= RADIUS_KM)))
    .filter((m) => !chosen.length || chosen.includes(m.id))
    .sort((a, b) => (a.distance ?? 99) - (b.distance ?? 99))
    .slice(0, MAX_MARKETS_CONSIDERED);

  const inputs: MarketIn[] = nearby.map((m) => ({
    id: m.id,
    name: m.name,
    deliveryFeeCents: m.delivery_fee_cents,
    minOrderCents: m.min_order_cents,
    etaMax: m.eta_max,
    distanceKm: m.distance,
    offers: new Map(),
  }));
  const info = new Map<string, { name: string; unit: string; image_url: string | null }>();
  if (nearby.length) {
    const marks = keys.map(() => '?').join(',');
    const mMarks = nearby.map(() => '?').join(',');
    const { results: pRows } = await env.DB.prepare(
      `SELECT id, market_id, compare_key, name, brand, unit, image_url, category_id, COALESCE(promo_price_cents, price_cents) AS price, stock
         FROM products WHERE is_active = 1 AND compare_key IN (${marks}) AND market_id IN (${mMarks})`,
    )
      .bind(...keys, ...nearby.map((m) => m.id))
      .all<{ id: string; market_id: string; compare_key: string; name: string; brand: string | null; unit: string; image_url: string | null; category_id: string; price: number; stock: number }>();
    const byId = new Map(inputs.map((m) => [m.id, m]));
    for (const p of pRows) {
      const m = byId.get(p.market_id)!;
      // A oferta vale para o item genérico e para o item "da marca".
      const brandKey = p.brand ? `${p.compare_key}#${fold(p.brand)}` : null;
      for (const k of [p.compare_key, brandKey]) {
        if (!k || !wanted.has(k)) continue;
        const cur = m.offers.get(k);
        if (!cur || p.price < cur.priceCents) {
          m.offers.set(k, { productId: p.id, priceCents: p.price, stock: p.stock, unit: p.unit, cold: COLD_CATEGORIES.has(p.category_id) });
        }
        const name = k === brandKey ? `${p.name} ${p.brand}` : p.name;
        if (!info.has(k) || (!info.get(k)!.image_url && p.image_url)) info.set(k, { name, unit: p.unit, image_url: p.image_url });
      }
    }
  }

  const settings = await getSettings(env);
  const result = optimize(inputs, wantList, combinedFee(settings.delivery_base_cents, settings.delivery_extra_market_cents));
  const coords = new Map(nearby.map((m) => [m.id, m]));
  const byId = new Map(inputs.map((m) => [m.id, m]));
  const route = (p: Plan) => {
    const pts = p.marketIds.map((id) => coords.get(id)!).filter((m) => m.lat != null && m.lng != null);
    if (!hasHere || pts.length !== p.marketIds.length) return null;
    const cold = new Set(p.lines.filter((l) => byId.get(l.marketId)?.offers.get(l.key)?.cold).map((l) => l.marketId));
    return bestRoute(pts.map((m) => ({ id: m.id, lat: m.lat!, lng: m.lng! })), { lat, lng }, (a, b) => distanceKm(a.lat, a.lng, b.lat, b.lng), cold);
  };
  // Previsão: separação do mercado mais lento + rota + fila de entregadores.
  if (hasHere && result.byCount.length) {
    const load = await env.DB.prepare(
      `SELECT (SELECT COUNT(*) FROM orders WHERE status IN ('pago','em_separacao','pronto_coleta','em_rota')) AS active,
              (SELECT COUNT(*) FROM couriers WHERE status = 'aprovado' AND is_online = 1) AS online`,
    ).first<{ active: number; online: number }>();
    for (const p of result.byCount) {
      const r = route(p);
      const prep = Math.max(...p.marketIds.map((id) => coords.get(id)!.eta_min));
      if (r) p.etaMax = forecastMinutes(prep, r.minutes, { activeOrders: load?.active ?? 0, onlineCouriers: load?.online ?? 0 });
    }
  }
  return { nearby, inputs, info, wantList, result, route, averageItemsCents: averageItemsCents(inputs, wantList) };
}

/** Compara a lista do cliente entre os mercados próximos e devolve a tabela de preços e os melhores planos. */
compare.post('/compare', async (c) => {
  const body = await readJson(c.req.raw);
  const st = await getSettings(c.env);
  const rules = {
    max_markets: MAX_MARKETS,
    min_items: MIN_ITEMS_PER_MARKET,
    min_order_cents: st.min_order_cents,
    delivery_base_cents: st.delivery_base_cents,
    delivery_extra_market_cents: st.delivery_extra_market_cents,
  };
  const { nearby, inputs, info, wantList, result, route, averageItemsCents: avg } = await computeCompare(c.env, body);
  if (!nearby.length) return c.json({ markets: [], rows: [], plans: [], rules });

  const plan = (p: Plan | null, label: string) =>
    p && {
      route: route(p),
      label,
      market_ids: p.marketIds,
      lines: p.lines.map((l) => ({ key: l.key, qty: l.qty, market_id: l.marketId, product_id: l.productId, unit_cents: l.unitCents, total_cents: l.totalCents })),
      missing: p.missing,
      items_cents: p.itemsCents,
      delivery_cents: p.deliveryCents,
      total_cents: p.totalCents,
      eta_max: p.etaMax,
    };
  const plans = [plan(result.cheapest, 'cheapest'), result.single && result.single !== result.cheapest ? plan(result.single, 'single') : null].filter(Boolean);

  return c.json({
    rules,
    markets: nearby.map((m) => ({
      id: m.id, name: m.name, image_url: m.image_url, distance_km: m.distance, address: m.address, delivery_fee_cents: m.delivery_fee_cents,
      min_order_cents: m.min_order_cents, eta_min: m.eta_min, eta_max: m.eta_max, rating: m.rating,
    })),
    rows: wantList.map((w) => ({
      key: w.key,
      qty: w.qty,
      ...(info.get(w.key) ?? { name: w.key.split('|')[0], unit: w.key.split('|')[1].split('#')[0], image_url: null }),
      brand: w.key.split('#')[1] ?? null,
      prices: Object.fromEntries(
        inputs.filter((m) => m.offers.has(w.key)).map((m) => [m.id, { cents: m.offers.get(w.key)!.priceCents, stock: m.offers.get(w.key)!.stock }]),
      ),
    })),
    average_items_cents: avg,
    plans,
  });
});

export default compare;
