/// Motor de comparação (mesmas regras da API, usado no modo demonstração e nos testes):
/// até [maxMarkets] mercados; com 2 ou mais, cada um com pelo menos [minItemsPerMarket] produtos diferentes;
/// respeita estoque e pedido mínimo; entrega única (base + adicional por mercado extra, como a API).
library;

import 'rules.dart';

const maxMarkets = 3;
const minItemsPerMarket = 5;
const extraStopMinutes = 10;

class Want {
  const Want(this.key, this.qty);
  final String key;
  final int qty;
}

class Offer {
  const Offer({required this.productId, required this.priceCents, required this.stock});
  final String productId;
  final int priceCents;
  final int stock;
}

class MarketOffers {
  const MarketOffers({
    required this.id,
    required this.deliveryFeeCents,
    required this.offers,
    this.minOrderCents = 0,
    this.etaMax = 30,
  });

  final String id;
  final int deliveryFeeCents;
  final int minOrderCents;
  final int etaMax;
  final Map<String, Offer> offers;
}

class PlanLine {
  const PlanLine({
    required this.key,
    required this.qty,
    required this.marketId,
    required this.productId,
    required this.unitCents,
  });
  final String key;
  final int qty;
  final String marketId;
  final String productId;
  final int unitCents;
  int get totalCents => unitCents * qty;
}

class Plan {
  const Plan({
    required this.marketIds,
    required this.lines,
    required this.missing,
    required this.deliveryCents,
    required this.etaMax,
  });

  final List<String> marketIds;
  final List<PlanLine> lines;
  final List<String> missing;
  final int deliveryCents;
  final int etaMax;

  int get itemsCents => lines.fold(0, (s, l) => s + l.totalCents);
  int get totalCents => itemsCents + deliveryCents;
  List<PlanLine> linesOf(String marketId) => lines.where((l) => l.marketId == marketId).toList();
}

Iterable<List<T>> _subsets<T>(List<T> arr, int max, [int start = 0, List<T> acc = const []]) sync* {
  if (acc.isNotEmpty) yield acc;
  if (acc.length == max) return;
  for (var i = start; i < arr.length; i++) {
    yield* _subsets(arr, max, i + 1, [...acc, arr[i]]);
  }
}

Plan? _planFor(List<MarketOffers> markets, List<Want> wants, int Function(List<MarketOffers>) fee) {
  final pick = <String, MarketOffers>{};
  final missing = <String>[];
  for (final w in wants) {
    MarketOffers? best;
    for (final m in markets) {
      final o = m.offers[w.key];
      if (o == null || o.stock < w.qty) continue;
      if (best == null || o.priceCents < best.offers[w.key]!.priceCents) best = m;
    }
    best == null ? missing.add(w.key) : pick[w.key] = best;
  }

  if (markets.length > 1) {
    int count(MarketOffers m) => pick.values.where((x) => x == m).length;
    for (final m in markets) {
      while (count(m) < minItemsPerMarket) {
        String? moveKey;
        int? moveDelta;
        for (final w in wants) {
          final cur = pick[w.key];
          final o = m.offers[w.key];
          if (cur == null || cur == m || o == null || o.stock < w.qty || count(cur) <= minItemsPerMarket) continue;
          final delta = (o.priceCents - cur.offers[w.key]!.priceCents) * w.qty;
          if (moveDelta == null || delta < moveDelta) {
            moveKey = w.key;
            moveDelta = delta;
          }
        }
        if (moveKey == null) return null;
        pick[moveKey] = m;
      }
    }
  }
  if (markets.any((m) => !pick.values.contains(m))) return null;

  final lines = [
    for (final w in wants)
      if (pick[w.key] != null)
        PlanLine(
          key: w.key,
          qty: w.qty,
          marketId: pick[w.key]!.id,
          productId: pick[w.key]!.offers[w.key]!.productId,
          unitCents: pick[w.key]!.offers[w.key]!.priceCents,
        ),
  ];
  for (final m in markets) {
    final sub = lines.where((l) => l.marketId == m.id).fold(0, (s, l) => s + l.totalCents);
    if (sub < m.minOrderCents) return null;
  }
  return Plan(
    marketIds: [for (final m in markets) m.id],
    lines: lines,
    missing: missing,
    deliveryCents: fee(markets),
    etaMax: markets.map((m) => m.etaMax).reduce((a, b) => a > b ? a : b) + extraStopMinutes * (markets.length - 1),
  );
}

bool _better(Plan a, Plan? b) =>
    b == null ||
    a.missing.length < b.missing.length ||
    (a.missing.length == b.missing.length && a.totalCents < b.totalCents);

/// Mais barato no geral e melhor opção com um só mercado.
/// [fee]: valor da entrega para os mercados do plano (padrão: entrega única de [deliveryFeeFor]).
({Plan? cheapest, Plan? single}) optimize(
  List<MarketOffers> markets,
  List<Want> wants, {
  int Function(List<MarketOffers> markets)? fee,
}) {
  final deliveryFee = fee ?? (ms) => deliveryFeeFor(ms.length);
  final best = <int, Plan>{};
  for (final set in _subsets(markets, maxMarkets)) {
    final p = _planFor(set, wants, deliveryFee);
    if (p != null && _better(p, best[set.length])) best[set.length] = p;
  }
  Plan? cheapest;
  for (final p in best.values) {
    if (_better(p, cheapest)) cheapest = p;
  }
  return (cheapest: cheapest, single: best[1]);
}
