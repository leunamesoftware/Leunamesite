/**
 * Motor de comparação EconoRota.
 * Regras: até MAX_MARKETS mercados por pedido; com 2 ou mais mercados, cada um precisa de pelo menos
 * MIN_ITEMS_PER_MARKET produtos diferentes; respeita estoque e pedido mínimo. A entrega é única (um entregador
 * coleta em todos os mercados): valor base + adicional por mercado extra (configurável no painel).
 */
export const MAX_MARKETS = 3;
export const MIN_ITEMS_PER_MARKET = 5;
export const EXTRA_STOP_MINUTES = 10;

export type Want = { key: string; qty: number };
export type Offer = { productId: string; priceCents: number; stock: number; unit?: string; cold?: boolean };

/** Valor da entrega para os mercados do plano. */
export type DeliveryFee = (markets: MarketIn[]) => number;
/** Entrega única: base + adicional por mercado extra. */
export const combinedFee = (baseCents: number, extraCents: number): DeliveryFee => (ms) => baseCents + extraCents * Math.max(ms.length - 1, 0);
/** Soma das taxas de cada mercado (referência/testes). */
export const sumOfMarketFees: DeliveryFee = (ms) => ms.reduce((s, m) => s + m.deliveryFeeCents, 0);
export type MarketIn = {
  id: string; name: string; deliveryFeeCents: number; minOrderCents: number; etaMax: number; distanceKm: number | null;
  offers: Map<string, Offer>;
};

export type PlanLine = { key: string; qty: number; marketId: string; productId: string; unitCents: number; totalCents: number };
export type Plan = {
  marketIds: string[];
  lines: PlanLine[];
  missing: string[];
  itemsCents: number;
  deliveryCents: number;
  totalCents: number;
  etaMax: number;
};

function* subsets<T>(arr: T[], max: number): Generator<T[]> {
  const n = arr.length;
  function* rec(start: number, acc: T[]): Generator<T[]> {
    if (acc.length) yield acc;
    if (acc.length === max) return;
    for (let i = start; i < n; i++) yield* rec(i + 1, [...acc, arr[i]]);
  }
  yield* rec(0, []);
}

/** Melhor distribuição dos itens dentro de um conjunto de mercados, ou null se violar as regras. */
function planFor(markets: MarketIn[], wants: Want[], fee: DeliveryFee): Plan | null {
  const pick = new Map<string, MarketIn>();
  const missing: string[] = [];
  for (const w of wants) {
    let best: MarketIn | null = null;
    for (const m of markets) {
      const o = m.offers.get(w.key);
      if (!o || o.stock < w.qty) continue;
      if (!best || o.priceCents < best.offers.get(w.key)!.priceCents) best = m;
    }
    best ? pick.set(w.key, best) : missing.push(w.key);
  }

  if (markets.length > 1) {
    // Rebalanceia: mercados com menos de MIN itens recebem os itens com menor acréscimo de preço.
    const count = (m: MarketIn) => [...pick.values()].filter((x) => x === m).length;
    for (const m of markets) {
      while (count(m) < MIN_ITEMS_PER_MARKET) {
        let move: { key: string; delta: number } | null = null;
        for (const w of wants) {
          const cur = pick.get(w.key);
          const o = m.offers.get(w.key);
          if (!cur || cur === m || !o || o.stock < w.qty || count(cur) <= MIN_ITEMS_PER_MARKET) continue;
          const delta = (o.priceCents - cur.offers.get(w.key)!.priceCents) * w.qty;
          if (!move || delta < move.delta) move = { key: w.key, delta };
        }
        if (!move) return null;
        pick.set(move.key, m);
      }
    }
  }

  const used = markets.filter((m) => [...pick.values()].includes(m));
  if (used.length !== markets.length) return null; // mercado sem itens: o subconjunto menor já cobre este caso

  const lines: PlanLine[] = wants
    .filter((w) => pick.has(w.key))
    .map((w) => {
      const m = pick.get(w.key)!;
      const o = m.offers.get(w.key)!;
      return { key: w.key, qty: w.qty, marketId: m.id, productId: o.productId, unitCents: o.priceCents, totalCents: o.priceCents * w.qty };
    });
  for (const m of markets) {
    const sub = lines.filter((l) => l.marketId === m.id).reduce((s, l) => s + l.totalCents, 0);
    if (sub < m.minOrderCents) return null;
  }
  const itemsCents = lines.reduce((s, l) => s + l.totalCents, 0);
  const deliveryCents = fee(markets);
  return {
    marketIds: markets.map((m) => m.id),
    lines,
    missing,
    itemsCents,
    deliveryCents,
    totalCents: itemsCents + deliveryCents,
    etaMax: Math.max(...markets.map((m) => m.etaMax)) + EXTRA_STOP_MINUTES * (markets.length - 1),
  };
}

/** Plano mais barato para cada quantidade de mercados (1, 2 e 3). Menos itens faltando sempre vence. */
export function optimize(markets: MarketIn[], wants: Want[], fee: DeliveryFee = sumOfMarketFees) {
  const best = new Map<number, Plan>();
  const better = (a: Plan, b?: Plan) => !b || a.missing.length < b.missing.length || (a.missing.length === b.missing.length && a.totalCents < b.totalCents);
  for (const set of subsets(markets, MAX_MARKETS)) {
    const p = planFor(set, wants, fee);
    if (p && better(p, best.get(set.length))) best.set(set.length, p);
  }
  const all = [...best.values()];
  const cheapest = all.reduce<Plan | null>((a, p) => (!a || better(p, a) ? p : a), null);
  return { cheapest, single: best.get(1) ?? null, byCount: all.sort((a, b) => a.marketIds.length - b.marketIds.length) };
}

/** Quanto o cliente pagaria em cada item pela média dos preços encontrados (referência de economia). */
export function averageItemsCents(markets: MarketIn[], wants: Want[]) {
  let total = 0;
  for (const w of wants) {
    const prices = markets.map((m) => m.offers.get(w.key)?.priceCents).filter((p): p is number => p !== undefined);
    if (prices.length) total += Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) * w.qty;
  }
  return total;
}

/** Rota de entrega: ordem dos mercados que minimiza a distância até a casa do cliente. */
export const AVG_SPEED_KMH = 25;
export const PICKUP_MINUTES = 5;

type Pt = { id: string; lat: number; lng: number };

/** Tolerância para deixar a coleta de refrigerados por último (rota até 15% maior). */
export const COLD_LAST_TOLERANCE = 1.15;

export function bestRoute(
  markets: Pt[],
  home: { lat: number; lng: number },
  dist: (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => number,
  cold: Set<string> = new Set(),
) {
  const perms = (a: Pt[]): Pt[][] => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
  type R = { order: Pt[]; legs: number[]; total: number };
  const all: R[] = perms(markets).map((order) => {
    const stops = [...order, home];
    const legs = stops.slice(1).map((p, i) => dist(stops[i], p));
    return { order, legs, total: legs.reduce((s, l) => s + l, 0) };
  });
  let best = all.reduce<R | null>((a, r) => (!a || r.total < a.total ? r : a), null);
  if (!best) return null;
  // Perecíveis (carnes, laticínios, congelados) ficam menos tempo fora da geladeira: mercado com refrigerados por último.
  if (cold.size && !cold.has(best.order[best.order.length - 1].id)) {
    const alt = all
      .filter((r) => cold.has(r.order[r.order.length - 1].id) && r.total <= best!.total * COLD_LAST_TOLERANCE)
      .reduce<R | null>((a, r) => (!a || r.total < a.total ? r : a), null);
    if (alt) best = alt;
  }
  const round = (n: number) => Math.round(n * 10) / 10;
  return {
    order: best.order.map((m) => m.id),
    legs_km: best.legs.map(round),
    total_km: round(best.total),
    minutes: Math.round((best.total / AVG_SPEED_KMH) * 60 + PICKUP_MINUTES * markets.length),
  };
}

/** Tempo até o entregador chegar ao primeiro mercado (minutos). */
export const COURIER_ARRIVAL_MINUTES = 10;

/**
 * Previsão de entrega (minutos, arredondada para cima em 5): o mercado separa enquanto o entregador chega,
 * depois a rota (coletas + trajeto) e um acréscimo quando há poucos entregadores para os pedidos em andamento.
 */
export function forecastMinutes(prepMinutes: number, routeMinutes: number, load: { activeOrders: number; onlineCouriers: number }) {
  const ratio = load.onlineCouriers ? load.activeOrders / load.onlineCouriers : Infinity;
  const buffer = ratio <= 1 ? 0 : ratio <= 2 ? 10 : 20;
  const total = Math.max(prepMinutes, COURIER_ARRIVAL_MINUTES) + routeMinutes + buffer;
  return Math.ceil(total / 5) * 5;
}
