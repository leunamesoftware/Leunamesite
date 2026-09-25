import '../../services/api_client.dart';
import '../mock/mock_data.dart';
import '../models/catalog.dart';
import '../models/store.dart';
import 'catalog_repository.dart';

abstract interface class StoreRepository {
  Future<MarketDetails> market(String id, {double? lat, double? lng});
  Future<ReviewPage> reviews(String marketId, {int offset = 0, int? stars});
  Future<ProductDetails> product(String id);
}

class ApiStoreRepository implements StoreRepository {
  ApiStoreRepository(this._api);

  final ApiClient _api;

  @override
  Future<MarketDetails> market(String id, {double? lat, double? lng}) async {
    final coords = lat == null || lng == null ? '' : '?lat=${lat.toStringAsFixed(5)}&lng=${lng.toStringAsFixed(5)}';
    final j = await _api.get('/markets/${Uri.encodeComponent(id)}$coords');
    return MarketDetails(
      market: Market.fromJson(j['market'] as Map<String, dynamic>),
      categories: (j['categories'] as List).cast<Map<String, dynamic>>().map(StoreCategory.fromJson).toList(),
    );
  }

  @override
  Future<ReviewPage> reviews(String marketId, {int offset = 0, int? stars}) async {
    final j = await _api.get(
      '/markets/${Uri.encodeComponent(marketId)}/reviews?offset=$offset${stars == null ? '' : '&stars=$stars'}',
    );
    final s = j['summary'] as Map<String, dynamic>;
    return ReviewPage(
      average: (s['average'] as num?)?.toDouble(),
      count: s['count'] as int? ?? 0,
      byStar: {for (final e in (s['by_star'] as Map<String, dynamic>).entries) int.parse(e.key): e.value as int},
      items: (j['items'] as List).cast<Map<String, dynamic>>().map(Review.fromJson).toList(),
      nextOffset: j['next_offset'] as int?,
    );
  }

  @override
  Future<ProductDetails> product(String id) async {
    final j = await _api.get('/products/${Uri.encodeComponent(id)}');
    final p = j['product'] as Map<String, dynamic>;
    return ProductDetails(
      product: Product.fromJson(p),
      description: p['description'] as String?,
      marketImageUrl: p['market_image_url'] as String?,
      marketOpen: p['market_open'] == true,
      deliveryFeeCents: p['delivery_fee_cents'] as int? ?? 0,
      compare: (j['compare'] as List)
          .cast<Map<String, dynamic>>()
          .map(
            (o) => PriceOption(
              productId: o['id'] as String,
              marketId: o['market_id'] as String,
              marketName: o['market_name'] as String,
              priceCents: (o['promo_price_cents'] ?? o['price_cents']) as int,
              inStock: (o['stock'] as int? ?? 0) > 0,
            ),
          )
          .toList(),
    );
  }
}

class MockStoreRepository implements StoreRepository {
  MockStoreRepository(this._catalog);

  final CatalogRepository _catalog;

  static const _descriptions = {
    'p1': 'Banana prata selecionada, madura no ponto. Vendida por quilo.',
    'p3': 'Arroz branco tipo 1, grãos longos e soltinhos.',
    'p9': 'Arroz branco tipo 1, grãos longos e soltinhos.',
    'p5': 'Corte bovino macio, ideal para grelhados e churrasco.',
  };

  static final _reviews = [
    Review(
      id: 'r1',
      rating: 5,
      author: 'Ana S.',
      comment: 'Entrega rápida e produtos bem escolhidos.',
      createdAt: DateTime(2026, 9, 20, 15),
    ),
    Review(
      id: 'r2',
      rating: 4,
      author: 'Bruno L.',
      comment: 'Faltou um item, mas avisaram antes e deram opção de troca.',
      createdAt: DateTime(2026, 9, 18, 9),
    ),
    Review(
      id: 'r3',
      rating: 5,
      author: 'Carla D.',
      comment: 'Frutas e verduras sempre fresquinhas.',
      createdAt: DateTime(2026, 9, 15, 7),
    ),
    Review(
      id: 'r4',
      rating: 3,
      author: 'Diego M.',
      comment: 'Demorou um pouco mais que o previsto.',
      createdAt: DateTime(2026, 9, 10, 19),
    ),
  ];

  @override
  Future<MarketDetails> market(String id, {double? lat, double? lng}) async {
    final markets = await _catalog.markets(lat: lat, lng: lng);
    final m = markets.firstWhere(
      (m) => m.id == id,
      orElse: () => throw const ApiException(404, 'not_found', 'Mercado não encontrado.'),
    );
    final products = MockData.products.where((p) => p.marketId == id);
    final cats = [
      for (final c in MockData.categories)
        if (products.any((p) => p.categoryId == c.id))
          StoreCategory(
            category: c,
            count: products.where((p) => p.categoryId == c.id).length,
            onSale: products.where((p) => p.categoryId == c.id && p.onSale).length,
          ),
    ];
    return MarketDetails(market: m, categories: cats);
  }

  @override
  Future<ReviewPage> reviews(String marketId, {int offset = 0, int? stars}) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final by = {for (var s = 1; s <= 5; s++) s: _reviews.where((r) => r.rating == s).length};
    final avg = _reviews.fold<int>(0, (s, r) => s + r.rating) / _reviews.length;
    return ReviewPage(
      average: (avg * 10).round() / 10,
      count: _reviews.length,
      byStar: by,
      items: offset == 0 ? _reviews.where((r) => stars == null || r.rating == stars).toList() : const [],
    );
  }

  @override
  Future<ProductDetails> product(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final base = MockData.products.firstWhere(
      (p) => p.id == id,
      orElse: () => throw const ApiException(404, 'not_found', 'Produto não encontrado.'),
    );
    final market = MockData.markets.firstWhere((m) => m.id == base.marketId);
    final key = '${base.name.toLowerCase()}|${base.unit.replaceAll(' ', '').toLowerCase()}';
    final others =
        MockData.products
            .where((p) => p.id != id && '${p.name.toLowerCase()}|${p.unit.replaceAll(' ', '').toLowerCase()}' == key)
            .map(
              (p) => PriceOption(
                productId: p.id,
                marketId: p.marketId,
                marketName: MockData.markets.firstWhere((m) => m.id == p.marketId).name,
                priceCents: p.finalPriceCents,
                inStock: p.inStock,
              ),
            )
            .toList()
          ..sort((a, b) => a.priceCents.compareTo(b.priceCents));
    return ProductDetails(
      product: (await _catalog.products(ProductQuery(marketId: base.marketId, limit: 50))).items
          .firstWhere((p) => p.id == id),
      description: _descriptions[id],
      marketImageUrl: market.imageUrl,
      marketOpen: market.isOpen,
      deliveryFeeCents: market.deliveryFeeCents,
      compare: others,
    );
  }
}
