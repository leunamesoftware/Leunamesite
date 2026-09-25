import '../../core/utils/format.dart';

enum OrderFilter {
  all(null, 'Todos'),
  active('andamento', 'Em andamento'),
  delivered('entregues', 'Entregues'),
  cancelled('cancelados', 'Cancelados');

  const OrderFilter(this.apiValue, this.label);
  final String? apiValue;
  final String label;
}

enum OrderStage { active, delivered, cancelled }

class OrderSummary {
  const OrderSummary({
    required this.id,
    required this.status,
    required this.totalCents,
    required this.createdAt,
    required this.marketName,
    this.marketImageUrl,
    this.marketCount = 1,
    this.itemCount = 0,
    this.preview = const [],
  });

  final String id;
  final String status;
  final int totalCents;
  final DateTime createdAt;
  final String marketName;
  final String? marketImageUrl;
  final int marketCount;
  final int itemCount;
  final List<({String name, String? imageUrl})> preview;

  OrderStage get stage => switch (status) {
    'entregue' => OrderStage.delivered,
    'cancelado' => OrderStage.cancelled,
    _ => OrderStage.active,
  };

  String get statusLabel => switch (status) {
    'entregue' => 'Entregue',
    'cancelado' => 'Cancelado',
    'em_rota' => 'A caminho',
    'em_separacao' => 'Em separação',
    'pago' => 'Pagamento aprovado',
    'aguardando_pagamento' => 'Aguardando pagamento',
    'pronto_coleta' => 'Pronto para coleta',
    _ => 'Em andamento',
  };

  factory OrderSummary.fromJson(Map<String, dynamic> j) => OrderSummary(
    id: j['id'] as String,
    status: j['status'] as String,
    totalCents: j['total_cents'] as int? ?? 0,
    createdAt: DateTime.parse(j['created_at'] as String).toLocal(),
    marketName: j['market_name'] as String? ?? 'Mercado',
    marketImageUrl: j['market_image_url'] as String?,
    marketCount: j['market_count'] as int? ?? 1,
    itemCount: j['item_count'] as int? ?? 0,
    preview: ((j['items_preview'] as List?) ?? const [])
        .cast<Map<String, dynamic>>()
        .map((p) => (name: p['name'] as String, imageUrl: p['image_url'] as String?))
        .toList(),
  );
}

enum PaymentMethod {
  pix('pix', 'Pix', 'Aprovação na hora.'),
  card('cartao', 'Cartão de crédito', 'Pague com segurança.');

  const PaymentMethod(this.apiValue, this.label, this.hint);
  final String apiValue;
  final String label;
  final String hint;
}

/// Pedido recém-confirmado (valores calculados pelo servidor).
class PlacedOrder {
  const PlacedOrder({
    required this.id,
    required this.status,
    required this.payment,
    required this.itemsCents,
    required this.deliveryCents,
    required this.savingsCents,
    required this.totalCents,
    required this.marketIds,
    required this.etaMax,
  });

  final String id;
  final String status;
  final PaymentMethod payment;
  final int itemsCents;
  final int deliveryCents;
  final int savingsCents;
  final int totalCents;
  final List<String> marketIds;
  final int etaMax;

  /// Número curto para o cliente falar com o suporte.
  String get code => shortCode(id);

  factory PlacedOrder.fromJson(Map<String, dynamic> j) => PlacedOrder(
    id: j['id'] as String,
    status: j['status'] as String,
    payment: PaymentMethod.values.firstWhere((p) => p.apiValue == j['payment_method'], orElse: () => PaymentMethod.pix),
    itemsCents: j['items_cents'] as int,
    deliveryCents: j['delivery_cents'] as int,
    savingsCents: j['savings_cents'] as int? ?? 0,
    totalCents: j['total_cents'] as int,
    marketIds: (j['market_ids'] as List).cast<String>(),
    etaMax: j['eta_max'] as int? ?? 60,
  );
}

enum PaymentStatus { pending, approved, refused, cancelled, refunded }

/// Cobrança do pedido (Pix com QR ou cartão na página segura do Asaas).
class PaymentInfo {
  const PaymentInfo({
    required this.id,
    required this.method,
    required this.status,
    required this.amountCents,
    this.pixPayload,
    this.pixExpiresAt,
    this.invoiceUrl,
    this.failureReason,
    this.simulated = false,
  });

  final String id;
  final PaymentMethod method;
  final PaymentStatus status;
  final int amountCents;
  final String? pixPayload;
  final DateTime? pixExpiresAt;
  final String? invoiceUrl;
  final String? failureReason;

  /// Ambiente de testes (sem cobrança real): o app mostra botões de simulação.
  final bool simulated;

  bool get expired => status == PaymentStatus.cancelled && failureReason == 'expirado';

  static PaymentStatus _status(String s) => switch (s) {
    'aprovado' => PaymentStatus.approved,
    'recusado' => PaymentStatus.refused,
    'cancelado' => PaymentStatus.cancelled,
    'estornado' => PaymentStatus.refunded,
    _ => PaymentStatus.pending,
  };

  factory PaymentInfo.fromJson(Map<String, dynamic> j) {
    final pix = j['pix'] as Map<String, dynamic>?;
    return PaymentInfo(
      id: j['id'] as String,
      method: PaymentMethod.values.firstWhere((m) => m.apiValue == j['method'], orElse: () => PaymentMethod.pix),
      status: _status(j['status'] as String),
      amountCents: j['amount_cents'] as int,
      pixPayload: pix?['payload'] as String?,
      pixExpiresAt: pix?['expires_at'] == null ? null : DateTime.tryParse(pix!['expires_at'] as String)?.toLocal(),
      invoiceUrl: j['invoice_url'] as String?,
      failureReason: j['failure_reason'] as String?,
      simulated: j['simulated'] as bool? ?? false,
    );
  }

  PaymentInfo copyWith({PaymentStatus? status, String? failureReason}) => PaymentInfo(
    id: id,
    method: method,
    status: status ?? this.status,
    amountCents: amountCents,
    pixPayload: pixPayload,
    pixExpiresAt: pixExpiresAt,
    invoiceUrl: invoiceUrl,
    failureReason: failureReason ?? this.failureReason,
    simulated: simulated,
  );
}

/// Situação do pagamento de um pedido.
class PaymentState {
  const PaymentState({
    required this.orderId,
    required this.orderStatus,
    required this.totalCents,
    required this.method,
    this.payment,
    this.cancelReason,
    this.deliveryCode,
  });

  final String orderId;

  /// Código que o cliente mostra ao entregador (QR Code ou 6 dígitos). Só existe após o pagamento.
  final String? deliveryCode;

  /// aguardando_pagamento, pago, cancelado…
  final String orderStatus;
  final int totalCents;
  final PaymentMethod method;
  final PaymentInfo? payment;
  final String? cancelReason;

  bool get paid => orderStatus != 'aguardando_pagamento' && orderStatus != 'cancelado';
  bool get cancelled => orderStatus == 'cancelado';
}

enum TrafficLight { green, yellow, red }

/// Parada do rastreamento (mercado 1, 2 ou 3).
class TrackStop {
  const TrackStop({
    required this.id,
    required this.sequence,
    required this.name,
    required this.lat,
    required this.lng,
    required this.status,
    this.imageUrl,
    this.readyAt,
    this.pickedAt,
    this.courierHere = false,
  });

  final String id;
  final int sequence;
  final String name;
  final String? imageUrl;
  final double lat;
  final double lng;

  /// novo, em_separacao, conferido, pronto, retirado, entregue, cancelado.
  final String status;
  final DateTime? readyAt;
  final DateTime? pickedAt;
  final bool courierHere;

  bool get picked => status == 'retirado' || status == 'entregue';
  bool get ready => status == 'pronto' || picked;

  factory TrackStop.fromJson(Map<String, dynamic> j) => TrackStop(
    id: j['id'] as String,
    sequence: j['sequence'] as int,
    name: j['name'] as String,
    imageUrl: j['image_url'] as String?,
    lat: (j['lat'] as num).toDouble(),
    lng: (j['lng'] as num).toDouble(),
    status: j['status'] as String,
    readyAt: j['ready_at'] == null ? null : DateTime.parse(j['ready_at'] as String).toLocal(),
    pickedAt: j['picked_at'] == null ? null : DateTime.parse(j['picked_at'] as String).toLocal(),
    courierHere: j['courier_here'] as bool? ?? false,
  );
}

class TrackCourier {
  const TrackCourier({required this.firstName, required this.vehicle, this.plate, this.lat, this.lng});

  final String firstName;
  final String vehicle;
  final String? plate;
  final double? lat;
  final double? lng;

  factory TrackCourier.fromJson(Map<String, dynamic> j) => TrackCourier(
    firstName: j['first_name'] as String,
    vehicle: j['vehicle'] as String? ?? '',
    plate: j['plate'] as String?,
    lat: (j['lat'] as num?)?.toDouble(),
    lng: (j['lng'] as num?)?.toDouble(),
  );
}

/// Rastreamento do pedido (Fase 10).
class OrderTracking {
  const OrderTracking({
    required this.id,
    required this.status,
    required this.light,
    required this.etaMin,
    required this.totalKm,
    required this.remainingKm,
    required this.customerLat,
    required this.customerLng,
    required this.stops,
    this.courierStatus,
    this.lightReason,
    this.arrivalAt,
    this.promisedAt,
    this.courier,
    this.deliveryCode,
    this.demo = false,
  });

  final String id;
  final String status;
  final String? courierStatus;
  final TrafficLight light;
  final String? lightReason;
  final int etaMin;
  final DateTime? arrivalAt;
  final DateTime? promisedAt;
  final double totalKm;
  final double remainingKm;
  final double customerLat;
  final double customerLng;
  final List<TrackStop> stops;
  final TrackCourier? courier;
  final String? deliveryCode;

  /// Simulação da prévia (sem servidor).
  final bool demo;

  bool get finished => status == 'entregue' || status == 'cancelado';
  String get code => shortCode(id);
  TrackStop? get nextStop => stops.where((s) => !s.picked).firstOrNull;

  factory OrderTracking.fromJson(Map<String, dynamic> j, {String? deliveryCode}) {
    final c = j['customer'] as Map<String, dynamic>;
    return OrderTracking(
      id: j['id'] as String,
      status: j['status'] as String,
      courierStatus: j['courier_status'] as String?,
      light: switch (j['light']) {
        'vermelho' => TrafficLight.red,
        'amarelo' => TrafficLight.yellow,
        _ => TrafficLight.green,
      },
      lightReason: j['light_reason'] as String?,
      etaMin: j['eta_min'] as int? ?? 0,
      arrivalAt: j['arrival_at'] == null ? null : DateTime.parse(j['arrival_at'] as String).toLocal(),
      promisedAt: j['promised_at'] == null ? null : DateTime.parse(j['promised_at'] as String).toLocal(),
      totalKm: (j['total_km'] as num).toDouble(),
      remainingKm: (j['remaining_km'] as num).toDouble(),
      customerLat: (c['lat'] as num).toDouble(),
      customerLng: (c['lng'] as num).toDouble(),
      stops: (j['stops'] as List).cast<Map<String, dynamic>>().map(TrackStop.fromJson).toList(),
      courier: j['courier'] == null ? null : TrackCourier.fromJson(j['courier'] as Map<String, dynamic>),
      deliveryCode: deliveryCode ?? j['delivery_code'] as String?,
    );
  }
}
