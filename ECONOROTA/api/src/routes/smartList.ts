import { Hono } from 'hono';

import { badRequest } from '../lib/errors';
import { resolveLine, splitList, type CatalogType } from '../lib/listParser';
import type { AppEnv } from '../lib/types';
import { readJson } from '../lib/validate';

const smartList = new Hono<AppEnv>();

/** Interpreta a lista do cliente e devolve, para cada linha, o produto, a marca, o tamanho e a quantidade. */
smartList.post('/list/resolve', async (c) => {
  const body = await readJson(c.req.raw);
  if (typeof body.text !== 'string' || !body.text.trim()) throw badRequest('Digite ou cole sua lista.', 'validation');
  if (body.text.length > 4000) throw badRequest('Lista muito longa.', 'validation');
  const lines = splitList(body.text);

  const { results } = await c.env.DB.prepare(
    `SELECT p.compare_key AS key, MIN(p.name) AS name, MIN(p.unit) AS unit, MIN(p.category_id) AS category_id, GROUP_CONCAT(DISTINCT p.brand) AS brands,
            MIN(COALESCE(p.promo_price_cents, p.price_cents)) AS min_price, COUNT(DISTINCT p.market_id) AS markets,
            MAX(p.image_url) AS image_url
       FROM products p JOIN markets m ON m.id = p.market_id
      WHERE p.is_active = 1 AND m.status = 'ativo' AND p.stock > 0 AND p.compare_key IS NOT NULL
      GROUP BY p.compare_key`,
  ).all<{ key: string; name: string; unit: string; category_id: string; brands: string | null; min_price: number; markets: number; image_url: string | null }>();
  const catalog: CatalogType[] = results.map((r) => ({
    key: r.key,
    name: r.name,
    unit: r.unit,
    brands: r.brands ? r.brands.split(',').sort() : [],
    minPriceCents: r.min_price,
    markets: r.markets,
    imageUrl: r.image_url,
  }));

  const categoryOf = new Map(results.map((r) => [r.key, r.category_id]));

  return c.json({
    items: lines.map((l) => {
      const r = resolveLine(l, catalog);
      return {
        line: r.line,
        qty: r.qty,
        brand: r.brand,
        brand_found: r.brandFound,
        size: r.size,
        options: r.options.map((o) => ({
          key: o.key, name: o.name, unit: o.unit, category_id: categoryOf.get(o.key), brands: o.brands, min_price_cents: o.minPriceCents, markets: o.markets, image_url: o.imageUrl,
        })),
      };
    }),
  });
});

export default smartList;
