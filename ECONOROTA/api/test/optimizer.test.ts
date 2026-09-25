import assert from 'node:assert/strict';
import { test } from 'node:test';

import { optimize, type MarketIn } from '../src/lib/optimizer.ts';

const mk = (id: string, fee: number, prices: Record<string, number>, opts: Partial<MarketIn> = {}): MarketIn => ({
  id, name: id, deliveryFeeCents: fee, minOrderCents: 0, etaMax: 30, distanceKm: 1,
  offers: new Map(Object.entries(prices).map(([k, p]) => [k, { productId: `${id}-${k}`, priceCents: p, stock: 10 }])),
  ...opts,
});
const want = (...keys: string[]) => keys.map((key) => ({ key, qty: 1 }));
const ten = 'abcdefghij'.split('');

test('um mercado quando a economia não paga a taxa extra', () => {
  const a = mk('A', 500, Object.fromEntries(ten.map((k) => [k, 100])));
  const b = mk('B', 500, Object.fromEntries(ten.map((k) => [k, 99])));
  const r = optimize([a, b], want(...ten));
  assert.deepEqual(r.cheapest!.marketIds, ['B']);
  assert.equal(r.cheapest!.totalCents, 990 + 500);
});

test('dois mercados quando compensa, cada um com pelo menos 5 itens', () => {
  const a = mk('A', 300, Object.fromEntries(ten.map((k, i) => [k, i < 5 ? 100 : 300])));
  const b = mk('B', 300, Object.fromEntries(ten.map((k, i) => [k, i < 5 ? 300 : 100])));
  const r = optimize([a, b], want(...ten));
  assert.equal(r.cheapest!.marketIds.length, 2);
  assert.equal(r.cheapest!.totalCents, 1000 + 600);
  for (const m of r.cheapest!.marketIds) assert.ok(r.cheapest!.lines.filter((l) => l.marketId === m).length >= 5);
});

test('nunca divide com menos de 5 itens por mercado', () => {
  // B é mais barato em só 3 itens: dividir violaria a regra, então fica tudo em A.
  const a = mk('A', 300, Object.fromEntries(ten.map((k) => [k, 200])));
  const b = mk('B', 300, Object.fromEntries(ten.map((k, i) => [k, i < 3 ? 10 : 500])));
  const r = optimize([a, b], want(...ten));
  assert.deepEqual(r.cheapest!.marketIds, ['A']);
});

test('rebalanceia itens para atingir o mínimo quando ainda compensa', () => {
  // B muito mais barato em 4 itens; o 5º item move com pequeno acréscimo e a divisão ainda vale a pena.
  const a = mk('A', 100, Object.fromEntries(ten.map((k) => [k, 200])));
  const b = mk('B', 100, Object.fromEntries(ten.map((k, i) => [k, i < 4 ? 10 : 260])));
  const r = optimize([a, b], want(...ten));
  assert.equal(r.cheapest!.marketIds.length, 2);
  assert.equal(r.cheapest!.lines.filter((l) => l.marketId === 'B').length, 5);
});

test('no máximo 3 mercados', () => {
  const keys = Array.from({ length: 20 }, (_, i) => `k${i}`);
  const markets = ['A', 'B', 'C', 'D'].map((id, mi) =>
    mk(id, 0, Object.fromEntries(keys.map((k, i) => [k, Math.floor(i / 5) === mi ? 1 : 1000]))),
  );
  const r = optimize(markets, want(...keys));
  assert.equal(r.cheapest!.marketIds.length, 3);
});

test('respeita estoque e informa itens faltando', () => {
  const a = mk('A', 0, { x: 100, y: 100 });
  a.offers.get('y')!.stock = 0;
  const r = optimize([a], [{ key: 'x', qty: 1 }, { key: 'y', qty: 1 }, { key: 'z', qty: 1 }]);
  assert.deepEqual(r.cheapest!.missing.sort(), ['y', 'z']);
});

test('respeita pedido mínimo do mercado', () => {
  const a = mk('A', 0, { x: 100 }, { minOrderCents: 1000 });
  const b = mk('B', 0, { x: 150 });
  const r = optimize([a, b], want('x'));
  assert.deepEqual(r.cheapest!.marketIds, ['B']);
});

test('rota: visita os mercados na ordem mais curta até a casa', async () => {
  const { bestRoute } = await import('../src/lib/optimizer.ts');
  // Linha reta: casa em x=0; mercados em x=1, 3, 2 → melhor ordem é 3, 2, 1.
  const d = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => Math.abs(a.lat - b.lat);
  const r = bestRoute([{ id: 'A', lat: 1, lng: 0 }, { id: 'B', lat: 3, lng: 0 }, { id: 'C', lat: 2, lng: 0 }], { lat: 0, lng: 0 }, d)!;
  assert.deepEqual(r.order, ['B', 'C', 'A']);
  assert.equal(r.total_km, 3);
  assert.deepEqual(r.legs_km, [1, 1, 1]);
});
