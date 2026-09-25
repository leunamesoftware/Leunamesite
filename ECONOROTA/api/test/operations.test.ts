import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fits, offeredTo, orderGrams, PRIORITY_SECONDS, rankCouriers, unitGrams } from '../src/lib/dispatch.ts';
import { distanceKm } from '../src/lib/geo.ts';
import { bestRoute, combinedFee, forecastMinutes, optimize, type MarketIn } from '../src/lib/optimizer.ts';

const mk = (id: string, prices: Record<string, number>): MarketIn => ({
  id, name: id, deliveryFeeCents: 999, minOrderCents: 0, etaMax: 30, distanceKm: 1,
  offers: new Map(Object.entries(prices).map(([k, p]) => [k, { productId: `${id}-${k}`, priceCents: p, stock: 10 }])),
});
const ten = 'abcdefghij'.split('');
const want = ten.map((key) => ({ key, qty: 1 }));

test('entrega única: base + adicional por mercado extra (ignora taxa de cada mercado)', () => {
  const fee = combinedFee(790, 300);
  const one = optimize([mk('A', Object.fromEntries(ten.map((k) => [k, 100])))], want, fee);
  assert.equal(one.cheapest!.deliveryCents, 790);
  const a = mk('A', Object.fromEntries(ten.map((k, i) => [k, i < 5 ? 100 : 400])));
  const b = mk('B', Object.fromEntries(ten.map((k, i) => [k, i < 5 ? 400 : 100])));
  const two = optimize([a, b], want, fee);
  assert.equal(two.cheapest!.marketIds.length, 2);
  assert.equal(two.cheapest!.deliveryCents, 1090);
});

test('dividir só compensa se a economia pagar o adicional', () => {
  const a = mk('A', Object.fromEntries(ten.map((k) => [k, 100])));
  const b = mk('B', Object.fromEntries(ten.map((k, i) => [k, i < 5 ? 60 : 100]))); // economia de 200 < adicional de 300
  assert.equal(optimize([a, b], want, combinedFee(790, 300)).cheapest!.marketIds.length, 1);
});

test('rota deixa o mercado com refrigerados por último quando a volta é pequena', () => {
  const dist = (p: { lat: number; lng: number }, q: { lat: number; lng: number }) => Math.hypot(p.lat - q.lat, p.lng - q.lng);
  const home = { lat: 0, lng: 0 };
  const markets = [
    { id: 'A', lat: 1, lng: 0 },
    { id: 'B', lat: 1.05, lng: 0.1 },
  ];
  assert.equal(bestRoute(markets, home, dist)!.order.at(-1), 'A');
  assert.equal(bestRoute(markets, home, dist, new Set(['B']))!.order.at(-1), 'B');
  // Longe demais (mais de 15%): mantém a rota mais curta.
  const far = [
    { id: 'A', lat: 1, lng: 0 },
    { id: 'B', lat: 3, lng: 0 },
  ];
  assert.equal(bestRoute(far, home, dist, new Set(['B']))!.order.at(-1), 'A');
});

test('previsão de entrega considera separação, rota e fila de entregadores', () => {
  assert.equal(forecastMinutes(20, 18, { activeOrders: 1, onlineCouriers: 3 }), 40);
  assert.equal(forecastMinutes(5, 18, { activeOrders: 1, onlineCouriers: 3 }), 30); // entregador chega em 10 min
  assert.equal(forecastMinutes(20, 18, { activeOrders: 5, onlineCouriers: 3 }), 50);
  assert.equal(forecastMinutes(20, 18, { activeOrders: 2, onlineCouriers: 0 }), 60);
});

test('peso estimado pela unidade do produto', () => {
  assert.equal(unitGrams('5 kg'), 5000);
  assert.equal(unitGrams('900 ml'), 900);
  assert.equal(unitGrams('1,5 L'), 1500);
  assert.equal(unitGrams('500g'), 500);
  assert.equal(unitGrams('1 dz'), 700);
  assert.equal(unitGrams('pacote'), 500);
  assert.equal(orderGrams([{ unit: '5 kg', qty: 2 }, { unit: '1 l', qty: 6 }]), 16000);
});

test('capacidade do veículo: bicicleta leva pouco e no máximo 2 mercados', () => {
  assert.ok(fits('bicicleta', 10_000, 2));
  assert.ok(!fits('bicicleta', 16_000, 1));
  assert.ok(!fits('bicicleta', 5_000, 3));
  assert.ok(fits('moto', 20_000, 3));
  assert.ok(!fits('moto', 30_000, 1));
  assert.ok(fits('carro', 80_000, 3));
});

test('prioridade: pedido vai primeiro aos melhores entregadores (distância, nota e veículo)', () => {
  const first = { lat: -23.55, lng: -46.65 };
  const c = (id: string, dLat: number, rating: number, vehicle = 'moto', count = 20) => ({
    id, lat: first.lat + dLat, lng: first.lng, rating, rating_count: count, vehicle_type: vehicle, work_radius_km: 10,
  });
  const pool = [c('perto-nota-baixa', 0.005, 3.5), c('medio-nota-alta', 0.01, 5), c('bike', 0.001, 5, 'bicicleta'), c('longe', 0.2, 5), c('novato', 0.02, 1, 'moto', 1)];
  const dist = (a: number, b: number, c2: number, d: number) => Math.hypot(a - c2, b - d) * 111;
  const ranked = rankCouriers(first, 16_000, 1, pool, dist);
  const ids = ranked.map((r) => r.id);
  assert.ok(!ids.includes('bike')); // 16 kg não cabe na bicicleta
  assert.ok(!ids.includes('longe')); // fora do raio
  assert.equal(ids[0], 'medio-nota-alta');
  assert.ok(ids.indexOf('novato') < ids.indexOf('perto-nota-baixa')); // novato não é punido pela 1ª nota
  const paid = new Date().toISOString();
  assert.ok(offeredTo('medio-nota-alta', paid, ranked));
  const late = new Date(Date.now() - (PRIORITY_SECONDS + 1) * 1000).toISOString();
  assert.ok(offeredTo('qualquer', late, ranked));
  assert.ok(!offeredTo('qualquer', paid, ranked.concat([{ id: 'x' }, { id: 'y' }, { id: 'z' }] as never)));
});

test('3 mercados com entrega única: cada um com 5 itens e total = itens + 13,90', () => {
  const keys = Array.from({ length: 15 }, (_, i) => `k${i}`);
  const m = (id: string, from: number) => mk(id, Object.fromEntries(keys.map((k, i) => [k, Math.floor(i / 5) === from ? 100 : 500])));
  const r = optimize([m('A', 0), m('B', 1), m('C', 2)], keys.map((key) => ({ key, qty: 1 })), combinedFee(790, 300));
  assert.equal(r.cheapest!.marketIds.length, 3);
  assert.equal(r.cheapest!.totalCents, 1500 + 1390);
  for (const id of r.cheapest!.marketIds) assert.equal(r.cheapest!.lines.filter((l) => l.marketId === id).length, 5);
});

test('distância real (Haversine) e rota até a casa', () => {
  assert.ok(Math.abs(distanceKm(-23.5614, -46.6559, -23.5503, -46.634) - 2.6) < 0.2);
  const r = bestRoute(
    [{ id: 'longe', lat: -23.54, lng: -46.63 }, { id: 'perto', lat: -23.565, lng: -46.648 }],
    { lat: -23.57, lng: -46.645 },
    (a, b) => distanceKm(a.lat, a.lng, b.lat, b.lng),
  )!;
  assert.deepEqual(r.order, ['longe', 'perto']);
  assert.ok(r.total_km > 3 && r.minutes > 10);
});
