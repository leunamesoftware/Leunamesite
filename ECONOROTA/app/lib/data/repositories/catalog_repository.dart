import 'dart:math' as math;

import '../../services/api_client.dart';
import '../mock/mock_data.dart';
import '../models/catalog.dart';

enum ProductSort {
  relevance('relevance', 'Relevância'),
  price('price', 'Menor preço'),
  discount('discount', 'Maior desconto');

  const ProductSort(this.apiValue, this.label);
  final String apiValue;
  final String label;
}

enum MarketSort {
  distance('distance', 'Menor distância'),
  rating('rating', 'Melhor avaliação'),
  fee('fee', 'Menor taxa');

  const MarketSort(this.apiValue, this.label);
  final String apiValue;
  final String label;
}

class ProductQuery {
  const ProductQuery({
    this.text,
    this.categoryId,
    this.marketId,
    this.onSale = false,
    this.sub,
    this.sort,
    this.limit = 20,
    this.offset = 0,
  });

  final String? text;
  final String? categoryId;
  final String? marketId;
  final bool onSale;
  final String? sub;
  final ProductSort? sort;
  final int limit;
  final int offset;

  ProductQuery page(int offset) => ProductQuery(
    text: text,
    categoryId: categoryId,
    marketId: marketId,
    onSale: onSale,
    sub: sub,
    sort: sort,
    limit: limit,
    offset: offset,
  );
}

typedef Suggestions = ({List<String> terms, List<Category> categories});

abstract interface class CatalogRepository {
  Future<List<Category>> categories();
  Future<List<Market>> markets({double? lat, double? lng, String? text, bool onlyOpen = false, MarketSort sort});
  Future<ResultPage<Product>> products(ProductQuery query);
  Future<Suggestions> suggest(String text);
  Future<List<String>> subcategories(String categoryId, {String? marketId});
}

class ApiCatalogRepository implements CatalogRepository {
  ApiCatalogRepository(this._api);

  final ApiClient _api;

  List<T> _list<T>(Map<String, dynamic> j, T Function(Map<String, dynamic>) f, [String key = 'items']) =>
      (j[key] as List).cast<Map<String, dynamic>>().map(f).toList();

  String _qs(Map<String, String?> params) {
    final clean = {
      for (final e in params.entries)
        if (e.value != null && e.value!.isNotEmpty) e.key: e.value!,
    };
    return clean.isEmpty ? '' : '?${Uri(queryParameters: clean).query}';
  }

  @override
  Future<List<Category>> categories() async => _list(await _api.get('/categories'), Category.fromJson);

  @override
  Future<List<Market>> markets({
    double? lat,
    double? lng,
    String? text,
    bool onlyOpen = false,
    MarketSort sort = MarketSort.distance,
  }) async => _list(
    await _api.get(
      '/markets${_qs({'lat': lat?.toStringAsFixed(5), 'lng': lng?.toStringAsFixed(5), 'q': text, 'open': onlyOpen ? '1' : null, 'sort': sort.apiValue})}',
    ),
    Market.fromJson,
  );

  @override
  Future<ResultPage<Product>> products(ProductQuery q) async {
    final j = await _api.get(
      '/products${_qs({'q': q.text, 'category_id': q.categoryId, 'market_id': q.marketId, 'on_sale': q.onSale ? '1' : null, 'sub': q.sub, 'sort': q.sort?.apiValue, 'limit': '${q.limit}', 'offset': '${q.offset}'})}',
    );
    return ResultPage(_list(j, Product.fromJson), j['next_offset'] as int?);
  }

  @override
  Future<List<String>> subcategories(String categoryId, {String? marketId}) async {
    final j = await _api.get(
      '/categories/${Uri.encodeComponent(categoryId)}/subcategories${_qs({'market_id': marketId})}',
    );
    return (j['items'] as List).map((e) => (e as Map<String, dynamic>)['name'] as String).toList();
  }

  @override
  Future<Suggestions> suggest(String text) async {
    final j = await _api.get('/search/suggest${_qs({'q': text})}');
    return (terms: (j['suggestions'] as List).cast<String>(), categories: _list(j, Category.fromJson, 'categories'));
  }
}

class MockCatalogRepository implements CatalogRepository {
  static const _latency = Duration(milliseconds: 350);

  static String _fold(String s) => s
      .toLowerCase()
      .replaceAll(RegExp('[áàâã]'), 'a')
      .replaceAll(RegExp('[éê]'), 'e')
      .replaceAll('í', 'i')
      .replaceAll(RegExp('[óôõ]'), 'o')
      .replaceAll('ú', 'u')
      .replaceAll('ç', 'c');

  static double _km(double lat1, double lng1, double lat2, double lng2) {
    const r = math.pi / 180;
    final a =
        math.pow(math.sin((lat2 - lat1) * r / 2), 2) +
        math.cos(lat1 * r) * math.cos(lat2 * r) * math.pow(math.sin((lng2 - lng1) * r / 2), 2);
    return 6371 * 2 * math.asin(math.sqrt(a));
  }

  final _names = {for (final m in MockData.markets) m.id: m.name};

  Product _withMarket(Product p) => Product(
    id: p.id,
    marketId: p.marketId,
    categoryId: p.categoryId,
    name: p.name,
    brand: p.brand,
    unit: p.unit,
    imageUrl: p.imageUrl,
    priceCents: p.priceCents,
    promoPriceCents: p.promoPriceCents,
    stock: p.stock,
    marketName: _names[p.marketId],
    subcategory: MockData.subcategoryOf(p),
    categoryName: MockData.categories.firstWhere((c) => c.id == p.categoryId).name,
  );

  @override
  Future<List<Category>> categories() async {
    await Future<void>.delayed(_latency);
    return MockData.categories;
  }

  @override
  Future<List<Market>> markets({
    double? lat,
    double? lng,
    String? text,
    bool onlyOpen = false,
    MarketSort sort = MarketSort.distance,
  }) async {
    await Future<void>.delayed(_latency);
    final here = (lat: lat ?? MockData.center.lat, lng: lng ?? MockData.center.lng);
    var list = [
      for (final m in MockData.markets)
        Market(
          id: m.id,
          name: m.name,
          address: m.address,
          district: m.district,
          imageUrl: m.imageUrl,
          rating: m.rating,
          ratingCount: m.ratingCount,
          isOpen: m.isOpen,
          deliveryFeeCents: m.deliveryFeeCents,
          minOrderCents: m.minOrderCents,
          etaMin: m.etaMin,
          etaMax: m.etaMax,
          opensAt: m.opensAt,
          closesAt: m.closesAt,
          lat: m.lat,
          lng: m.lng,
          distanceKm: (_km(here.lat, here.lng, m.lat!, m.lng!) * 10).round() / 10,
        ),
    ];
    final t = _fold(text ?? '');
    list = list.where((m) => (t.isEmpty || _fold(m.name).contains(t)) && (!onlyOpen || m.isOpen)).toList();
    int by(Market a, Market b) => switch (sort) {
      MarketSort.distance => a.distanceKm!.compareTo(b.distanceKm!),
      MarketSort.rating => b.rating.compareTo(a.rating),
      MarketSort.fee => a.deliveryFeeCents.compareTo(b.deliveryFeeCents),
    };
    list.sort((a, b) => a.isOpen == b.isOpen ? by(a, b) : (a.isOpen ? -1 : 1));
    return list;
  }

  @override
  Future<ResultPage<Product>> products(ProductQuery q) async {
    await Future<void>.delayed(_latency);
    final t = _fold(q.text?.trim() ?? '');
    final list = MockData.products
        .where((p) => t.isEmpty || _fold(p.name).contains(t) || _fold(p.brand ?? '').contains(t))
        .where((p) => q.categoryId == null || p.categoryId == q.categoryId)
        .where((p) => q.marketId == null || p.marketId == q.marketId)
        .where((p) => !q.onSale || p.onSale)
        .where((p) => q.sub == null || MockData.subcategoryOf(p) == q.sub)
        .map(_withMarket)
        .toList();
    final sort =
        q.sort ?? (t.isNotEmpty ? ProductSort.relevance : (q.onSale ? ProductSort.discount : ProductSort.price));
    int by(Product a, Product b) => switch (sort) {
      ProductSort.relevance =>
        (_fold(b.name).startsWith(t) ? 1 : 0) - (_fold(a.name).startsWith(t) ? 1 : 0) != 0
            ? (_fold(b.name).startsWith(t) ? 1 : 0) - (_fold(a.name).startsWith(t) ? 1 : 0)
            : b.discountPct.compareTo(a.discountPct),
      ProductSort.price => a.finalPriceCents.compareTo(b.finalPriceCents),
      ProductSort.discount => b.discountPct.compareTo(a.discountPct),
    };
    list.sort((a, b) => a.inStock == b.inStock ? by(a, b) : (a.inStock ? -1 : 1));
    final end = math.min(q.offset + q.limit, list.length);
    final page = q.offset >= list.length ? <Product>[] : list.sublist(q.offset, end);
    return ResultPage(page, end < list.length ? end : null);
  }

  @override
  Future<List<String>> subcategories(String categoryId, {String? marketId}) async {
    final counts = <String, int>{};
    for (final p in MockData.products.where(
      (p) => p.categoryId == categoryId && (marketId == null || p.marketId == marketId),
    )) {
      final s = MockData.subcategoryOf(p);
      if (s != null) counts[s] = (counts[s] ?? 0) + 1;
    }
    return (counts.keys.toList()..sort((a, b) => counts[b]!.compareTo(counts[a]!)));
  }

  @override
  Future<Suggestions> suggest(String text) async {
    await Future<void>.delayed(const Duration(milliseconds: 150));
    final t = _fold(text.trim());
    if (t.length < 2) return (terms: <String>[], categories: <Category>[]);
    final matches = MockData.products.where((p) => _fold(p.name).contains(t));
    final terms = matches.map((p) => p.name.toLowerCase()).toSet().take(8).toList();
    final catIds = matches.map((p) => p.categoryId).toSet();
    final cats = MockData.categories.where((c) => catIds.contains(c.id) || _fold(c.name).contains(t)).toList();
    return (terms: terms, categories: cats);
  }
}
