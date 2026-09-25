import '../../core/compare/compare_key.dart';
import '../../core/compare/route.dart';
import '../../core/compare/rules.dart' as rules;

/// Produto genérico (sem mercado) para montar a lista de compras.
class CatalogItem {
  const CatalogItem({
    required this.key,
    required this.name,
    required this.unit,
    required this.categoryId,
    required this.minPriceCents,
    required this.markets,
    this.imageUrl,
    this.brands = const [],
  });

  final String key;

  /// Marcas disponíveis deste produto (lista inteligente).
  final List<String> brands;
  final String name;
  final String unit;
  final String categoryId;
  final String? imageUrl;
  final int minPriceCents;
  final int markets;

  factory CatalogItem.fromJson(Map<String, dynamic> j) => CatalogItem(
    key: j['key'] as String? ?? compareKey(j['name'] as String, j['unit'] as String),
    name: j['name'] as String,
    unit: j['unit'] as String,
    categoryId: j['category_id'] as String,
    imageUrl: j['image_url'] as String?,
    minPriceCents: j['min_price_cents'] as int,
    markets: j['markets'] as int? ?? 1,
    brands: (j['brands'] as List?)?.cast<String>() ?? const [],
  );
}

/// Linha da lista inteligente já interpretada.
class SmartLine {
  const SmartLine({
    required this.line,
    required this.qty,
    required this.options,
    this.brand,
    this.brandFound = true,
    this.size,
  });

  final String line;
  final int qty;

  /// Marca escrita pelo cliente (nunca é trocada sem ele escolher).
  final String? brand;
  final bool brandFound;
  final String? size;

  /// Produtos compatíveis, o mais comum primeiro. Vazio = não encontrado.
  final List<CatalogItem> options;

  factory SmartLine.fromJson(Map<String, dynamic> j) => SmartLine(
    line: j['line'] as String,
    qty: j['qty'] as int? ?? 1,
    brand: j['brand'] as String?,
    brandFound: j['brand_found'] as bool? ?? true,
    size: j['size'] as String?,
    options: (j['options'] as List).cast<Map<String, dynamic>>().map(CatalogItem.fromJson).toList(),
  );
}

class CompareMarket {
  const CompareMarket({
    required this.id,
    required this.name,
    required this.deliveryFeeCents,
    required this.etaMax,
    this.imageUrl,
    this.distanceKm,
    this.address,
  });

  final String id;
  final String name;
  final String? imageUrl;
  final String? address;
  final double? distanceKm;
  final int deliveryFeeCents;
  final int etaMax;
}

class CompareRow {
  const CompareRow({
    required this.key,
    required this.name,
    required this.unit,
    required this.qty,
    required this.prices,
    this.imageUrl,
    this.outOfStock = const {},
  });

  final String key;
  final String name;
  final String unit;
  final String? imageUrl;
  final int qty;

  /// Preço por mercado (só onde há estoque para a quantidade pedida).
  final Map<String, int> prices;

  /// Mercados que vendem o produto, mas estão sem estoque para a quantidade pedida.
  final Set<String> outOfStock;

  int? get worst => prices.isEmpty ? null : prices.values.reduce((a, b) => a > b ? a : b);
  int? get average => prices.isEmpty ? null : (prices.values.reduce((a, b) => a + b) / prices.length).round();

  int? get best => prices.isEmpty ? null : prices.values.reduce((a, b) => a < b ? a : b);
  String? get bestMarketId => prices.isEmpty ? null : prices.entries.reduce((a, b) => a.value <= b.value ? a : b).key;
}

class CompareLine {
  const CompareLine({
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

class ComparePlan {
  const ComparePlan({
    required this.label,
    required this.marketIds,
    required this.lines,
    required this.missing,
    required this.itemsCents,
    required this.deliveryCents,
    required this.etaMax,
    this.route,
  });

  final String label;
  final DeliveryRoute? route;
  final List<String> marketIds;
  final List<CompareLine> lines;
  final List<String> missing;
  final int itemsCents;
  final int deliveryCents;
  final int etaMax;

  int get totalCents => itemsCents + deliveryCents;
  List<CompareLine> linesOf(String marketId) => lines.where((l) => l.marketId == marketId).toList();
}

class CompareResult {
  const CompareResult({
    required this.markets,
    required this.rows,
    required this.plans,
    required this.averageItemsCents,
    this.maxMarkets = 3,
    this.minItems = 5,
    this.minOrderCents = 10000,
    this.deliveryBaseCents = rules.deliveryBaseCents,
    this.deliveryExtraCents = rules.deliveryExtraMarketCents,
  });

  final List<CompareMarket> markets;
  final List<CompareRow> rows;
  final List<ComparePlan> plans;
  final int averageItemsCents;
  final int maxMarkets;
  final int minItems;

  /// Pedido mínimo do EconoRota (produtos de todos os mercados somados).
  final int minOrderCents;

  /// Entrega única em vigor: base (1º mercado) + adicional por mercado extra.
  final int deliveryBaseCents;
  final int deliveryExtraCents;

  ComparePlan? get best => plans.isEmpty ? null : plans.first;
  ComparePlan? get single => plans.where((p) => p.marketIds.length == 1).firstOrNull;
  CompareMarket market(String id) => markets.firstWhere((m) => m.id == id);
  CompareRow row(String key) => rows.firstWhere((r) => r.key == key);

  /// Economia do melhor plano em relação ao preço médio dos mercados (itens encontrados).
  int get savingsVsAverage {
    final b = best;
    if (b == null) return 0;
    final avg = b.lines.fold<int>(0, (s, l) {
      final p = row(l.key).prices.values;
      return s + (p.isEmpty ? l.unitCents : (p.reduce((a, c) => a + c) / p.length).round()) * l.qty;
    });
    return avg - b.itemsCents;
  }
}
