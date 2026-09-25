import 'dart:typed_data';

import '../../core/utils/validators.dart';
import '../../services/api_client.dart';
import '../mock/mock_data.dart';
import '../models/courier.dart';
import '../models/finance.dart';

/// Entregador (Fase 9).
abstract interface class CourierRepository {
  Future<CourierProfile> profile();
  Future<CourierProfile> updateProfile(Map<String, dynamic> changes);

  /// [kind]: documento (CNH/RG) ou crlv (documento do veículo).
  Future<void> uploadPhoto(String kind, Uint8List bytes, String contentType);
  Future<CourierProfile> submit();
  Future<void> setOnline(bool online, {double? lat, double? lng});
  Future<void> sendLocation(double lat, double lng);
  Future<List<AvailableDelivery>> available();
  Future<void> accept(String orderId);
  Future<ActiveDelivery?> current();
  Future<bool> arriveAtMarket(String orderId, String stopId);
  Future<void> pickUp(String orderId, String stopId, int itemsChecked);
  Future<void> arriveAtCustomer(String orderId);

  /// Devolve o ganho da entrega.
  Future<int> deliver(String orderId, String code);
  Future<CourierEarnings> earnings(int days);
  Future<List<DeliveryHistoryItem>> history();
  Future<FinanceStatement> statement();
}

class ApiCourierRepository implements CourierRepository {
  ApiCourierRepository(this._api);

  final ApiClient _api;

  CourierProfile _p(Map<String, dynamic> j) => CourierProfile.fromJson(j['courier'] as Map<String, dynamic>);

  @override
  Future<CourierProfile> profile() async => _p(await _api.get('/entregador/perfil'));

  @override
  Future<CourierProfile> updateProfile(Map<String, dynamic> changes) async =>
      _p(await _api.put('/entregador/perfil', changes));

  @override
  Future<void> uploadPhoto(String kind, Uint8List bytes, String contentType) =>
      _api.upload('/entregador/arquivos/$kind', bytes, contentType);

  @override
  Future<CourierProfile> submit() async => _p(await _api.post('/entregador/enviar', {}));

  @override
  Future<void> setOnline(bool online, {double? lat, double? lng}) =>
      _api.post('/entregador/disponibilidade', {'online': online, 'lat': ?lat, 'lng': ?lng});

  @override
  Future<void> sendLocation(double lat, double lng) => _api.post('/entregador/localizacao', {'lat': lat, 'lng': lng});

  @override
  Future<List<AvailableDelivery>> available() async {
    final j = await _api.get('/entregador/pedidos-disponiveis');
    return (j['items'] as List).cast<Map<String, dynamic>>().map(AvailableDelivery.fromJson).toList();
  }

  @override
  Future<void> accept(String orderId) => _api.post('/entregador/pedidos/$orderId/aceitar', {});

  @override
  Future<ActiveDelivery?> current() async {
    final d = (await _api.get('/entregador/entrega-atual'))['delivery'] as Map<String, dynamic>?;
    return d == null ? null : ActiveDelivery.fromJson(d);
  }

  @override
  Future<bool> arriveAtMarket(String orderId, String stopId) async {
    final j = await _api.post('/entregador/pedidos/$orderId/mercados/$stopId/chegada', {});
    return j['market_ready'] as bool? ?? false;
  }

  @override
  Future<void> pickUp(String orderId, String stopId, int itemsChecked) =>
      _api.post('/entregador/pedidos/$orderId/mercados/$stopId/retirada', {'itens_conferidos': itemsChecked});

  @override
  Future<void> arriveAtCustomer(String orderId) => _api.post('/entregador/pedidos/$orderId/chegada-cliente', {});

  @override
  Future<int> deliver(String orderId, String code) async {
    final j = await _api.post('/entregador/pedidos/$orderId/entregar', {'codigo': code});
    return j['earning_cents'] as int? ?? 0;
  }

  @override
  Future<CourierEarnings> earnings(int days) async =>
      CourierEarnings.fromJson(await _api.get('/entregador/ganhos?dias=$days'));

  @override
  Future<FinanceStatement> statement() async => FinanceStatement.fromJson(await _api.get('/entregador/extrato'));

  @override
  Future<List<DeliveryHistoryItem>> history() async {
    final j = await _api.get('/entregador/historico');
    return (j['items'] as List).cast<Map<String, dynamic>>().map(DeliveryHistoryItem.fromJson).toList();
  }
}

/// Entregador de demonstração: mesmas regras da API (cadastro, aprovação, coleta, código de entrega).
class MockCourierRepository implements CourierRepository {
  static const demoCode = '482913';

  var _p = const CourierProfile(status: 'pendente', inReview: false, missing: []);
  final Map<String, dynamic> _data = {};
  bool _doc = false;
  bool _vehicleDoc = false;
  bool _online = false;
  ActiveDelivery? _active;
  var _offer = true;
  final List<DeliveryHistoryItem> _history = [
    DeliveryHistoryItem(
      id: 'h1a2b3c4-0000-4000-8000-000000000000',
      status: 'entregue',
      markets: 'SuperMais, EconoMarket',
      marketCount: 2,
      earningCents: 872,
      deliveredAt: DateTime.now().subtract(const Duration(days: 1, hours: 2)),
    ),
  ];
  int _attempts = 0;

  Future<void> _wait() => Future<void>.delayed(const Duration(milliseconds: 250));

  CourierProfile _build() {
    final type = _data['vehicle_type'] == null ? null : VehicleType.values.byName(_data['vehicle_type'] as String);
    final needs = type?.needsLicense ?? false;
    final missing = [
      if (_data['cpf'] == null) 'cpf',
      if (_data['birth_date'] == null) 'birth_date',
      if (_data['pix_key'] == null) 'pix_key',
      if (type == null) 'vehicle_type',
      if (needs && _data['vehicle_plate'] == null) 'vehicle_plate',
      if (needs && _data['cnh_number'] == null) 'cnh_number',
      if (!_doc) 'document_photo',
      if (needs && !_vehicleDoc) 'vehicle_doc',
    ];
    final cpf = _data['cpf'] as String?;
    return CourierProfile(
      status: _p.status,
      inReview: _p.inReview,
      missing: missing,
      cpf: cpf == null ? null : '***.${cpf.substring(3, 6)}.${cpf.substring(6, 9)}-**',
      birthDate: _data['birth_date'] as String?,
      cnhNumber: _data['cnh_number'] as String?,
      pixKey: _data['pix_key'] as String?,
      vehicleType: type,
      vehiclePlate: _data['vehicle_plate'] as String?,
      vehicleModel: _data['vehicle_model'] as String?,
      vehicleColor: _data['vehicle_color'] as String?,
      hasDocumentPhoto: _doc,
      hasVehicleDoc: _vehicleDoc,
      workRadiusKm: _data['work_radius_km'] as int? ?? 5,
      isOnline: _online,
    );
  }

  ApiException _bad(String m) => ApiException(400, 'validation', m);

  @override
  Future<CourierProfile> profile() async {
    await _wait();
    return _p = _build();
  }

  @override
  Future<CourierProfile> updateProfile(Map<String, dynamic> changes) async {
    await _wait();
    if (_p.approved && changes.keys.any((k) => k != 'work_radius_km')) {
      throw const ApiException(409, 'locked', 'Cadastro aprovado: para alterar dados, fale com o suporte.');
    }
    final c = Map.of(changes);
    if (c['cpf'] != null) {
      final d = (c['cpf'] as String).replaceAll(RegExp(r'\D'), '');
      if (!isValidCpf(d)) throw const ApiException(400, 'invalid_cpf', 'CPF inválido.');
      c['cpf'] = d;
    }
    if (c['birth_date'] != null) {
      final age = DateTime.now().difference(DateTime.parse(c['birth_date'] as String)).inDays / 365.25;
      if (age < 18) throw _bad('É preciso ter 18 anos ou mais.');
    }
    if (c['vehicle_plate'] != null &&
        !RegExp(r'^[A-Z]{3}-?\d[A-Z0-9]\d{2}$').hasMatch((c['vehicle_plate'] as String).toUpperCase())) {
      throw _bad('Placa inválida.');
    }
    c.removeWhere((_, v) => v == null || v == '');
    _data.addAll(c);
    return _p = _build();
  }

  @override
  Future<void> uploadPhoto(String kind, Uint8List bytes, String contentType) async {
    await _wait();
    if (bytes.length > 5 * 1024 * 1024) throw _bad('Foto muito grande (máximo 5 MB).');
    kind == 'documento' ? _doc = true : _vehicleDoc = true;
  }

  @override
  Future<CourierProfile> submit() async {
    await _wait();
    final p = _build();
    if (p.missing.isNotEmpty) throw ApiException(400, 'incomplete', 'Complete o cadastro: ${p.missing.join(', ')}.');
    // Demonstração: aprovado na hora (em produção passa pela análise da administração).
    _p = CourierProfile(status: 'aprovado', inReview: false, missing: const []);
    return _p = _build();
  }

  @override
  Future<void> setOnline(bool online, {double? lat, double? lng}) async {
    await _wait();
    if (!online && _active != null) {
      throw const ApiException(409, 'active_delivery', 'Finalize a entrega em andamento antes de ficar indisponível.');
    }
    _online = online;
  }

  @override
  Future<void> sendLocation(double lat, double lng) async {}

  @override
  Future<List<AvailableDelivery>> available() async {
    await _wait();
    if (!_online || _active != null || !_offer) return const [];
    return const [
      AvailableDelivery(
        id: 'e7f8a9b0-0000-4000-8000-000000000000',
        distanceToFirstKm: 0.6,
        routeKm: 3.4,
        minutes: 18,
        earningCents: 872,
        customerDistrict: 'Bela Vista, São Paulo',
        weightKg: 8.4,
        coldItems: 2,
        markets: [
          (name: 'SuperMais', district: 'Consolação', ready: true),
          (name: 'EconoMarket', district: 'Bela Vista', ready: false),
        ],
      ),
    ];
  }

  @override
  Future<void> accept(String orderId) async {
    await _wait();
    if (!_online) throw const ApiException(409, 'offline', 'Fique disponível para aceitar entregas.');
    final m1 = MockData.markets.firstWhere((m) => m.id == 'm1');
    final m2 = MockData.markets.firstWhere((m) => m.id == 'm2');
    _active = ActiveDelivery(
      id: orderId,
      orderStatus: 'pronto_coleta',
      courierStatus: 'aceito',
      earningCents: 872,
      routeKm: 3.4,
      minutes: 18,
      stops: [
        DeliveryStop(
          id: 's1',
          sequence: 1,
          status: 'pronto',
          name: m1.name,
          address: m1.address,
          lat: m1.lat!,
          lng: m1.lng!,
          itemCount: 6,
        ),
        DeliveryStop(
          id: 's2',
          sequence: 2,
          status: 'pronto',
          name: m2.name,
          address: m2.address,
          lat: m2.lat!,
          lng: m2.lng!,
          itemCount: 5,
          coldItems: 2,
        ),
      ],
      customerName: 'Ana',
      customerPhone: '(11) 98765-4321',
      customerAddress: 'Av. Paulista, 1000 — Apto 42 — Bela Vista · São Paulo',
      customerLat: MockData.center.lat,
      customerLng: MockData.center.lng,
    );
    _offer = false;
  }

  @override
  Future<ActiveDelivery?> current() async {
    await _wait();
    return _active;
  }

  ActiveDelivery _with({String? orderStatus, String? courierStatus, List<DeliveryStop>? stops}) {
    final a = _active!;
    return _active = ActiveDelivery(
      id: a.id,
      orderStatus: orderStatus ?? a.orderStatus,
      courierStatus: courierStatus ?? a.courierStatus,
      earningCents: a.earningCents,
      routeKm: a.routeKm,
      minutes: a.minutes,
      stops: stops ?? a.stops,
      customerName: a.customerName,
      customerPhone: a.customerPhone,
      customerAddress: a.customerAddress,
      customerLat: a.customerLat,
      customerLng: a.customerLng,
    );
  }

  DeliveryStop _stop(DeliveryStop s, {String? status, bool? arrived}) => DeliveryStop(
    id: s.id,
    sequence: s.sequence,
    status: status ?? s.status,
    name: s.name,
    address: s.address,
    district: s.district,
    lat: s.lat,
    lng: s.lng,
    itemCount: s.itemCount,
    arrived: arrived ?? s.arrived,
    coldItems: s.coldItems,
  );

  @override
  Future<bool> arriveAtMarket(String orderId, String stopId) async {
    await _wait();
    final a = _active!;
    _with(courierStatus: 'no_mercado', stops: [for (final s in a.stops) s.id == stopId ? _stop(s, arrived: true) : s]);
    return a.stops.firstWhere((s) => s.id == stopId).ready;
  }

  @override
  Future<void> pickUp(String orderId, String stopId, int itemsChecked) async {
    await _wait();
    final a = _active!;
    final s = a.stops.firstWhere((s) => s.id == stopId);
    if (!s.ready) throw const ApiException(409, 'not_ready', 'O mercado ainda está separando este pedido.');
    if (itemsChecked != s.itemCount) {
      throw _bad('A quantidade não confere: o pedido tem ${s.itemCount} itens. Confira com o mercado.');
    }
    final stops = [for (final x in a.stops) x.id == stopId ? _stop(x, status: 'retirado', arrived: true) : x];
    final done = stops.every((x) => x.picked);
    _with(stops: stops, orderStatus: done ? 'em_rota' : null, courierStatus: done ? 'a_caminho' : null);
  }

  @override
  Future<void> arriveAtCustomer(String orderId) async {
    await _wait();
    if (_active?.orderStatus != 'em_rota') {
      throw const ApiException(409, 'invalid_state', 'Retire o pedido em todos os mercados antes.');
    }
    _with(courierStatus: 'chegou');
  }

  @override
  Future<int> deliver(String orderId, String code) async {
    await _wait();
    if (_attempts >= 5) throw const ApiException(429, 'too_many_attempts', 'Muitas tentativas. Fale com o suporte.');
    if (code != demoCode) {
      _attempts++;
      throw ApiException(400, 'wrong_code', 'Código incorreto. Restam ${5 - _attempts} tentativas.');
    }
    final a = _active!;
    _history.insert(
      0,
      DeliveryHistoryItem(
        id: a.id,
        status: 'entregue',
        markets: a.stops.map((s) => s.name).join(', '),
        marketCount: a.stops.length,
        earningCents: a.earningCents,
        deliveredAt: DateTime.now(),
      ),
    );
    _active = null;
    return a.earningCents;
  }

  @override
  Future<CourierEarnings> earnings(int days) async {
    await _wait();
    final byDay = <DateTime, ({int n, int c})>{};
    for (final h in _history.where((h) => h.deliveredAt != null)) {
      final d = DateTime(h.deliveredAt!.year, h.deliveredAt!.month, h.deliveredAt!.day);
      final cur = byDay[d] ?? (n: 0, c: 0);
      byDay[d] = (n: cur.n + 1, c: cur.c + (h.earningCents ?? 0));
    }
    final list = [for (final e in byDay.entries) (day: e.key, deliveries: e.value.n, earningCents: e.value.c)]
      ..sort((a, b) => b.day.compareTo(a.day));
    return CourierEarnings(
      days: days,
      deliveries: list.fold(0, (s, d) => s + d.deliveries),
      earningCents: list.fold(0, (s, d) => s + d.earningCents),
      byDay: list,
    );
  }

  @override
  Future<List<DeliveryHistoryItem>> history() async {
    await _wait();
    return List.of(_history);
  }

  @override
  Future<FinanceStatement> statement() async {
    await _wait();
    final done = _history.where((h) => h.earningCents != null).toList();
    return FinanceStatement(
      balance: FinanceBalance(availableCents: done.fold(0, (s, h) => s + h.earningCents!)),
      entries: [
        for (final h in done)
          LedgerEntry(
            orderId: h.id,
            kind: 'entrega',
            amountCents: h.earningCents!,
            note: 'Entrega',
            createdAt: h.deliveredAt ?? DateTime.now(),
          ),
      ],
      payouts: const [],
    );
  }
}
