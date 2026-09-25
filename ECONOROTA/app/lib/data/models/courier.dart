/// Entregador (Fase 9).
library;

import '../../core/utils/format.dart';

enum VehicleType {
  moto('Moto', true),
  bicicleta('Bicicleta', false),
  carro('Carro', true);

  const VehicleType(this.label, this.needsLicense);
  final String label;

  /// Moto e carro exigem placa e CNH.
  final bool needsLicense;
}

class CourierProfile {
  const CourierProfile({
    required this.status,
    required this.inReview,
    required this.missing,
    this.reviewNote,
    this.cpf,
    this.birthDate,
    this.cnhNumber,
    this.pixKey,
    this.vehicleType,
    this.vehiclePlate,
    this.vehicleModel,
    this.vehicleColor,
    this.hasDocumentPhoto = false,
    this.hasVehicleDoc = false,
    this.workRadiusKm = 5,
    this.isOnline = false,
  });

  /// pendente, aprovado ou bloqueado.
  final String status;
  final bool inReview;
  final List<String> missing;
  final String? reviewNote;
  final String? cpf;
  final String? birthDate;
  final String? cnhNumber;
  final String? pixKey;
  final VehicleType? vehicleType;
  final String? vehiclePlate;
  final String? vehicleModel;
  final String? vehicleColor;
  final bool hasDocumentPhoto;

  /// Documento do veículo (CRLV) — só moto e carro.
  final bool hasVehicleDoc;
  final int workRadiusKm;
  final bool isOnline;

  bool get approved => status == 'aprovado';

  factory CourierProfile.fromJson(Map<String, dynamic> j) => CourierProfile(
    status: j['status'] as String,
    inReview: j['in_review'] as bool? ?? false,
    missing: (j['missing'] as List? ?? const []).cast<String>(),
    reviewNote: j['review_note'] as String?,
    cpf: j['cpf'] as String?,
    birthDate: j['birth_date'] as String?,
    cnhNumber: j['cnh_number'] as String?,
    pixKey: j['pix_key'] as String?,
    vehicleType: j['vehicle_type'] == null ? null : VehicleType.values.byName(j['vehicle_type'] as String),
    vehiclePlate: j['vehicle_plate'] as String?,
    vehicleModel: j['vehicle_model'] as String?,
    vehicleColor: j['vehicle_color'] as String?,
    hasDocumentPhoto: j['has_document_photo'] as bool? ?? false,
    hasVehicleDoc: j['has_vehicle_doc'] as bool? ?? false,
    workRadiusKm: j['work_radius_km'] as int? ?? 5,
    isOnline: j['is_online'] as bool? ?? false,
  );
}

class AvailableDelivery {
  const AvailableDelivery({
    required this.id,
    required this.distanceToFirstKm,
    required this.routeKm,
    required this.minutes,
    required this.earningCents,
    required this.customerDistrict,
    required this.markets,
    this.weightKg,
    this.coldItems = 0,
  });

  final String id;
  final double distanceToFirstKm;
  final double routeKm;
  final int minutes;
  final int earningCents;
  final String customerDistrict;
  final List<({String name, String? district, bool ready})> markets;

  /// Peso estimado (kg) e itens refrigerados (bolsa térmica).
  final double? weightKg;
  final int coldItems;

  factory AvailableDelivery.fromJson(Map<String, dynamic> j) => AvailableDelivery(
    id: j['id'] as String,
    distanceToFirstKm: (j['distance_to_first_km'] as num).toDouble(),
    routeKm: (j['route_km'] as num).toDouble(),
    minutes: j['minutes'] as int,
    earningCents: j['earning_cents'] as int,
    customerDistrict: j['customer_district'] as String? ?? '',
    weightKg: (j['weight_kg'] as num?)?.toDouble(),
    coldItems: j['cold_items'] as int? ?? 0,
    markets: [
      for (final m in (j['markets'] as List).cast<Map<String, dynamic>>())
        (name: m['name'] as String, district: m['district'] as String?, ready: m['ready'] as bool? ?? false),
    ],
  );
}

class DeliveryStop {
  const DeliveryStop({
    required this.id,
    required this.sequence,
    required this.status,
    required this.name,
    required this.lat,
    required this.lng,
    required this.itemCount,
    this.address,
    this.district,
    this.arrived = false,
    this.coldItems = 0,
  });

  final String id;
  final int sequence;

  /// Situação no mercado: novo, em_separacao, conferido, pronto, retirado.
  final String status;
  final String name;
  final String? address;
  final String? district;
  final double lat;
  final double lng;
  final int itemCount;
  final bool arrived;

  /// Itens refrigerados deste mercado (vão na bolsa térmica; a rota deixa essa coleta por último quando possível).
  final int coldItems;

  bool get ready => status == 'pronto';
  bool get picked => status == 'retirado' || status == 'entregue';

  factory DeliveryStop.fromJson(Map<String, dynamic> j) => DeliveryStop(
    id: j['id'] as String,
    sequence: j['sequence'] as int,
    status: j['status'] as String,
    name: j['name'] as String,
    address: j['address'] as String?,
    district: j['district'] as String?,
    lat: (j['lat'] as num).toDouble(),
    lng: (j['lng'] as num).toDouble(),
    itemCount: j['item_count'] as int? ?? 0,
    arrived: j['courier_arrived_at'] != null,
    coldItems: j['cold_items'] as int? ?? 0,
  );
}

class ActiveDelivery {
  const ActiveDelivery({
    required this.id,
    required this.orderStatus,
    required this.courierStatus,
    required this.earningCents,
    required this.routeKm,
    required this.minutes,
    required this.stops,
    required this.customerName,
    required this.customerAddress,
    required this.customerLat,
    required this.customerLng,
    this.customerPhone,
  });

  final String id;
  final String orderStatus;

  /// aceito, no_mercado, a_caminho, chegou, entregue.
  final String courierStatus;
  final int earningCents;
  final double routeKm;
  final int minutes;
  final List<DeliveryStop> stops;
  final String customerName;
  final String? customerPhone;
  final String customerAddress;
  final double customerLat;
  final double customerLng;

  String get code => shortCode(id);
  bool get allPicked => stops.every((s) => s.picked);
  DeliveryStop? get nextStop => stops.where((s) => !s.picked).firstOrNull;

  factory ActiveDelivery.fromJson(Map<String, dynamic> j) {
    final c = j['customer'] as Map<String, dynamic>;
    final a = c['address'] as Map<String, dynamic>? ?? const {};
    return ActiveDelivery(
      id: j['id'] as String,
      orderStatus: j['order_status'] as String,
      courierStatus: j['courier_status'] as String,
      earningCents: j['earning_cents'] as int,
      routeKm: (j['route_km'] as num).toDouble(),
      minutes: j['minutes'] as int,
      stops: (j['stops'] as List).cast<Map<String, dynamic>>().map(DeliveryStop.fromJson).toList(),
      customerName: c['first_name'] as String,
      customerPhone: c['phone'] as String?,
      customerAddress: [
        [a['street'], a['number']].whereType<String>().join(', '),
        a['complement'],
        [a['district'], a['city']].whereType<String>().join(' · '),
      ].whereType<String>().where((s) => s.isNotEmpty).join(' — '),
      customerLat: (c['lat'] as num).toDouble(),
      customerLng: (c['lng'] as num).toDouble(),
    );
  }
}

class CourierEarnings {
  const CourierEarnings({
    required this.days,
    required this.deliveries,
    required this.earningCents,
    required this.byDay,
  });

  final int days;
  final int deliveries;
  final int earningCents;
  final List<({DateTime day, int deliveries, int earningCents})> byDay;

  factory CourierEarnings.fromJson(Map<String, dynamic> j) => CourierEarnings(
    days: j['days'] as int,
    deliveries: j['deliveries'] as int? ?? 0,
    earningCents: j['earning_cents'] as int? ?? 0,
    byDay: [
      for (final d in (j['by_day'] as List).cast<Map<String, dynamic>>())
        (
          day: DateTime.parse(d['day'] as String),
          deliveries: d['deliveries'] as int,
          earningCents: d['earning_cents'] as int,
        ),
    ],
  );
}

class DeliveryHistoryItem {
  const DeliveryHistoryItem({
    required this.id,
    required this.status,
    required this.markets,
    required this.marketCount,
    this.earningCents,
    this.deliveredAt,
  });

  final String id;
  final String status;
  final String markets;
  final int marketCount;
  final int? earningCents;
  final DateTime? deliveredAt;

  factory DeliveryHistoryItem.fromJson(Map<String, dynamic> j) => DeliveryHistoryItem(
    id: j['id'] as String,
    status: j['status'] as String,
    markets: j['markets'] as String? ?? '',
    marketCount: j['market_count'] as int? ?? 1,
    earningCents: j['earning_cents'] as int?,
    deliveredAt: j['delivered_at'] == null ? null : DateTime.parse(j['delivered_at'] as String).toLocal(),
  );
}
