import 'catalog.dart';

class StoreCategory {
  const StoreCategory({required this.category, required this.count, this.onSale = 0});

  final Category category;
  final int count;
  final int onSale;

  factory StoreCategory.fromJson(Map<String, dynamic> j) =>
      StoreCategory(category: Category.fromJson(j), count: j['count'] as int? ?? 0, onSale: j['on_sale'] as int? ?? 0);
}

class MarketDetails {
  const MarketDetails({required this.market, required this.categories});

  final Market market;
  final List<StoreCategory> categories;
}

class Review {
  const Review({required this.id, required this.rating, required this.author, required this.createdAt, this.comment});

  final String id;
  final int rating;
  final String author;
  final String? comment;
  final DateTime createdAt;

  factory Review.fromJson(Map<String, dynamic> j) => Review(
    id: j['id'] as String,
    rating: j['rating'] as int,
    author: j['author'] as String? ?? 'Cliente',
    comment: j['comment'] as String?,
    createdAt: DateTime.parse(j['created_at'] as String).toLocal(),
  );
}

class ReviewPage {
  const ReviewPage({
    required this.average,
    required this.count,
    required this.byStar,
    required this.items,
    this.nextOffset,
  });

  final double? average;
  final int count;
  final Map<int, int> byStar;
  final List<Review> items;
  final int? nextOffset;
}

/// Mesmo produto em outro mercado (para comparar preço).
class PriceOption {
  const PriceOption({
    required this.productId,
    required this.marketId,
    required this.marketName,
    required this.priceCents,
    this.inStock = true,
  });

  final String productId;
  final String marketId;
  final String marketName;
  final int priceCents;
  final bool inStock;
}

class ProductDetails {
  const ProductDetails({
    required this.product,
    this.description,
    this.marketImageUrl,
    this.marketOpen = true,
    this.deliveryFeeCents = 0,
    this.compare = const [],
  });

  final Product product;
  final String? description;
  final String? marketImageUrl;
  final bool marketOpen;
  final int deliveryFeeCents;
  final List<PriceOption> compare;

  /// Menor preço entre este e os outros mercados (com estoque).
  int get bestPriceCents => [
    if (product.inStock) product.finalPriceCents,
    ...compare.where((o) => o.inStock).map((o) => o.priceCents),
  ].fold(product.finalPriceCents, (a, b) => b < a ? b : a);

  bool get isBestHere => product.finalPriceCents <= bestPriceCents;
}
