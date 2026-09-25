import 'dart:math';

import '../../core/compare/rules.dart';
import '../../core/utils/validators.dart';
import 'courier_repository.dart';
import '../../services/api_client.dart';
import '../mock/mock_data.dart';
import '../models/address.dart';
import '../models/compare.dart';
import '../models/order.dart';

abstract interface class OrdersRepository {
  Future<List<OrderSummary>> history(OrderFilter filter);

  /// Confirma o pedido. O servidor recalcula tudo; se o total mudou, lança ApiException 409 (cart_changed).
  Future<PlacedOrder> place({
    required Map<String, int> items,
    required ComparePlan plan,
    required Address address,
    required PaymentMethod payment,
  });

  /// Situação atual do pagamento do pedido.
  Future<PaymentState> paymentState(String orderId);

  /// Gera (ou reaproveita) a cobrança. Sem CPF cadastrado, lança ApiException 400 (invalid_cpf).
  Future<PaymentState> pay(String orderId, PaymentMethod method, {String? cpf});

  /// Cancela o pedido; devolve true quando houve estorno.
  Future<bool> cancel(String orderId);

  /// Somente em testes/demonstração: aprova ou recusa o pagamento pendente.
  Future<void> simulate(String orderId, {required bool approve});

  /// Rastreamento: mapa, entregador, status por mercado, farol e previsão.
  Future<OrderTracking> tracking(String orderId);
}

class ApiOrdersRepository implements OrdersRepository {
  ApiOrdersRepository(this._api);

  final ApiClient _api;

  @override
  Future<List<OrderSummary>> history(OrderFilter filter) async {
    final j = await _api.get('/me/orders${filter.apiValue == null ? '' : '?status=${filter.apiValue}'}');
    return (j['items'] as List).cast<Map<String, dynamic>>().map(OrderSummary.fromJson).toList();
  }

  @override
  Future<PlacedOrder> place({
    required Map<String, int> items,
    required ComparePlan plan,
    required Address address,
    required PaymentMethod payment,
  }) async {
    final j = await _api.post('/me/orders', {
      'items': [
        for (final e in items.entries) {'key': e.key, 'qty': e.value},
      ],
      'market_ids': plan.marketIds,
      'expected_total_cents': plan.totalCents,
      'payment_method': payment.apiValue,
      'address': {
        'street': address.street,
        'number': ?address.number,
        'complement': ?address.complement,
        'district': ?address.district,
        'city': address.city,
        'state': address.state,
        'zip': ?address.zip,
        'lat': address.lat,
        'lng': address.lng,
      },
    });
    return PlacedOrder.fromJson(j['order'] as Map<String, dynamic>);
  }

  @override
  Future<PaymentState> paymentState(String orderId) async {
    final j = await _api.get('/me/orders/$orderId');
    final o = j['order'] as Map<String, dynamic>;
    final p = o['payment'] as Map<String, dynamic>?;
    return PaymentState(
      orderId: orderId,
      orderStatus: o['status'] as String,
      totalCents: o['total_cents'] as int,
      method: PaymentMethod.values.firstWhere(
        (m) => m.apiValue == o['payment_method'],
        orElse: () => PaymentMethod.pix,
      ),
      payment: p == null ? null : PaymentInfo.fromJson(p),
      cancelReason: o['cancel_reason'] as String?,
      deliveryCode: o['delivery_code'] as String?,
    );
  }

  @override
  Future<PaymentState> pay(String orderId, PaymentMethod method, {String? cpf}) async {
    await _api.post('/me/orders/$orderId/pay', {'method': method.apiValue, 'cpf': ?cpf});
    return paymentState(orderId);
  }

  @override
  Future<bool> cancel(String orderId) async {
    final j = await _api.post('/me/orders/$orderId/cancel', {});
    return j['refunded'] as bool? ?? false;
  }

  @override
  Future<void> simulate(String orderId, {required bool approve}) =>
      _api.post('/me/orders/$orderId/pay/simulate', {'result': approve ? 'aprovado' : 'recusado'});

  @override
  Future<OrderTracking> tracking(String orderId) async =>
      OrderTracking.fromJson((await _api.get('/me/orders/$orderId/rastreio'))['tracking'] as Map<String, dynamic>);
}

class MockOrdersRepository implements OrdersRepository {
  @override
  Future<List<OrderSummary>> history(OrderFilter filter) async {
    await Future<void>.delayed(const Duration(milliseconds: 350));
    return [...MockPlacedOrders.items, ...MockData.orders]
        .where(
          (o) => switch (filter) {
            OrderFilter.all => true,
            OrderFilter.active => o.stage == OrderStage.active,
            OrderFilter.delivered => o.stage == OrderStage.delivered,
            OrderFilter.cancelled => o.stage == OrderStage.cancelled,
          },
        )
        .toList();
  }

  @override
  Future<PlacedOrder> place({
    required Map<String, int> items,
    required ComparePlan plan,
    required Address address,
    required PaymentMethod payment,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    if (plan.itemsCents < platformMinOrderCents) {
      throw const ApiException(400, 'min_order', 'Pedido abaixo do mínimo.');
    }
    final id = List.generate(4, (_) => Random().nextInt(1 << 16).toRadixString(16).padLeft(4, '0')).join('-');
    final first = plan.route?.order.first ?? plan.marketIds.first;
    final market = MockData.markets.firstWhere((m) => m.id == first);
    final products = {for (final p in MockData.products) p.id: p};
    MockPlacedOrders.items.insert(
      0,
      OrderSummary(
        id: id,
        status: 'aguardando_pagamento',
        totalCents: plan.totalCents,
        createdAt: DateTime.now(),
        marketName: market.name,
        marketImageUrl: market.imageUrl,
        marketCount: plan.marketIds.length,
        itemCount: plan.lines.fold(0, (s, l) => s + l.qty),
        preview: [
          for (final l in plan.lines.take(4))
            if (products[l.productId] case final p?) (name: p.name, imageUrl: p.imageUrl),
        ],
      ),
    );
    MockPlacedOrders.markets[id] = plan.route?.order ?? plan.marketIds;
    MockPlacedOrders.payments[id] = PaymentState(
      orderId: id,
      orderStatus: 'aguardando_pagamento',
      totalCents: plan.totalCents,
      method: payment,
    );
    return PlacedOrder(
      id: id,
      status: 'aguardando_pagamento',
      payment: payment,
      itemsCents: plan.itemsCents,
      deliveryCents: plan.deliveryCents,
      savingsCents: 0,
      totalCents: plan.totalCents,
      marketIds: plan.marketIds,
      etaMax: plan.etaMax,
    );
  }

  PaymentState _state(String id) {
    final st = MockPlacedOrders.payments[id];
    if (st == null) throw const ApiException(404, 'not_found', 'Pedido não encontrado.');
    return st;
  }

  void _save(PaymentState st) {
    MockPlacedOrders.payments[st.orderId] = st;
    final i = MockPlacedOrders.items.indexWhere((o) => o.id == st.orderId);
    if (i >= 0) {
      final o = MockPlacedOrders.items[i];
      MockPlacedOrders.items[i] = OrderSummary(
        id: o.id,
        status: st.orderStatus,
        totalCents: o.totalCents,
        createdAt: o.createdAt,
        marketName: o.marketName,
        marketImageUrl: o.marketImageUrl,
        marketCount: o.marketCount,
        itemCount: o.itemCount,
        preview: o.preview,
      );
    }
  }

  @override
  Future<PaymentState> paymentState(String orderId) async {
    await Future<void>.delayed(const Duration(milliseconds: 250));
    return _state(orderId);
  }

  @override
  Future<PaymentState> pay(String orderId, PaymentMethod method, {String? cpf}) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));
    final st = _state(orderId);
    if (st.orderStatus != 'aguardando_pagamento') {
      throw const ApiException(409, 'not_payable', 'Este pedido não está aguardando pagamento.');
    }
    if (!MockPlacedOrders.hasCpf) {
      if (cpf == null || !isValidCpf(cpf)) throw const ApiException(400, 'invalid_cpf', 'Informe um CPF válido.');
      MockPlacedOrders.hasCpf = true;
    }
    final p = st.payment;
    if (p != null && p.status == PaymentStatus.pending && p.method == method) return st;
    final next = PaymentState(
      orderId: orderId,
      orderStatus: st.orderStatus,
      totalCents: st.totalCents,
      method: method,
      payment: PaymentInfo(
        id: 'demo-${DateTime.now().millisecondsSinceEpoch}',
        method: method,
        status: PaymentStatus.pending,
        amountCents: st.totalCents,
        pixPayload: method == PaymentMethod.pix
            ? '00020126DEMONSTRACAO-ECONOROTA-$orderId-${st.totalCents}6304ABCD'
            : null,
        pixExpiresAt: method == PaymentMethod.pix ? DateTime.now().add(const Duration(minutes: 30)) : null,
        invoiceUrl: method == PaymentMethod.card ? 'https://sandbox.asaas.com' : null,
        simulated: true,
      ),
    );
    _save(next);
    return next;
  }

  @override
  Future<bool> cancel(String orderId) async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    final st = _state(orderId);
    if (st.orderStatus != 'aguardando_pagamento' && st.orderStatus != 'pago') {
      throw const ApiException(
        409,
        'not_cancellable',
        'Este pedido já está em andamento e não pode ser cancelado aqui.',
      );
    }
    final refunded = st.orderStatus == 'pago';
    _save(
      PaymentState(
        orderId: orderId,
        orderStatus: 'cancelado',
        totalCents: st.totalCents,
        method: st.method,
        cancelReason: 'cliente',
        payment: st.payment?.copyWith(status: refunded ? PaymentStatus.refunded : PaymentStatus.cancelled),
      ),
    );
    return refunded;
  }

  @override
  Future<void> simulate(String orderId, {required bool approve}) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final st = _state(orderId);
    final p = st.payment;
    if (p == null || p.status != PaymentStatus.pending) return;
    if (approve) MockPlacedOrders.paidAt[orderId] = DateTime.now();
    _save(
      PaymentState(
        orderId: orderId,
        orderStatus: approve ? 'pago' : st.orderStatus,
        totalCents: st.totalCents,
        method: st.method,
        deliveryCode: approve ? MockCourierRepository.demoCode : null,
        payment: p.copyWith(
          status: approve ? PaymentStatus.approved : PaymentStatus.refused,
          failureReason: approve ? null : 'cartao_recusado',
        ),
      ),
    );
  }

  /// Demonstração: simula mercados separando e o entregador percorrendo a rota (avança com o tempo).
  @override
  Future<OrderTracking> tracking(String orderId) async {
    await Future<void>.delayed(const Duration(milliseconds: 250));
    final known = [...MockPlacedOrders.items, ...MockData.orders].where((o) => o.id == orderId).firstOrNull;
    final finished = known != null && (known.status == 'entregue' || known.status == 'cancelado');
    final ids = MockPlacedOrders.markets[orderId] ?? const ['m1', 'm2'];
    if (finished) {
      final ms = [for (final id in ids) MockData.markets.firstWhere((m) => m.id == id)];
      return OrderTracking(
        id: orderId,
        status: known.status,
        light: TrafficLight.green,
        etaMin: 0,
        arrivalAt: known.createdAt.add(const Duration(minutes: 48)),
        totalKm: 3.4,
        remainingKm: 0,
        customerLat: MockData.center.lat,
        customerLng: MockData.center.lng,
        stops: [
          for (final (i, m) in ms.indexed)
            TrackStop(
              id: 's$i',
              sequence: i + 1,
              name: m.name,
              imageUrl: m.imageUrl,
              lat: m.lat!,
              lng: m.lng!,
              status: known.status == 'entregue' ? 'entregue' : 'cancelado',
            ),
        ],
        demo: true,
      );
    }
    final paid = MockPlacedOrders.paidAt[orderId] ?? DateTime.now().subtract(const Duration(seconds: 25));
    final st = MockPlacedOrders.payments[orderId];
    final markets = [for (final id in ids) MockData.markets.firstWhere((m) => m.id == id)];
    final home = (lat: MockData.center.lat, lng: MockData.center.lng);
    final t = DateTime.now().difference(paid).inSeconds;
    const sep = 12, leg = 14;
    // Linha do tempo: separação → entregador vai a cada mercado → a caminho do cliente → chegou.
    final points = [for (final m in markets) (lat: m.lat!, lng: m.lng!), home];
    final start = (lat: markets.first.lat! + .006, lng: markets.first.lng! - .004);
    final travel = (t - sep).clamp(0, leg * points.length);
    final legIdx = travel ~/ leg;
    final frac = (travel % leg) / leg;
    final from = legIdx == 0 ? start : points[(legIdx - 1).clamp(0, points.length - 1)];
    final to = points[legIdx.clamp(0, points.length - 1)];
    final courierPos = t < sep
        ? null
        : legIdx >= points.length
        ? home
        : (lat: from.lat + (to.lat - from.lat) * frac, lng: from.lng + (to.lng - from.lng) * frac);
    final arrived = t >= sep + leg * points.length;
    final picked = t < sep ? 0 : legIdx.clamp(0, markets.length);
    final status = st?.orderStatus == 'cancelado'
        ? 'cancelado'
        : arrived || picked == markets.length
        ? 'em_rota'
        : picked > 0 || t >= sep
        ? 'em_separacao'
        : 'pago';
    final remaining = ((points.length - legIdx).clamp(0, points.length) * leg / 60 * 4).round();
    return OrderTracking(
      id: orderId,
      status: status,
      courierStatus: arrived ? 'chegou' : (picked == markets.length ? 'a_caminho' : (t >= sep ? 'aceito' : null)),
      light: TrafficLight.green,
      etaMin: arrived ? 0 : (t < sep ? 25 : remaining.clamp(2, 60)),
      arrivalAt: DateTime.now().add(Duration(minutes: arrived ? 0 : (t < sep ? 25 : remaining.clamp(2, 60)))),
      promisedAt: paid.add(const Duration(minutes: 55)),
      totalKm: 3.4,
      remainingKm: arrived ? 0 : (3.4 * (1 - legIdx / points.length)).clamp(0.2, 3.4),
      customerLat: home.lat,
      customerLng: home.lng,
      stops: [
        for (final (i, m) in markets.indexed)
          TrackStop(
            id: 's$i',
            sequence: i + 1,
            name: m.name,
            imageUrl: m.imageUrl,
            lat: m.lat!,
            lng: m.lng!,
            status: i < picked ? 'retirado' : (t >= sep + i * 4 ? 'pronto' : 'em_separacao'),
            pickedAt: i < picked ? paid.add(Duration(seconds: sep + leg * (i + 1))) : null,
            courierHere: courierPos != null && i == legIdx - 1 && frac < .2,
          ),
      ],
      courier: t < sep
          ? null
          : TrackCourier(
              firstName: 'Carlos',
              vehicle: 'Moto · CG 160 · Preta',
              plate: 'ABC1D23',
              lat: courierPos?.lat,
              lng: courierPos?.lng,
            ),
      deliveryCode: MockCourierRepository.demoCode,
      demo: true,
    );
  }
}

/// Pedidos criados no modo demonstração (somem ao fechar o app).
class MockPlacedOrders {
  static final List<OrderSummary> items = [];
  static final Map<String, PaymentState> payments = {};
  static final Map<String, List<String>> markets = {};
  static final Map<String, DateTime> paidAt = {};
  static bool hasCpf = false;
}
