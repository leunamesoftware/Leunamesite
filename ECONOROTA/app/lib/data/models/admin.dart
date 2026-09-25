/// Painel administrativo (Fase 13).
library;

import '../../core/utils/format.dart';
import 'occurrence.dart';

DateTime? _dt(Object? v) => v == null ? null : DateTime.tryParse(v as String)?.toLocal();
int _i(Object? v) => (v as num?)?.toInt() ?? 0;
double _d(Object? v) => (v as num?)?.toDouble() ?? 0;
bool _b(Object? v) => v == true || v == 1;

/// Áreas da equipe administrativa.
enum AdminArea {
  operacao('Operação'),
  financeiro('Financeiro'),
  sistema('Sistema');

  const AdminArea(this.label);
  final String label;
}

class AdminSummary {
  const AdminSummary({required this.kpis, required this.byDay});

  final Map<String, int> kpis;
  final List<({DateTime day, int orders, int gmvCents})> byDay;

  int operator [](String k) => kpis[k] ?? 0;

  factory AdminSummary.fromJson(Map<String, dynamic> j) => AdminSummary(
    kpis: {for (final e in (j['kpis'] as Map<String, dynamic>).entries) e.key: _i(e.value)},
    byDay: [
      for (final d in (j['by_day'] as List).cast<Map<String, dynamic>>())
        (day: DateTime.parse(d['day'] as String), orders: _i(d['orders']), gmvCents: _i(d['gmv_cents'])),
    ],
  );
}

class AdminCustomer {
  const AdminCustomer({
    required this.id,
    required this.name,
    required this.email,
    required this.status,
    required this.createdAt,
    this.phone,
    this.rating = 0,
    this.orders = 0,
    this.spentCents = 0,
    this.occurrences = 0,
  });

  final String id;
  final String name;
  final String email;
  final String? phone;
  final String status;
  final DateTime createdAt;
  final double rating;
  final int orders;
  final int spentCents;
  final int occurrences;

  bool get blocked => status == 'bloqueado';

  factory AdminCustomer.fromJson(Map<String, dynamic> j) => AdminCustomer(
    id: j['id'] as String,
    name: j['name'] as String,
    email: j['email'] as String,
    phone: j['phone'] as String?,
    status: j['status'] as String,
    createdAt: _dt(j['created_at'])!,
    rating: _d(j['rating']),
    orders: _i(j['orders']),
    spentCents: _i(j['spent_cents']),
    occurrences: _i(j['occurrences']),
  );
}

class AdminMarket {
  const AdminMarket({
    required this.id,
    required this.name,
    required this.status,
    required this.ownerName,
    required this.ownerEmail,
    this.district,
    this.city,
    this.isOpen = false,
    this.rating = 0,
    this.ratingCount = 0,
    this.products = 0,
    this.orders30d = 0,
    this.sales30dCents = 0,
    this.imageUrl,
  });

  final String id;
  final String name;

  /// pendente · ativo · suspenso
  final String status;
  final String ownerName;
  final String ownerEmail;
  final String? district;
  final String? city;
  final bool isOpen;
  final double rating;
  final int ratingCount;
  final int products;
  final int orders30d;
  final int sales30dCents;
  final String? imageUrl;

  factory AdminMarket.fromJson(Map<String, dynamic> j) => AdminMarket(
    id: j['id'] as String,
    name: j['name'] as String,
    status: j['status'] as String,
    ownerName: j['owner_name'] as String? ?? '',
    ownerEmail: j['owner_email'] as String? ?? '',
    district: j['district'] as String?,
    city: j['city'] as String?,
    isOpen: _b(j['is_open']),
    rating: _d(j['rating']),
    ratingCount: _i(j['rating_count']),
    products: _i(j['products']),
    orders30d: _i(j['orders_30d']),
    sales30dCents: _i(j['sales_30d']),
    imageUrl: j['image_url'] as String?,
  );

  AdminMarket withStatus(String s) => AdminMarket(
    id: id,
    name: name,
    status: s,
    ownerName: ownerName,
    ownerEmail: ownerEmail,
    district: district,
    city: city,
    isOpen: s == 'suspenso' ? false : isOpen,
    rating: rating,
    ratingCount: ratingCount,
    products: products,
    orders30d: orders30d,
    sales30dCents: sales30dCents,
    imageUrl: imageUrl,
  );
}

class AdminCourier {
  const AdminCourier({
    required this.id,
    required this.name,
    required this.email,
    required this.status,
    this.phone,
    this.vehicleType,
    this.vehiclePlate,
    this.vehicleModel,
    this.vehicleColor,
    this.cnhNumber,
    this.birthDate,
    this.cpf,
    this.pixKey,
    this.submittedAt,
    this.reviewNote,
    this.isOnline = false,
    this.rating = 0,
    this.ratingCount = 0,
    this.deliveries = 0,
    this.hasDocument = false,
    this.hasVehicleDoc = false,
    this.workRadiusKm = 5,
  });

  final String id;
  final String name;
  final String email;
  final String? phone;

  /// pendente · aprovado · bloqueado
  final String status;
  final String? vehicleType;
  final String? vehiclePlate;
  final String? vehicleModel;
  final String? vehicleColor;
  final String? cnhNumber;
  final String? birthDate;
  final String? cpf;
  final String? pixKey;
  final DateTime? submittedAt;
  final String? reviewNote;
  final bool isOnline;
  final double rating;
  final int ratingCount;
  final int deliveries;
  final bool hasDocument;
  final bool hasVehicleDoc;
  final int workRadiusKm;

  bool get inReview => status == 'pendente' && submittedAt != null;
  bool get needsLicense => vehicleType == 'moto' || vehicleType == 'carro';

  String get statusLabel => switch (status) {
    'aprovado' => isOnline ? 'Disponível' : 'Aprovado',
    'bloqueado' => 'Bloqueado',
    _ => inReview ? 'Em análise' : 'Cadastro incompleto',
  };

  String get vehicleLabel => switch (vehicleType) {
    'moto' => 'Moto',
    'carro' => 'Carro',
    'bicicleta' => 'Bicicleta',
    _ => 'Veículo não informado',
  };

  factory AdminCourier.fromJson(Map<String, dynamic> j) => AdminCourier(
    id: j['id'] as String,
    name: j['name'] as String,
    email: j['email'] as String? ?? '',
    phone: j['phone'] as String?,
    status: j['status'] as String,
    vehicleType: j['vehicle_type'] as String?,
    vehiclePlate: j['vehicle_plate'] as String?,
    vehicleModel: j['vehicle_model'] as String?,
    vehicleColor: j['vehicle_color'] as String?,
    cnhNumber: j['cnh_number'] as String?,
    birthDate: j['birth_date'] as String?,
    cpf: j['cpf'] as String?,
    pixKey: j['pix_key'] as String?,
    submittedAt: _dt(j['submitted_at']),
    reviewNote: j['review_note'] as String?,
    isOnline: _b(j['is_online']),
    rating: _d(j['rating']),
    ratingCount: _i(j['rating_count']),
    deliveries: _i(j['deliveries']),
    hasDocument: _b(j['has_document']),
    hasVehicleDoc: _b(j['has_vehicle_doc']),
    workRadiusKm: _i(j['work_radius_km']),
  );
}

class AdminProduct {
  const AdminProduct({
    required this.id,
    required this.name,
    required this.unit,
    required this.marketName,
    required this.priceCents,
    required this.stock,
    required this.minStock,
    this.brand,
    this.promoPriceCents,
    this.active = true,
    this.expiresOn,
    this.imageUrl,
  });

  final String id;
  final String name;
  final String? brand;
  final String unit;
  final String marketName;
  final int priceCents;
  final int? promoPriceCents;
  final int stock;
  final int minStock;
  final bool active;
  final DateTime? expiresOn;
  final String? imageUrl;

  factory AdminProduct.fromJson(Map<String, dynamic> j) => AdminProduct(
    id: j['id'] as String,
    name: j['name'] as String,
    brand: j['brand'] as String?,
    unit: j['unit'] as String? ?? 'un',
    marketName: j['market_name'] as String? ?? '',
    priceCents: _i(j['price_cents']),
    promoPriceCents: (j['promo_price_cents'] as num?)?.toInt(),
    stock: _i(j['stock']),
    minStock: _i(j['min_stock']),
    active: _b(j['is_active']),
    expiresOn: j['expires_on'] == null ? null : DateTime.tryParse(j['expires_on'] as String),
    imageUrl: j['image_url'] as String?,
  );
}

String orderStatusLabel(String s) => switch (s) {
  'aguardando_pagamento' => 'Aguardando pagamento',
  'pago' => 'Pago',
  'em_separacao' => 'Em separação',
  'pronto_coleta' => 'Pronto para coleta',
  'em_rota' => 'A caminho',
  'entregue' => 'Entregue',
  'cancelado' => 'Cancelado',
  _ => s,
};

class AdminOrder {
  const AdminOrder({
    required this.id,
    required this.status,
    required this.totalCents,
    required this.createdAt,
    required this.customerName,
    required this.markets,
    this.courierName,
    this.paymentMethod,
    this.openOccurrences = 0,
  });

  final String id;
  final String status;
  final int totalCents;
  final DateTime createdAt;
  final String customerName;
  final String markets;
  final String? courierName;
  final String? paymentMethod;
  final int openOccurrences;

  String get code => shortCode(id);

  factory AdminOrder.fromJson(Map<String, dynamic> j) => AdminOrder(
    id: j['id'] as String,
    status: j['status'] as String,
    totalCents: _i(j['total_cents']),
    createdAt: _dt(j['created_at'])!,
    customerName: j['customer_name'] as String? ?? '',
    markets: j['markets'] as String? ?? '',
    courierName: j['courier_name'] as String?,
    paymentMethod: j['payment_method'] as String?,
    openOccurrences: _i(j['open_occurrences']),
  );
}

class AdminOrderDetail {
  const AdminOrderDetail({
    required this.order,
    required this.subtotalCents,
    required this.deliveryFeeCents,
    required this.customerEmail,
    required this.markets,
    required this.payments,
    required this.occurrences,
    this.address,
    this.customerPhone,
    this.cancelReason,
    this.paidAt,
    this.deliveredAt,
  });

  final AdminOrder order;
  final int subtotalCents;
  final int deliveryFeeCents;
  final String customerEmail;
  final String? customerPhone;
  final String? address;
  final String? cancelReason;
  final DateTime? paidAt;
  final DateTime? deliveredAt;
  final List<
    ({
      String name,
      int sequence,
      String status,
      int subtotalCents,
      List<({String name, int quantity, int unitPriceCents, bool? checked})> items,
    })
  >
  markets;
  final List<({String method, String status, int amountCents, int refundedCents, DateTime createdAt})> payments;
  final List<({String id, String type, String status, int refundCents})> occurrences;

  bool get cancellable =>
      const {'aguardando_pagamento', 'pago', 'em_separacao', 'pronto_coleta'}.contains(order.status);

  factory AdminOrderDetail.fromJson(Map<String, dynamic> j) {
    final a = j['delivery_address'] as Map<String, dynamic>?;
    return AdminOrderDetail(
      order: AdminOrder.fromJson({...j, 'markets': (j['markets'] as List).map((m) => (m as Map)['name']).join(', ')}),
      subtotalCents: _i(j['subtotal_cents']),
      deliveryFeeCents: _i(j['delivery_fee_cents']),
      customerEmail: j['customer_email'] as String? ?? '',
      customerPhone: j['customer_phone'] as String?,
      address: a == null
          ? null
          : [
              [a['street'], a['number']].whereType<String>().join(', '),
              a['district'],
              a['city'],
            ].whereType<String>().where((s) => s.isNotEmpty).join(' · '),
      cancelReason: j['cancel_reason'] as String?,
      paidAt: _dt(j['paid_at']),
      deliveredAt: _dt(j['delivered_at']),
      markets: [
        for (final m in (j['markets'] as List).cast<Map<String, dynamic>>())
          (
            name: m['name'] as String,
            sequence: _i(m['sequence']),
            status: m['status'] as String,
            subtotalCents: _i(m['subtotal_cents']),
            items: [
              for (final i in (m['items'] as List).cast<Map<String, dynamic>>())
                (
                  name: i['name'] as String,
                  quantity: _i(i['quantity']),
                  unitPriceCents: _i(i['unit_price_cents']),
                  checked: i['checked'] == null ? null : _b(i['checked']),
                ),
            ],
          ),
      ],
      payments: [
        for (final p in (j['payments'] as List).cast<Map<String, dynamic>>())
          (
            method: p['method'] as String? ?? '',
            status: p['status'] as String,
            amountCents: _i(p['amount_cents']),
            refundedCents: _i(p['refunded_cents']),
            createdAt: _dt(p['created_at'])!,
          ),
      ],
      occurrences: [
        for (final o in (j['occurrences'] as List).cast<Map<String, dynamic>>())
          (
            id: o['id'] as String,
            type: o['type'] as String,
            status: o['status'] as String,
            refundCents: _i(o['refund_cents']),
          ),
      ],
    );
  }
}

class AdminDelivery {
  const AdminDelivery({
    required this.orderId,
    required this.status,
    required this.stops,
    required this.picked,
    this.courierName,
    this.vehicleType,
    this.minutesLeft,
    this.late = false,
    this.gpsStale,
  });

  final String orderId;
  final String status;
  final int stops;
  final int picked;
  final String? courierName;
  final String? vehicleType;
  final int? minutesLeft;
  final bool late;
  final bool? gpsStale;

  factory AdminDelivery.fromJson(Map<String, dynamic> j) => AdminDelivery(
    orderId: j['id'] as String,
    status: j['status'] as String,
    stops: _i(j['stops']),
    picked: _i(j['picked']),
    courierName: j['courier_name'] as String?,
    vehicleType: j['vehicle_type'] as String?,
    minutesLeft: (j['minutes_left'] as num?)?.toInt(),
    late: _b(j['late']),
    gpsStale: j['gps_stale'] as bool?,
  );
}

class AdminRegion {
  const AdminRegion({
    required this.id,
    required this.name,
    required this.city,
    required this.state,
    required this.lat,
    required this.lng,
    required this.radiusKm,
    required this.active,
    this.markets = 0,
    this.couriersOnline = 0,
  });

  final String id;
  final String name;
  final String city;
  final String state;
  final double lat;
  final double lng;
  final double radiusKm;
  final bool active;
  final int markets;
  final int couriersOnline;

  factory AdminRegion.fromJson(Map<String, dynamic> j) => AdminRegion(
    id: j['id'] as String,
    name: j['name'] as String,
    city: j['city'] as String,
    state: j['state'] as String,
    lat: _d(j['lat']),
    lng: _d(j['lng']),
    radiusKm: _d(j['radius_km']),
    active: _b(j['is_active']),
    markets: _i(j['markets']),
    couriersOnline: _i(j['couriers_online']),
  );
}

class AdminRating {
  const AdminRating({
    required this.source,
    required this.id,
    required this.orderId,
    required this.fromRole,
    required this.fromName,
    required this.toType,
    required this.toName,
    required this.stars,
    required this.createdAt,
    this.comment,
    this.tags = const [],
    this.hidden = false,
  });

  /// loja (pública) ou interna.
  final String source;
  final String id;
  final String orderId;
  final String fromRole;
  final String fromName;
  final String toType;
  final String toName;
  final int stars;
  final String? comment;
  final List<String> tags;
  final bool hidden;
  final DateTime createdAt;

  factory AdminRating.fromJson(Map<String, dynamic> j) => AdminRating(
    source: j['source'] as String,
    id: j['id'] as String,
    orderId: j['order_id'] as String? ?? '',
    fromRole: j['from_role'] as String,
    fromName: j['from_name'] as String? ?? '',
    toType: j['to_type'] as String,
    toName: j['to_name'] as String? ?? '',
    stars: _i(j['stars']),
    comment: j['comment'] as String?,
    tags: (j['tags'] as List? ?? const []).cast<String>(),
    hidden: _b(j['hidden']),
    createdAt: _dt(j['created_at'])!,
  );
}

class AdminPayment {
  const AdminPayment({
    required this.id,
    required this.orderId,
    required this.method,
    required this.status,
    required this.amountCents,
    required this.createdAt,
    required this.customerName,
    this.refundedCents = 0,
    this.failureReason,
  });

  final String id;
  final String orderId;
  final String method;
  final String status;
  final int amountCents;
  final int refundedCents;
  final String? failureReason;
  final DateTime createdAt;
  final String customerName;

  factory AdminPayment.fromJson(Map<String, dynamic> j) => AdminPayment(
    id: j['id'] as String,
    orderId: j['order_id'] as String,
    method: j['method'] as String? ?? '',
    status: j['status'] as String,
    amountCents: _i(j['amount_cents']),
    refundedCents: _i(j['refunded_cents']),
    failureReason: j['failure_reason'] as String?,
    createdAt: _dt(j['created_at'])!,
    customerName: j['customer_name'] as String? ?? '',
  );
}

class AdminReport {
  const AdminReport({
    required this.days,
    required this.summary,
    required this.byDay,
    required this.byMarket,
    required this.topProducts,
    required this.delivered,
    required this.onTime,
    this.avgMinutes,
  });

  final int days;
  final Map<String, int> summary;
  final List<({DateTime day, int orders, int gmvCents})> byDay;
  final List<({String name, int orders, int salesCents})> byMarket;
  final List<({String name, int quantity, int salesCents})> topProducts;
  final int delivered;
  final int onTime;
  final double? avgMinutes;

  int operator [](String k) => summary[k] ?? 0;

  factory AdminReport.fromJson(Map<String, dynamic> j) {
    final d = j['delivery'] as Map<String, dynamic>? ?? const {};
    return AdminReport(
      days: _i(j['days']),
      summary: {for (final e in (j['summary'] as Map<String, dynamic>).entries) e.key: _i(e.value)},
      byDay: [
        for (final r in (j['by_day'] as List).cast<Map<String, dynamic>>())
          (day: DateTime.parse(r['day'] as String), orders: _i(r['orders']), gmvCents: _i(r['gmv_cents'])),
      ],
      byMarket: [
        for (final r in (j['by_market'] as List).cast<Map<String, dynamic>>())
          (name: r['name'] as String, orders: _i(r['orders']), salesCents: _i(r['sales_cents'])),
      ],
      topProducts: [
        for (final r in (j['top_products'] as List).cast<Map<String, dynamic>>())
          (name: r['name'] as String, quantity: _i(r['quantity']), salesCents: _i(r['sales_cents'])),
      ],
      delivered: _i(d['delivered']),
      onTime: _i(d['on_time']),
      avgMinutes: (d['avg_minutes'] as num?)?.toDouble(),
    );
  }
}

/// Configurações editáveis (valores inteiros; dinheiro em centavos).
class AdminSettings {
  const AdminSettings({required this.values, required this.limits});

  final Map<String, int> values;
  final Map<String, ({int min, int max, int def})> limits;

  /// Rótulo e unidade (money: centavos exibidos em R$; pct: %; days: dias).
  static const labels = {
    'min_order_cents': ('Pedido mínimo (total)', 'money'),
    'commission_pct': ('Comissão sobre vendas do mercado (%)', 'pct'),
    'courier_share_pct': ('Parte da entrega para o entregador (%)', 'pct'),
    'delivery_base_cents': ('Entrega única — 1 mercado', 'money'),
    'delivery_extra_market_cents': ('Adicional por mercado extra', 'money'),
    'market_hold_days': ('Prazo para liberar o valor do mercado (dias)', 'days'),
  };

  factory AdminSettings.fromJson(Map<String, dynamic> j) => AdminSettings(
    values: {for (final e in (j['settings'] as Map<String, dynamic>).entries) e.key: _i(e.value)},
    limits: {
      for (final e in (j['limits'] as Map<String, dynamic>).entries)
        e.key: (
          min: _i((e.value as Map)['min']),
          max: _i((e.value as Map)['max']),
          def: _i((e.value as Map)['default']),
        ),
    },
  );
}

class AdminMember {
  const AdminMember({
    required this.id,
    required this.name,
    required this.email,
    required this.status,
    required this.areas,
  });

  final String id;
  final String name;
  final String email;
  final String status;
  final Set<AdminArea> areas;

  factory AdminMember.fromJson(Map<String, dynamic> j) => AdminMember(
    id: j['id'] as String,
    name: j['name'] as String,
    email: j['email'] as String,
    status: j['status'] as String,
    areas: {
      for (final a in (j['permissoes'] as List? ?? const []).cast<String>())
        ...AdminArea.values.where((x) => x.name == a),
    },
  );
}

class AuditEntry {
  const AuditEntry({
    required this.action,
    required this.createdAt,
    this.entity,
    this.entityId,
    this.userName,
    this.userRole,
    this.data,
  });

  final String action;
  final String? entity;
  final String? entityId;
  final String? userName;
  final String? userRole;
  final Object? data;
  final DateTime createdAt;

  factory AuditEntry.fromJson(Map<String, dynamic> j) => AuditEntry(
    action: j['action'] as String,
    entity: j['entity'] as String?,
    entityId: j['entity_id'] as String?,
    userName: j['user_name'] as String?,
    userRole: j['user_role'] as String?,
    data: j['data'],
    createdAt: _dt(j['created_at'])!,
  );
}

/// Ocorrência na fila da administração.
class AdminOccurrence {
  const AdminOccurrence({required this.summary, required this.customerName, this.marketName, this.evidenceCount = 0});

  final OccurrenceSummary summary;
  final String customerName;
  final String? marketName;
  final int evidenceCount;

  factory AdminOccurrence.fromJson(Map<String, dynamic> j) => AdminOccurrence(
    summary: OccurrenceSummary.fromJson(j),
    customerName: j['customer_name'] as String? ?? '',
    marketName: j['market_name'] as String?,
    evidenceCount: _i(j['evidence_count']),
  );
}

class AdminOccurrenceDetail {
  const AdminOccurrenceDetail({required this.detail, required this.customerName, required this.orderTotalCents});

  final OccurrenceDetail detail;
  final String customerName;
  final int orderTotalCents;

  factory AdminOccurrenceDetail.fromJson(Map<String, dynamic> j) {
    final o = j['order'] as Map<String, dynamic>? ?? const {};
    return AdminOccurrenceDetail(
      detail: OccurrenceDetail.fromJson(j['occurrence'] as Map<String, dynamic>),
      customerName: o['customer_name'] as String? ?? '',
      orderTotalCents: _i(o['total_cents']),
    );
  }
}
