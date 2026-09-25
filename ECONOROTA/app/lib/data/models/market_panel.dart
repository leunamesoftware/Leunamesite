/// Painel do supermercado (Fase 8).
library;

import '../../core/utils/format.dart';

class PanelMarket {
  const PanelMarket({
    required this.id,
    required this.name,
    required this.isOpen,
    required this.opensAt,
    required this.closesAt,
    this.imageUrl,
    this.pixKey,
  });

  final String id;
  final String name;
  final bool isOpen;
  final String opensAt;
  final String closesAt;
  final String? imageUrl;

  /// Chave Pix para receber os repasses.
  final String? pixKey;

  factory PanelMarket.fromJson(Map<String, dynamic> j) => PanelMarket(
    id: j['id'] as String,
    name: j['name'] as String,
    isOpen: (j['is_open'] as num? ?? 0) == 1,
    opensAt: j['opens_at'] as String? ?? '07:00',
    closesAt: j['closes_at'] as String? ?? '22:00',
    imageUrl: j['image_url'] as String?,
    pixKey: j['pix_key'] as String?,
  );

  PanelMarket copyWith({bool? isOpen, String? opensAt, String? closesAt, String? pixKey}) => PanelMarket(
    id: id,
    name: name,
    isOpen: isOpen ?? this.isOpen,
    opensAt: opensAt ?? this.opensAt,
    closesAt: closesAt ?? this.closesAt,
    imageUrl: imageUrl,
    pixKey: pixKey ?? this.pixKey,
  );
}

/// Dados cadastrais da loja (necessários para aprovação e para aparecer nas buscas).
class StoreProfile {
  const StoreProfile({
    required this.name,
    required this.status,
    required this.opensAt,
    required this.closesAt,
    this.document,
    this.phone,
    this.address,
    this.district,
    this.city,
    this.state,
    this.lat,
    this.lng,
    this.etaMin = 20,
    this.pixKey,
    this.missing = const [],
  });

  final String name;

  /// pendente · ativo · suspenso
  final String status;
  final String opensAt;
  final String closesAt;
  final String? document;
  final String? phone;
  final String? address;
  final String? district;
  final String? city;
  final String? state;
  final double? lat;
  final double? lng;

  /// Tempo médio para separar um pedido (minutos).
  final int etaMin;
  final String? pixKey;

  /// document · address · location · pix_key
  final List<String> missing;

  static const missingLabels = {
    'document': 'CNPJ',
    'address': 'endereço',
    'location': 'localização no mapa',
    'pix_key': 'chave Pix',
  };

  factory StoreProfile.fromJson(Map<String, dynamic> j) => StoreProfile(
    name: j['name'] as String,
    status: j['status'] as String? ?? 'ativo',
    opensAt: j['opens_at'] as String? ?? '07:00',
    closesAt: j['closes_at'] as String? ?? '22:00',
    document: j['document'] as String?,
    phone: j['phone'] as String?,
    address: j['address'] as String?,
    district: j['district'] as String?,
    city: j['city'] as String?,
    state: j['state'] as String?,
    lat: (j['lat'] as num?)?.toDouble(),
    lng: (j['lng'] as num?)?.toDouble(),
    etaMin: (j['eta_min'] as num?)?.toInt() ?? 20,
    pixKey: j['pix_key'] as String?,
    missing: (j['missing'] as List? ?? const []).cast<String>(),
  );
}

class PanelKpis {
  const PanelKpis({
    this.ordersToday = 0,
    this.revenueToday = 0,
    this.newOrders = 0,
    this.separating = 0,
    this.lowStock = 0,
    this.unavailable = 0,
    this.expiring = 0,
  });

  final int ordersToday;
  final int revenueToday;
  final int newOrders;
  final int separating;
  final int lowStock;
  final int unavailable;
  final int expiring;

  factory PanelKpis.fromJson(Map<String, dynamic> j) => PanelKpis(
    ordersToday: j['orders_today'] as int? ?? 0,
    revenueToday: j['revenue_today'] as int? ?? 0,
    newOrders: j['new_orders'] as int? ?? 0,
    separating: j['separating'] as int? ?? 0,
    lowStock: j['low_stock'] as int? ?? 0,
    unavailable: j['unavailable'] as int? ?? 0,
    expiring: j['expiring'] as int? ?? 0,
  );
}

class PanelCategory {
  const PanelCategory({required this.id, required this.name, required this.products});

  final String id;
  final String name;
  final int products;

  factory PanelCategory.fromJson(Map<String, dynamic> j) =>
      PanelCategory(id: j['id'] as String, name: j['name'] as String, products: j['products'] as int? ?? 0);
}

enum StockLevel { ok, low, out }

class PanelProduct {
  const PanelProduct({
    required this.id,
    required this.categoryId,
    required this.name,
    required this.unit,
    required this.priceCents,
    required this.stock,
    required this.minStock,
    this.brand,
    this.barcode,
    this.promoPriceCents,
    this.active = true,
    this.imageUrl,
    this.description,
    this.expiresOn,
  });

  final String id;
  final String categoryId;
  final String name;
  final String? brand;
  final String unit;
  final String? barcode;
  final int priceCents;
  final int? promoPriceCents;
  final int stock;
  final int minStock;
  final bool active;
  final String? imageUrl;
  final String? description;
  final DateTime? expiresOn;

  StockLevel get level => stock == 0
      ? StockLevel.out
      : stock <= minStock
      ? StockLevel.low
      : StockLevel.ok;

  /// Vence em até 3 dias (ou já venceu).
  bool get expiringSoon => expiresOn != null && expiresOn!.difference(DateTime.now()).inHours < 72;

  factory PanelProduct.fromJson(Map<String, dynamic> j) => PanelProduct(
    id: j['id'] as String,
    categoryId: j['category_id'] as String,
    name: j['name'] as String,
    brand: j['brand'] as String?,
    unit: j['unit'] as String? ?? 'un',
    barcode: j['barcode'] as String?,
    priceCents: j['price_cents'] as int,
    promoPriceCents: j['promo_price_cents'] as int?,
    stock: j['stock'] as int? ?? 0,
    minStock: j['min_stock'] as int? ?? 0,
    active: (j['is_active'] as num? ?? 1) == 1,
    imageUrl: j['image_url'] as String?,
    description: j['description'] as String?,
    expiresOn: j['expires_on'] == null ? null : DateTime.tryParse(j['expires_on'] as String),
  );

  PanelProduct copyWith({int? stock, bool? active}) => PanelProduct(
    id: id,
    categoryId: categoryId,
    name: name,
    brand: brand,
    unit: unit,
    barcode: barcode,
    priceCents: priceCents,
    promoPriceCents: promoPriceCents,
    stock: stock ?? this.stock,
    minStock: minStock,
    active: active ?? this.active,
    imageUrl: imageUrl,
    description: description,
    expiresOn: expiresOn,
  );
}

/// Dados do formulário de produto (cadastro e edição).
class ProductDraft {
  const ProductDraft({
    required this.name,
    required this.unit,
    required this.categoryId,
    required this.priceCents,
    this.brand,
    this.promoPriceCents,
    this.stock = 0,
    this.minStock = 0,
    this.barcode,
    this.description,
    this.expiresOn,
  });

  final String name;
  final String? brand;
  final String unit;
  final String categoryId;
  final int priceCents;
  final int? promoPriceCents;
  final int stock;
  final int minStock;
  final String? barcode;
  final String? description;
  final DateTime? expiresOn;

  Map<String, dynamic> toJson({bool withStock = false}) => {
    'name': name,
    'brand': brand,
    'unit': unit,
    'category_id': categoryId,
    'price_cents': priceCents,
    'promo_price_cents': promoPriceCents,
    'min_stock': minStock,
    'barcode': barcode,
    'description': description,
    'expires_on': expiresOn?.toIso8601String().substring(0, 10),
    if (withStock) 'stock': stock,
  };
}

enum StockMoveType {
  entrada('Entrada'),
  saida('Saída'),
  ajuste('Ajuste'),
  venda('Venda'),
  estorno('Estorno');

  const StockMoveType(this.label);
  final String label;
}

class StockMove {
  const StockMove({
    required this.productName,
    required this.type,
    required this.quantity,
    required this.createdAt,
    this.stockAfter,
    this.reason,
  });

  final String productName;
  final StockMoveType type;
  final int quantity;
  final int? stockAfter;
  final String? reason;
  final DateTime createdAt;

  factory StockMove.fromJson(Map<String, dynamic> j) => StockMove(
    productName: j['product_name'] as String,
    type: StockMoveType.values.byName(j['type'] as String),
    quantity: j['quantity'] as int,
    stockAfter: j['stock_after'] as int?,
    reason: j['reason'] as String?,
    createdAt: DateTime.parse(j['created_at'] as String).toLocal(),
  );
}

enum PanelOrderGroup {
  news('novos', 'Novos'),
  separating('separacao', 'Separação'),
  ready('prontos', 'Prontos'),
  history('historico', 'Histórico');

  const PanelOrderGroup(this.apiValue, this.label);
  final String apiValue;
  final String label;
}

class PanelOrder {
  const PanelOrder({
    required this.id,
    required this.orderId,
    required this.status,
    required this.subtotalCents,
    required this.createdAt,
    this.itemCount = 0,
    this.marketCount = 1,
    this.sequence = 1,
  });

  final String id;
  final String orderId;

  /// novo → em_separacao → conferido → pronto (ou cancelado).
  final String status;
  final int subtotalCents;
  final DateTime createdAt;
  final int itemCount;
  final int marketCount;

  /// Ordem de coleta do entregador neste pedido (1, 2 ou 3).
  final int sequence;

  String get code => shortCode(orderId);

  String get statusLabel => switch (status) {
    'novo' => 'Novo',
    'em_separacao' => 'Em separação',
    'conferido' => 'Conferido',
    'pronto' => 'Pronto',
    'retirado' => 'Retirado',
    'entregue' => 'Entregue',
    'cancelado' => 'Cancelado',
    _ => status,
  };

  factory PanelOrder.fromJson(Map<String, dynamic> j) => PanelOrder(
    id: j['id'] as String,
    orderId: j['order_id'] as String,
    status: j['status'] as String,
    subtotalCents: j['subtotal_cents'] as int? ?? 0,
    createdAt: DateTime.parse(j['created_at'] as String).toLocal(),
    itemCount: j['item_count'] as int? ?? 0,
    marketCount: j['market_count'] as int? ?? 1,
    sequence: j['sequence'] as int? ?? 1,
  );
}

class PanelOrderItem {
  const PanelOrderItem({
    required this.id,
    required this.name,
    required this.unitPriceCents,
    required this.quantity,
    this.imageUrl,
    this.barcode,
    this.checked,
    this.cold = false,
  });

  final String id;
  final String name;
  final int unitPriceCents;
  final int quantity;
  final String? imageUrl;
  final String? barcode;

  /// null: não conferido · true: ok · false: em falta.
  final bool? checked;

  /// Refrigerado: a lista traz esses itens por último (menos tempo fora da geladeira).
  final bool cold;

  factory PanelOrderItem.fromJson(Map<String, dynamic> j) => PanelOrderItem(
    id: j['id'] as String,
    name: j['name'] as String,
    unitPriceCents: j['unit_price_cents'] as int,
    quantity: j['quantity'] as int,
    imageUrl: j['image_url'] as String?,
    barcode: j['barcode'] as String?,
    checked: j['checked'] == null ? null : (j['checked'] as num) == 1,
    cold: (j['cold'] as num? ?? 0) == 1,
  );
}

class PanelFinance {
  const PanelFinance({
    required this.days,
    required this.commissionPct,
    required this.orders,
    required this.grossCents,
    required this.commissionCents,
    required this.netCents,
    required this.byDay,
  });

  final int days;
  final int commissionPct;
  final int orders;
  final int grossCents;
  final int commissionCents;
  final int netCents;
  final List<({DateTime day, int orders, int grossCents, int netCents})> byDay;

  factory PanelFinance.fromJson(Map<String, dynamic> j) => PanelFinance(
    days: j['days'] as int,
    commissionPct: (j['commission_pct'] as num).round(),
    orders: j['orders'] as int? ?? 0,
    grossCents: j['gross_cents'] as int? ?? 0,
    commissionCents: j['commission_cents'] as int? ?? 0,
    netCents: j['net_cents'] as int? ?? 0,
    byDay: [
      for (final d in (j['by_day'] as List).cast<Map<String, dynamic>>())
        (
          day: DateTime.parse(d['day'] as String),
          orders: d['orders'] as int,
          grossCents: d['gross_cents'] as int,
          netCents: d['net_cents'] as int,
        ),
    ],
  );
}
