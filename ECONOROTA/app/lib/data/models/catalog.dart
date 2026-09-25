import 'package:flutter/material.dart';

Color _hex(String? v, Color fallback) {
  if (v == null || !RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(v)) return fallback;
  return Color(int.parse('FF${v.substring(1)}', radix: 16));
}

class Category {
  const Category({required this.id, required this.name, required this.icon, this.color = const Color(0xFF6A1FC2)});

  final String id;
  final String name;
  final String icon;
  final Color color;

  factory Category.fromJson(Map<String, dynamic> j) => Category(
    id: j['id'] as String,
    name: j['name'] as String,
    icon: j['icon'] as String? ?? 'category',
    color: _hex(j['color'] as String?, const Color(0xFF6A1FC2)),
  );
}

class Market {
  const Market({
    required this.id,
    required this.name,
    required this.rating,
    this.ratingCount = 0,
    this.distanceKm,
    this.address = '',
    this.district,
    this.imageUrl,
    this.isOpen = true,
    this.deliveryFeeCents = 0,
    this.minOrderCents = 0,
    this.etaMin = 30,
    this.etaMax = 45,
    this.opensAt = '07:00',
    this.closesAt = '22:00',
    this.lat,
    this.lng,
  });

  final String id;
  final String name;
  final String address;
  final String? district;
  final String? imageUrl;
  final double? distanceKm;
  final double rating;
  final int ratingCount;
  final bool isOpen;
  final int deliveryFeeCents;
  final int minOrderCents;
  final int etaMin;
  final int etaMax;
  final String opensAt;
  final String closesAt;
  final double? lat;
  final double? lng;

  String get eta => '$etaMin–$etaMax min';

  factory Market.fromJson(Map<String, dynamic> j) => Market(
    id: j['id'] as String,
    name: j['name'] as String,
    address: j['address'] as String? ?? '',
    district: j['district'] as String?,
    imageUrl: j['image_url'] as String?,
    distanceKm: (j['distance_km'] as num?)?.toDouble(),
    rating: (j['rating'] as num?)?.toDouble() ?? 0,
    ratingCount: j['rating_count'] as int? ?? 0,
    isOpen: j['is_open'] == true || j['is_open'] == 1,
    deliveryFeeCents: j['delivery_fee_cents'] as int? ?? 0,
    minOrderCents: j['min_order_cents'] as int? ?? 0,
    etaMin: j['eta_min'] as int? ?? 30,
    etaMax: j['eta_max'] as int? ?? 45,
    opensAt: j['opens_at'] as String? ?? '07:00',
    closesAt: j['closes_at'] as String? ?? '22:00',
    lat: (j['lat'] as num?)?.toDouble(),
    lng: (j['lng'] as num?)?.toDouble(),
  );
}

class Product {
  const Product({
    required this.id,
    required this.marketId,
    required this.categoryId,
    required this.name,
    required this.unit,
    required this.priceCents,
    required this.stock,
    this.promoPriceCents,
    this.brand,
    this.imageUrl,
    this.marketName,
    this.subcategory,
    this.categoryName,
  });

  final String id;
  final String marketId;
  final String categoryId;
  final String name;
  final String? brand;
  final String unit;
  final String? imageUrl;
  final String? marketName;
  final String? subcategory;
  final String? categoryName;
  final int priceCents;
  final int? promoPriceCents;
  final int stock;

  int get finalPriceCents => promoPriceCents ?? priceCents;
  bool get inStock => stock > 0;
  bool get onSale => promoPriceCents != null && promoPriceCents! < priceCents;

  /// Desconto em % (arredondado), 0 quando não está em oferta.
  int get discountPct => onSale ? (((priceCents - promoPriceCents!) / priceCents) * 100).round() : 0;

  /// Preço por kg ou litro (ex.: "R$ 5,18/kg"), quando a unidade permite calcular.
  ({int cents, String per})? get unitPrice {
    final m = RegExp(r'^\s*([\d.,]+)\s*(kg|g|l|ml)\s*$', caseSensitive: false).firstMatch(unit);
    if (m == null) return null;
    final qty = double.tryParse(m.group(1)!.replaceAll(',', '.'));
    if (qty == null || qty <= 0) return null;
    final u = m.group(2)!.toLowerCase();
    final base = switch (u) {
      'g' => qty / 1000,
      'ml' => qty / 1000,
      _ => qty,
    };
    return (cents: (finalPriceCents / base).round(), per: u == 'g' || u == 'kg' ? 'kg' : 'L');
  }

  /// "Marca · 5 kg" ou só a unidade.
  String get detail => [if (brand?.isNotEmpty ?? false) brand, unit].join(' · ');

  factory Product.fromJson(Map<String, dynamic> j) => Product(
    id: j['id'] as String,
    marketId: j['market_id'] as String,
    categoryId: j['category_id'] as String,
    name: j['name'] as String,
    brand: j['brand'] as String?,
    unit: j['unit'] as String? ?? 'un',
    imageUrl: j['image_url'] as String?,
    marketName: j['market_name'] as String?,
    subcategory: j['subcategory'] as String?,
    categoryName: j['category_name'] as String?,
    priceCents: j['price_cents'] as int,
    promoPriceCents: j['promo_price_cents'] as int?,
    stock: j['stock'] as int? ?? 0,
  );
}

/// Página de resultados com paginação por deslocamento.
class ResultPage<T> {
  const ResultPage(this.items, [this.nextOffset]);

  final List<T> items;
  final int? nextOffset;
}
