import { Hono } from 'hono';

import { badRequest, notFound } from '../lib/errors';
import { distanceKm, isOpenNow, clock } from '../lib/geo';
import { getSettings } from '../lib/settings';
import type { AppEnv } from '../lib/types';

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Chave para comparar o mesmo produto entre mercados: sem acento, minúsculas, unidade sem espaço. Usar ao cadastrar produtos (Fase 8). */
export const compareKey = (name: string, unit: string) => `${fold(name)}|${fold(unit).replace(/\s+/g, '')}`;

type MarketRow = {
  id: string; name: string; address: string | null; district: string | null; city: string | null; lat: number | null; lng: number | null;
  rating: number; rating_count: number; is_open: number; image_url: string | null; delivery_fee_cents: number; min_order_cents: number;
  eta_min: number; eta_max: number; opens_at: string; closes_at: string;
};

const MARKET_COLUMNS = `id, name, address, district, city, lat, lng, rating, rating_count, is_open, image_url, delivery_fee_cents,
  min_order_cents, eta_min, eta_max, opens_at, closes_at`;

/** "Ana Souza" → "Ana S." (avaliações públicas não expõem o nome completo). */
const shortName = (full: string) => {
  const [first, ...rest] = full.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
};

const store = new Hono<AppEnv>();

/** Detalhes da loja + categorias que ela vende (com quantidade de produtos). */
store.get('/markets/:id', async (c) => {
  const id = c.req.param('id');
  const m = await c.env.DB.prepare(`SELECT ${MARKET_COLUMNS} FROM markets WHERE id = ? AND status = 'ativo'`).bind(id).first<MarketRow>();
  if (!m) throw notFound('Mercado não encontrado.');

  const lat = Number(c.req.query('lat'));
  const lng = Number(c.req.query('lng'));
  const hasHere = Number.isFinite(lat) && Number.isFinite(lng) && c.req.query('lat') !== undefined;

  const { results: categories } = await c.env.DB.prepare(
    `SELECT cat.id, cat.name, cat.icon, cat.color, COUNT(p.id) AS count,
            SUM(CASE WHEN p.promo_price_cents IS NOT NULL AND p.promo_price_cents < p.price_cents THEN 1 ELSE 0 END) AS on_sale
       FROM products p JOIN categories cat ON cat.id = p.category_id
      WHERE p.market_id = ? AND p.is_active = 1
      GROUP BY cat.id ORDER BY cat.sort`,
  )
    .bind(id)
    .all();

  return c.json({
    market: {
      ...m,
      delivery_fee_cents: (await getSettings(c.env)).delivery_base_cents,
      is_open: isOpenNow(m.opens_at, m.closes_at, m.is_open, clock(c.env)),
      distance_km: hasHere && m.lat != null && m.lng != null ? Math.round(distanceKm(lat, lng, m.lat, m.lng) * 10) / 10 : null,
    },
    categories,
  });
});

/** Avaliações: resumo (média e distribuição) + lista paginada. */
store.get('/markets/:id/reviews', async (c) => {
  const id = c.req.param('id');
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 10, 1), 30);
  const offset = Math.max(Number(c.req.query('offset')) || 0, 0);
  const stars = Number(c.req.query('stars'));
  const byStars = Number.isInteger(stars) && stars >= 1 && stars <= 5;

  const [dist, list] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT rating, COUNT(*) AS n FROM market_reviews WHERE market_id = ? AND hidden = 0 GROUP BY rating').bind(id),
    c.env.DB.prepare(
      `SELECT r.id, r.rating, r.comment, r.created_at, u.name FROM market_reviews r JOIN users u ON u.id = r.user_id
        WHERE r.market_id = ? AND r.hidden = 0 ${byStars ? 'AND r.rating = ?' : ''} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
    ).bind(...(byStars ? [id, stars] : [id]), limit + 1, offset),
  ]);
  const byStar: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  let total = 0;
  let sum = 0;
  for (const r of dist.results as { rating: number; n: number }[]) {
    byStar[r.rating] = r.n;
    total += r.n;
    sum += r.rating * r.n;
  }
  const rows = list.results as { id: string; rating: number; comment: string | null; created_at: string; name: string }[];
  return c.json({
    summary: { average: total ? Math.round((sum / total) * 10) / 10 : null, count: total, by_star: byStar },
    items: rows.slice(0, limit).map((r) => ({ id: r.id, rating: r.rating, comment: r.comment, created_at: r.created_at, author: shortName(r.name) })),
    next_offset: rows.length > limit ? offset + limit : null,
  });
});

/** Detalhe do produto + o mesmo item nos outros mercados (comparação de preço). */
store.get('/products/:id', async (c) => {
  const id = c.req.param('id');
  if (!/^[\w-]{1,64}$/.test(id)) throw badRequest('Produto inválido.', 'validation');
  const p = await c.env.DB.prepare(
    `SELECT p.id, p.market_id, m.name AS market_name, m.image_url AS market_image_url, m.is_open AS market_open_flag,
            m.opens_at, m.closes_at, m.delivery_fee_cents, m.eta_min, m.eta_max,
            p.category_id, c.name AS category_name, p.subcategory, p.name, p.brand, p.unit, p.image_url, p.description, p.price_cents, p.promo_price_cents, p.stock,
            p.compare_key
       FROM products p JOIN markets m ON m.id = p.market_id JOIN categories c ON c.id = p.category_id
      WHERE p.id = ? AND p.is_active = 1 AND m.status = 'ativo'`,
  )
    .bind(id)
    .first<Record<string, unknown> & { compare_key: string | null; opens_at: string; closes_at: string; market_open_flag: number }>();
  if (!p) throw notFound('Produto não encontrado.');

  const { results: others } = p.compare_key
    ? await c.env.DB.prepare(
        `SELECT p.id, p.market_id, m.name AS market_name, p.price_cents, p.promo_price_cents, p.stock
           FROM products p JOIN markets m ON m.id = p.market_id
          WHERE p.compare_key = ? AND p.id != ? AND p.is_active = 1 AND m.status = 'ativo'
          ORDER BY COALESCE(p.promo_price_cents, p.price_cents) LIMIT 10`,
      )
        .bind(p.compare_key, id)
        .all()
    : { results: [] };

  const { compare_key: _k, opens_at, closes_at, market_open_flag, ...product } = p;
  return c.json({
    product: {
      ...product,
      delivery_fee_cents: (await getSettings(c.env)).delivery_base_cents,
      market_open: isOpenNow(opens_at, closes_at, market_open_flag, clock(c.env)),
    },
    compare: others,
  });
});

export default store;
