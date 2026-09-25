import { Hono } from 'hono';

import { badRequest } from '../lib/errors';
import { distanceKm, isOpenNow, clock } from '../lib/geo';
import { getSettings } from '../lib/settings';
import type { AppEnv } from '../lib/types';

const catalog = new Hono<AppEnv>();
const MAX_LIMIT = 50;
const RADIUS_KM = 15;

type MarketRow = {
  id: string; name: string; address: string | null; district: string | null; city: string | null; lat: number | null; lng: number | null;
  rating: number; rating_count: number; is_open: number; image_url: string | null; delivery_fee_cents: number; min_order_cents: number;
  eta_min: number; eta_max: number; opens_at: string; closes_at: string;
};

const coords = (lat?: string, lng?: string) => {
  if (lat === undefined || lng === undefined) return null;
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) throw badRequest('Coordenadas inválidas.', 'validation');
  return { lat: a, lng: b };
};

const pageArgs = (limit?: string, offset?: string) => ({
  limit: Math.min(Math.max(Number(limit) || 20, 1), MAX_LIMIT),
  offset: Math.max(Number(offset) || 0, 0),
});

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (ch) => `\\${ch}`);

catalog.get('/categories', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT id, name, icon, color FROM categories ORDER BY sort, name').all();
  return c.json({ items: results }, 200, { 'Cache-Control': 'public, max-age=300' });
});

/** Mercados ativos; com lat/lng calcula distância e limita ao raio de entrega. */
catalog.get('/markets', async (c) => {
  const here = coords(c.req.query('lat'), c.req.query('lng'));
  const q = c.req.query('q')?.trim().toLowerCase().slice(0, 60);
  const onlyOpen = c.req.query('open') === '1';
  const sort = c.req.query('sort') ?? 'distance';

  const { results } = await c.env.DB.prepare(
    `SELECT id, name, address, district, city, lat, lng, rating, rating_count, is_open, image_url, delivery_fee_cents,
            min_order_cents, eta_min, eta_max, opens_at, closes_at
       FROM markets WHERE status = 'ativo'`,
  ).all<MarketRow>();

  const now = clock(c.env);
  // Entrega única do EconoRota: mesmo valor base para qualquer mercado (adicional só por mercado extra no pedido).
  const fee = (await getSettings(c.env)).delivery_base_cents;
  let items = results.map((m) => ({
    ...m,
    delivery_fee_cents: fee,
    is_open: isOpenNow(m.opens_at, m.closes_at, m.is_open, now),
    distance_km: here && m.lat != null && m.lng != null ? Math.round(distanceKm(here.lat, here.lng, m.lat, m.lng) * 10) / 10 : null,
  }));
  if (here) items = items.filter((m) => m.distance_km !== null && m.distance_km <= RADIUS_KM);
  if (q) items = items.filter((m) => m.name.toLowerCase().includes(q));
  if (onlyOpen) items = items.filter((m) => m.is_open);

  const by = {
    distance: (a: (typeof items)[0], b: (typeof items)[0]) => (a.distance_km ?? 999) - (b.distance_km ?? 999),
    rating: (a: (typeof items)[0], b: (typeof items)[0]) => b.rating - a.rating,
    fee: (a: (typeof items)[0], b: (typeof items)[0]) => a.delivery_fee_cents - b.delivery_fee_cents,
  }[sort] ?? (() => 0);
  // Abertos primeiro; depois o critério escolhido.
  items.sort((a, b) => Number(b.is_open) - Number(a.is_open) || by(a, b));
  return c.json({ items: items.slice(0, MAX_LIMIT) });
});

/** Produtos: busca, categoria, mercado, ofertas, ordenação e paginação. */
catalog.get('/products', async (c) => {
  const q = c.req.query('q')?.trim().slice(0, 80);
  const category = c.req.query('category_id');
  const market = c.req.query('market_id');
  const onSale = c.req.query('on_sale') === '1';
  const sub = c.req.query('sub')?.trim().slice(0, 40);
  const sort = c.req.query('sort') ?? (q ? 'relevance' : onSale ? 'discount' : 'price');
  const { limit, offset } = pageArgs(c.req.query('limit'), c.req.query('offset'));

  const where = ['p.is_active = 1', "m.status = 'ativo'"];
  const args: unknown[] = [];
  if (q) {
    where.push("(p.name LIKE ? ESCAPE '\\' OR p.brand LIKE ? ESCAPE '\\')");
    args.push(`%${escapeLike(q)}%`, `%${escapeLike(q)}%`);
  }
  if (category) {
    where.push('p.category_id = ?');
    args.push(category);
  }
  if (market) {
    where.push('p.market_id = ?');
    args.push(market);
  }
  if (sub) {
    where.push('p.subcategory = ?');
    args.push(sub);
  }
  if (onSale) where.push('p.promo_price_cents IS NOT NULL AND p.promo_price_cents < p.price_cents');

  const price = 'COALESCE(p.promo_price_cents, p.price_cents)';
  const discount = 'CASE WHEN p.promo_price_cents IS NULL THEN 0 ELSE (p.price_cents - p.promo_price_cents) * 1.0 / p.price_cents END';
  const order = {
    relevance: `(p.stock > 0) DESC, (p.name LIKE ? ESCAPE '\\') DESC, ${discount} DESC, ${price}`,
    price: `(p.stock > 0) DESC, ${price} ASC`,
    discount: `(p.stock > 0) DESC, ${discount} DESC, ${price} ASC`,
  }[sort];
  if (!order) throw badRequest('Ordenação inválida.', 'validation');
  const orderArgs = sort === 'relevance' ? [`${escapeLike(q ?? '')}%`] : [];

  const { results } = await c.env.DB.prepare(
    `SELECT p.id, p.market_id, m.name AS market_name, p.category_id, p.subcategory, p.name, p.brand, p.unit, p.image_url,
            p.price_cents, p.promo_price_cents, p.stock
       FROM products p JOIN markets m ON m.id = p.market_id
      WHERE ${where.join(' AND ')}
      ORDER BY ${order}
      LIMIT ? OFFSET ?`,
  )
    .bind(...args, ...orderArgs, limit + 1, offset)
    .all();

  const hasMore = results.length > limit;
  return c.json({ items: results.slice(0, limit), next_offset: hasMore ? offset + limit : null });
});

/** Subcategorias com produtos ativos numa categoria (opcionalmente só de um mercado). */
catalog.get('/categories/:id/subcategories', async (c) => {
  const market = c.req.query('market_id');
  const { results } = await c.env.DB.prepare(
    `SELECT p.subcategory AS name, COUNT(*) AS count FROM products p JOIN markets m ON m.id = p.market_id
      WHERE p.category_id = ? AND p.subcategory IS NOT NULL AND p.is_active = 1 AND m.status = 'ativo'
        ${market ? 'AND p.market_id = ?' : ''}
      GROUP BY p.subcategory ORDER BY count DESC, p.subcategory`,
  )
    .bind(...(market ? [c.req.param('id'), market] : [c.req.param('id')]))
    .all();
  return c.json({ items: results });
});

/** Sugestões enquanto digita: nomes de produtos e categorias. */
catalog.get('/search/suggest', async (c) => {
  const q = c.req.query('q')?.trim().slice(0, 60) ?? '';
  if (q.length < 2) return c.json({ suggestions: [], categories: [] });
  const like = `%${escapeLike(q)}%`;
  const [names, cats] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT DISTINCT lower(p.name) AS name FROM products p JOIN markets m ON m.id = p.market_id
        WHERE p.is_active = 1 AND m.status = 'ativo' AND p.name LIKE ? ESCAPE '\\' ORDER BY length(p.name) LIMIT 8`,
    ).bind(like),
    c.env.DB.prepare(
      `SELECT DISTINCT c.id, c.name, c.icon, c.color FROM categories c
         LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
        WHERE c.name LIKE ? ESCAPE '\\' OR p.name LIKE ? ESCAPE '\\' ORDER BY c.sort LIMIT 8`,
    ).bind(like, like),
  ]);
  return c.json({
    suggestions: (names.results as { name: string }[]).map((r) => r.name),
    categories: cats.results,
  });
});

export default catalog;
