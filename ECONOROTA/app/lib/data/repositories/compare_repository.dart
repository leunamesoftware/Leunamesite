import '../../core/compare/compare_key.dart';
import '../../core/compare/list_parser.dart' as lp;
import '../../core/compare/optimizer.dart' as opt;
import '../../core/compare/route.dart';
import '../../core/compare/rules.dart';
import '../../services/api_client.dart';
import '../mock/mock_data.dart';
import '../models/compare.dart';
import 'catalog_repository.dart';

abstract interface class CompareRepository {
  Future<List<CatalogItem>> catalog({String? text, String? categoryId});
  Future<CompareResult> compare(Map<String, int> items, {double? lat, double? lng, List<String>? marketIds});

  /// Lista inteligente: interpreta o texto digitado/colado pelo cliente.
  Future<List<SmartLine>> resolveList(String text);
}

class ApiCompareRepository implements CompareRepository {
  ApiCompareRepository(this._api);

  final ApiClient _api;

  @override
  Future<List<CatalogItem>> catalog({String? text, String? categoryId}) async {
    final params = {'q': ?text, 'category_id': ?categoryId}..removeWhere((_, v) => v.isEmpty);
    final j = await _api.get('/catalog/items${params.isEmpty ? '' : '?${Uri(queryParameters: params).query}'}');
    return (j['items'] as List).cast<Map<String, dynamic>>().map(CatalogItem.fromJson).toList();
  }

  @override
  Future<List<SmartLine>> resolveList(String text) async {
    final j = await _api.post('/list/resolve', {'text': text});
    return (j['items'] as List).cast<Map<String, dynamic>>().map(SmartLine.fromJson).toList();
  }

  @override
  Future<CompareResult> compare(Map<String, int> items, {double? lat, double? lng, List<String>? marketIds}) async {
    final j = await _api.post('/compare', {
      'lat': ?lat,
      'lng': ?lng,
      'market_ids': ?marketIds,
      'items': [
        for (final e in items.entries) {'key': e.key, 'qty': e.value},
      ],
    });
    final rules = j['rules'] as Map<String, dynamic>? ?? const {};
    return CompareResult(
      maxMarkets: rules['max_markets'] as int? ?? 3,
      minItems: rules['min_items'] as int? ?? 5,
      minOrderCents: rules['min_order_cents'] as int? ?? 10000,
      deliveryBaseCents: rules['delivery_base_cents'] as int? ?? deliveryBaseCents,
      deliveryExtraCents: rules['delivery_extra_market_cents'] as int? ?? deliveryExtraMarketCents,
      averageItemsCents: j['average_items_cents'] as int? ?? 0,
      markets: [
        for (final m in (j['markets'] as List).cast<Map<String, dynamic>>())
          CompareMarket(
            id: m['id'] as String,
            name: m['name'] as String,
            imageUrl: m['image_url'] as String?,
            distanceKm: (m['distance_km'] as num?)?.toDouble(),
            address: m['address'] as String?,
            deliveryFeeCents: m['delivery_fee_cents'] as int? ?? 0,
            etaMax: m['eta_max'] as int? ?? 45,
          ),
      ],
      rows: [
        for (final r in (j['rows'] as List).cast<Map<String, dynamic>>())
          CompareRow(
            key: r['key'] as String,
            name: r['name'] as String,
            unit: r['unit'] as String,
            imageUrl: r['image_url'] as String?,
            qty: r['qty'] as int,
            prices: {
              for (final e in (r['prices'] as Map<String, dynamic>).entries)
                if (((e.value as Map)['stock'] as int) >= (r['qty'] as int)) e.key: (e.value as Map)['cents'] as int,
            },
            outOfStock: {
              for (final e in (r['prices'] as Map<String, dynamic>).entries)
                if (((e.value as Map)['stock'] as int) < (r['qty'] as int)) e.key,
            },
          ),
      ],
      plans: [
        for (final p in (j['plans'] as List).cast<Map<String, dynamic>>())
          ComparePlan(
            label: p['label'] as String,
            marketIds: (p['market_ids'] as List).cast<String>(),
            missing: (p['missing'] as List).cast<String>(),
            itemsCents: p['items_cents'] as int,
            deliveryCents: p['delivery_cents'] as int,
            etaMax: p['eta_max'] as int,
            route: p['route'] == null
                ? null
                : DeliveryRoute(
                    order: ((p['route'] as Map)['order'] as List).cast<String>(),
                    legsKm: [for (final l in (p['route'] as Map)['legs_km'] as List) (l as num).toDouble()],
                    totalKm: ((p['route'] as Map)['total_km'] as num).toDouble(),
                    minutes: (p['route'] as Map)['minutes'] as int,
                  ),
            lines: [
              for (final l in (p['lines'] as List).cast<Map<String, dynamic>>())
                CompareLine(
                  key: l['key'] as String,
                  qty: l['qty'] as int,
                  marketId: l['market_id'] as String,
                  productId: l['product_id'] as String,
                  unitCents: l['unit_cents'] as int,
                ),
            ],
          ),
      ],
    );
  }
}

/// Comparação local com os dados de demonstração (mesmo algoritmo da API).
class MockCompareRepository implements CompareRepository {
  MockCompareRepository(this._catalog);

  final CatalogRepository _catalog;

  static String _key(dynamic p) => compareKey(p.name as String, p.unit as String);

  @override
  Future<List<CatalogItem>> catalog({String? text, String? categoryId}) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    return _group(text: text, categoryId: categoryId);
  }

  List<CatalogItem> _group({String? text, String? categoryId}) {
    final t = compareKey(text ?? '', '').replaceAll('|', '');
    final groups = <String, List<dynamic>>{};
    for (final p in MockData.products.where((p) => p.inStock)) {
      if (categoryId != null && p.categoryId != categoryId) continue;
      if (t.isNotEmpty && !_key(p).contains(t)) continue;
      groups.putIfAbsent(_key(p), () => []).add(p);
    }
    final items = [
      for (final e in groups.entries)
        CatalogItem(
          key: e.key,
          name: e.value.first.name as String,
          unit: e.value.first.unit as String,
          categoryId: e.value.first.categoryId as String,
          imageUrl: e.value.map((p) => p.imageUrl as String?).firstWhere((i) => i != null, orElse: () => null),
          minPriceCents: e.value.map((p) => p.finalPriceCents as int).reduce((a, b) => a < b ? a : b),
          markets: e.value.map((p) => p.marketId).toSet().length,
          brands: ({
            for (final p in e.value)
              if ((p.brand as String?)?.isNotEmpty ?? false) p.brand as String,
          }.toList()..sort()),
        ),
    ]..sort((a, b) => b.markets != a.markets ? b.markets.compareTo(a.markets) : a.name.compareTo(b.name));
    return items;
  }

  @override
  Future<List<SmartLine>> resolveList(String text) async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    final catalog = _group();
    return [for (final l in lp.splitList(text)) lp.resolveLine(l, catalog)];
  }

  @override
  Future<CompareResult> compare(Map<String, int> items, {double? lat, double? lng, List<String>? marketIds}) async {
    final markets = (await _catalog.markets(
      lat: lat,
      lng: lng,
    )).where((m) => m.isOpen && (marketIds == null || marketIds.isEmpty || marketIds.contains(m.id))).toList();
    final home = (lat: lat ?? MockData.center.lat, lng: lng ?? MockData.center.lng);
    final coords = {for (final m in markets) m.id: (lat: m.lat!, lng: m.lng!)};
    final offers = <String, Map<String, opt.Offer>>{for (final m in markets) m.id: {}};
    final info = <String, dynamic>{};
    for (final p in MockData.products) {
      if (!offers.containsKey(p.marketId)) continue;
      // A oferta vale para o item genérico e para o item "da marca".
      final generic = _key(p);
      for (final k in [generic, if (p.brand?.isNotEmpty ?? false) brandKey(generic, p.brand!)]) {
        if (!items.containsKey(k)) continue;
        final cur = offers[p.marketId]![k];
        if (cur == null || p.finalPriceCents < cur.priceCents) {
          offers[p.marketId]![k] = opt.Offer(productId: p.id, priceCents: p.finalPriceCents, stock: p.stock);
        }
        if (info[k] == null || (info[k].imageUrl == null && p.imageUrl != null)) info[k] = p;
      }
    }
    final inputs = [
      for (final m in markets)
        opt.MarketOffers(
          id: m.id,
          deliveryFeeCents: m.deliveryFeeCents,
          minOrderCents: m.minOrderCents,
          etaMax: m.etaMax,
          offers: offers[m.id]!,
        ),
    ];
    final wants = [for (final e in items.entries) opt.Want(e.key, e.value)];
    final r = opt.optimize(inputs, wants);
    ComparePlan conv(opt.Plan p, String label) => ComparePlan(
      label: label,
      marketIds: p.marketIds,
      missing: p.missing,
      itemsCents: p.itemsCents,
      deliveryCents: p.deliveryCents,
      etaMax: p.etaMax,
      route: bestRoute({for (final id in p.marketIds) id: coords[id]!}, home),
      lines: [
        for (final l in p.lines)
          CompareLine(key: l.key, qty: l.qty, marketId: l.marketId, productId: l.productId, unitCents: l.unitCents),
      ],
    );
    return CompareResult(
      averageItemsCents: 0,
      markets: [
        for (final m in markets)
          CompareMarket(
            id: m.id,
            name: m.name,
            imageUrl: m.imageUrl,
            distanceKm: m.distanceKm,
            address: m.address,
            deliveryFeeCents: m.deliveryFeeCents,
            etaMax: m.etaMax,
          ),
      ],
      rows: [
        for (final e in items.entries)
          CompareRow(
            key: e.key,
            qty: e.value,
            name: info[e.key] == null
                ? e.key.split('|').first
                : e.key.contains('#')
                ? '${info[e.key].name} ${info[e.key].brand}'
                : info[e.key].name as String,
            unit: info[e.key]?.unit as String? ?? e.key.split('|').last.split('#').first,
            imageUrl: info[e.key]?.imageUrl as String?,
            prices: {
              for (final m in markets)
                if (offers[m.id]![e.key] != null && offers[m.id]![e.key]!.stock >= e.value)
                  m.id: offers[m.id]![e.key]!.priceCents,
            },
          ),
      ],
      plans: [
        if (r.cheapest != null) conv(r.cheapest!, 'cheapest'),
        if (r.single != null && r.single != r.cheapest) conv(r.single!, 'single'),
      ],
    );
  }
}
