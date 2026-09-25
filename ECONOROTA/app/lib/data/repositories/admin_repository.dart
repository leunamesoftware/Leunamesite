import 'dart:typed_data';

import 'package:flutter/material.dart' show DateUtils;

import '../../services/api_client.dart';
import '../mock/mock_data.dart';
import '../models/admin.dart';
import '../models/finance.dart';
import '../models/occurrence.dart';

/// Painel administrativo (Fase 13).
abstract interface class AdminRepository {
  Future<Set<AdminArea>> areas();
  Future<AdminSummary> summary();

  Future<List<AdminCustomer>> customers({String? q, String? status});
  Future<void> setUserBlocked(String userId, bool blocked, {String? reason});

  Future<List<AdminMarket>> markets({String? status, String? q});
  Future<void> setMarketStatus(String id, String status, {String? reason});

  Future<List<AdminCourier>> couriers({String? filter});
  Future<AdminCourier> courier(String id);
  Future<Uint8List> courierDocument(String id, String type);
  Future<void> decideCourier(String id, String decision, {String? note});

  Future<List<AdminProduct>> products({String? q, String? filter});
  Future<void> setProductActive(String id, bool active, {String? reason});

  Future<List<AdminOrder>> orders({String? group, String? q});
  Future<AdminOrderDetail> order(String id);
  Future<void> cancelOrder(String id, String reason);
  Future<List<AdminDelivery>> deliveries();

  Future<List<AdminRegion>> regions();
  Future<void> saveRegion({
    String? id,
    required String name,
    required String city,
    required String state,
    required double lat,
    required double lng,
    required double radiusKm,
  });
  Future<void> setRegionActive(String id, bool active);

  Future<List<AdminRating>> ratings({int maxStars = 5, bool hidden = false});
  Future<void> setRatingHidden(AdminRating r, bool hidden);

  Future<({List<AdminPayment> items, int receivedCents, int refundedCents, int pending})> payments({String? status});
  Future<AdminReport> report(int days);

  Future<AdminFinance> finance(int days);
  Future<List<Payout>> payouts({String? status});
  Future<({int created, int totalCents})> generatePayouts();
  Future<void> payPayout(String id, String reference);
  Future<void> cancelPayout(String id);

  Future<AdminSettings> settings();
  Future<AdminSettings> saveSettings(Map<String, int> values);

  Future<List<AdminMember>> team();
  Future<void> addMember({
    required String name,
    required String email,
    required String password,
    required Set<AdminArea> areas,
  });
  Future<void> updateMember(String id, {Set<AdminArea>? areas, bool? blocked});

  Future<({List<AuditEntry> items, int? nextOffset})> audit({String? action, int offset = 0});

  Future<List<AdminOccurrence>> occurrences({String? status});
  Future<AdminOccurrenceDetail> occurrence(String id);
  Future<Uint8List> evidence(String occurrenceId, String evidenceId);
  Future<void> analyze(String id);
  Future<void> decide(String id, String resolution, String note, {int? cents});
}

List<T> _list<T>(Map<String, dynamic> j, T Function(Map<String, dynamic>) f) =>
    (j['items'] as List).cast<Map<String, dynamic>>().map(f).toList();

String _qs(Map<String, Object?> p) {
  final e = p.entries.where((e) => e.value != null && '${e.value}'.isNotEmpty);
  return e.isEmpty ? '' : '?${e.map((e) => '${e.key}=${Uri.encodeQueryComponent('${e.value}')}').join('&')}';
}

class ApiAdminRepository implements AdminRepository {
  ApiAdminRepository(this._api);

  final ApiClient _api;

  @override
  Future<Set<AdminArea>> areas() async {
    final j = await _api.get('/admin/eu');
    return {for (final a in (j['perms'] as List).cast<String>()) ...AdminArea.values.where((x) => x.name == a)};
  }

  @override
  Future<AdminSummary> summary() async => AdminSummary.fromJson(await _api.get('/admin/resumo'));

  @override
  Future<List<AdminCustomer>> customers({String? q, String? status}) async =>
      _list(await _api.get('/admin/clientes${_qs({'q': q, 'status': status})}'), AdminCustomer.fromJson);

  @override
  Future<void> setUserBlocked(String userId, bool blocked, {String? reason}) =>
      _api.post('/admin/usuarios-status/$userId', {'status': blocked ? 'bloqueado' : 'ativo', 'motivo': ?reason});

  @override
  Future<List<AdminMarket>> markets({String? status, String? q}) async =>
      _list(await _api.get('/admin/mercados${_qs({'status': status, 'q': q})}'), AdminMarket.fromJson);

  @override
  Future<void> setMarketStatus(String id, String status, {String? reason}) =>
      _api.post('/admin/mercados/$id/status', {'status': status, 'motivo': ?reason});

  @override
  Future<List<AdminCourier>> couriers({String? filter}) async =>
      _list(await _api.get('/admin/entregadores${_qs({'status': filter})}'), AdminCourier.fromJson);

  @override
  Future<AdminCourier> courier(String id) async =>
      AdminCourier.fromJson((await _api.get('/admin/entregadores/$id'))['courier'] as Map<String, dynamic>);

  @override
  Future<Uint8List> courierDocument(String id, String type) => _api.bytes('/admin/entregadores/$id/arquivos/$type');

  @override
  Future<void> decideCourier(String id, String decision, {String? note}) =>
      _api.post('/admin/entregadores/$id/decidir', {'decisao': decision, 'nota': ?note});

  @override
  Future<List<AdminProduct>> products({String? q, String? filter}) async =>
      _list(await _api.get('/admin/produtos${_qs({'q': q, 'filtro': filter})}'), AdminProduct.fromJson);

  @override
  Future<void> setProductActive(String id, bool active, {String? reason}) =>
      _api.post('/admin/produtos/$id/ativo', {'ativo': active, 'motivo': ?reason});

  @override
  Future<List<AdminOrder>> orders({String? group, String? q}) async =>
      _list(await _api.get('/admin/pedidos${_qs({'grupo': group, 'q': q})}'), AdminOrder.fromJson);

  @override
  Future<AdminOrderDetail> order(String id) async =>
      AdminOrderDetail.fromJson((await _api.get('/admin/pedidos/$id'))['order'] as Map<String, dynamic>);

  @override
  Future<void> cancelOrder(String id, String reason) => _api.post('/admin/pedidos/$id/cancelar', {'motivo': reason});

  @override
  Future<List<AdminDelivery>> deliveries() async => _list(await _api.get('/admin/entregas'), AdminDelivery.fromJson);

  @override
  Future<List<AdminRegion>> regions() async => _list(await _api.get('/admin/regioes'), AdminRegion.fromJson);

  @override
  Future<void> saveRegion({
    String? id,
    required String name,
    required String city,
    required String state,
    required double lat,
    required double lng,
    required double radiusKm,
  }) {
    final body = {'name': name, 'city': city, 'state': state, 'lat': lat, 'lng': lng, 'radius_km': radiusKm};
    return id == null ? _api.post('/admin/regioes', body) : _api.patch('/admin/regioes/$id', body);
  }

  @override
  Future<void> setRegionActive(String id, bool active) => _api.patch('/admin/regioes/$id', {'is_active': active});

  @override
  Future<List<AdminRating>> ratings({int maxStars = 5, bool hidden = false}) async => _list(
    await _api.get('/admin/avaliacoes${_qs({'estrelas_max': maxStars, 'ocultas': hidden ? 1 : null})}'),
    AdminRating.fromJson,
  );

  @override
  Future<void> setRatingHidden(AdminRating r, bool hidden) =>
      _api.post('/admin/avaliacoes/${r.source}/${r.id}/ocultar', {'oculta': hidden});

  @override
  Future<({List<AdminPayment> items, int receivedCents, int refundedCents, int pending})> payments({
    String? status,
  }) async {
    final j = await _api.get('/admin/pagamentos${_qs({'status': status})}');
    final t = j['totals_30d'] as Map<String, dynamic>? ?? const {};
    return (
      items: _list(j, AdminPayment.fromJson),
      receivedCents: (t['received_cents'] as num?)?.toInt() ?? 0,
      refundedCents: (t['refunded_cents'] as num?)?.toInt() ?? 0,
      pending: (t['pending'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  Future<AdminReport> report(int days) async => AdminReport.fromJson(await _api.get('/admin/relatorios?dias=$days'));

  @override
  Future<AdminFinance> finance(int days) async => AdminFinance.fromJson(await _api.get('/admin/financeiro?dias=$days'));

  @override
  Future<List<Payout>> payouts({String? status}) async =>
      _list(await _api.get('/admin/repasses${_qs({'status': status})}'), Payout.fromJson);

  @override
  Future<({int created, int totalCents})> generatePayouts() async {
    final j = await _api.post('/admin/repasses/gerar', {});
    return (created: (j['created'] as num).toInt(), totalCents: (j['total_cents'] as num).toInt());
  }

  @override
  Future<void> payPayout(String id, String reference) =>
      _api.post('/admin/repasses/$id/pagar', {'referencia': reference});

  @override
  Future<void> cancelPayout(String id) => _api.post('/admin/repasses/$id/cancelar', {});

  @override
  Future<AdminSettings> settings() async => AdminSettings.fromJson(await _api.get('/admin/configuracoes'));

  @override
  Future<AdminSettings> saveSettings(Map<String, int> values) async {
    await _api.put('/admin/configuracoes', values);
    return settings();
  }

  @override
  Future<List<AdminMember>> team() async => _list(await _api.get('/admin/equipe'), AdminMember.fromJson);

  @override
  Future<void> addMember({
    required String name,
    required String email,
    required String password,
    required Set<AdminArea> areas,
  }) => _api.post('/admin/equipe', {
    'name': name,
    'email': email,
    'password': password,
    'permissoes': [for (final a in areas) a.name],
  });

  @override
  Future<void> updateMember(String id, {Set<AdminArea>? areas, bool? blocked}) => _api.patch('/admin/equipe/$id', {
    if (areas != null) 'permissoes': [for (final a in areas) a.name],
    if (blocked != null) 'status': blocked ? 'bloqueado' : 'ativo',
  });

  @override
  Future<({List<AuditEntry> items, int? nextOffset})> audit({String? action, int offset = 0}) async {
    final j = await _api.get('/admin/auditoria${_qs({'acao': action, 'offset': offset == 0 ? null : offset})}');
    return (items: _list(j, AuditEntry.fromJson), nextOffset: (j['next_offset'] as num?)?.toInt());
  }

  @override
  Future<List<AdminOccurrence>> occurrences({String? status}) async =>
      _list(await _api.get('/admin/ocorrencias${_qs({'status': status})}'), AdminOccurrence.fromJson);

  @override
  Future<AdminOccurrenceDetail> occurrence(String id) async =>
      AdminOccurrenceDetail.fromJson(await _api.get('/admin/ocorrencias/$id'));

  @override
  Future<Uint8List> evidence(String occurrenceId, String evidenceId) =>
      _api.bytes('/admin/ocorrencias/$occurrenceId/evidencias/$evidenceId');

  @override
  Future<void> analyze(String id) => _api.post('/admin/ocorrencias/$id/analisar', {});

  @override
  Future<void> decide(String id, String resolution, String note, {int? cents}) =>
      _api.post('/admin/ocorrencias/$id/decidir', {'resolucao': resolution, 'nota': note, 'valor_cents': ?cents});
}

/// Demonstração do painel (dados fictícios, mesmas regras principais da API).
class MockAdminRepository implements AdminRepository {
  MockAdminRepository() {
    final now = DateTime.now();
    _markets.addAll([
      for (final (i, m) in MockData.markets.indexed)
        AdminMarket(
          id: m.id,
          name: m.name,
          status: 'ativo',
          ownerName: m.name,
          ownerEmail: 'financeiro.${m.id}@demo.app',
          district: m.district,
          city: 'São Paulo',
          isOpen: true,
          rating: m.rating,
          ratingCount: m.ratingCount,
          products: 40 + i * 7,
          orders30d: 120 - i * 18,
          sales30dCents: 1890000 - i * 260000,
          imageUrl: m.imageUrl,
        ),
      const AdminMarket(
        id: 'm9',
        name: 'Mercadinho Bairro Bom',
        status: 'pendente',
        ownerName: 'Paulo Andrade',
        ownerEmail: 'paulo@bairrobom.com.br',
        district: 'Consolação',
        city: 'São Paulo',
      ),
    ]);
    _couriers.addAll([
      AdminCourier(
        id: 'c-novo',
        name: 'Rafael Souza',
        email: 'rafael@email.com',
        phone: '(11) 98888-1234',
        status: 'pendente',
        vehicleType: 'moto',
        vehiclePlate: 'FTR4B21',
        vehicleModel: 'Honda CG 160',
        vehicleColor: 'Vermelha',
        cnhNumber: '04512378901',
        birthDate: '1996-03-14',
        cpf: '529.982.247-25',
        pixKey: 'rafael@email.com',
        submittedAt: now.subtract(const Duration(hours: 3)),
        hasDocument: true,
        hasVehicleDoc: true,
      ),
      const AdminCourier(
        id: 'c1',
        name: 'Carlos Lima',
        email: 'carlos@email.com',
        status: 'aprovado',
        vehicleType: 'moto',
        vehiclePlate: 'ABC1D23',
        isOnline: true,
        rating: 4.9,
        ratingCount: 312,
        deliveries: 356,
        hasDocument: true,
        hasVehicleDoc: true,
      ),
      const AdminCourier(
        id: 'c2',
        name: 'Juliana Ramos',
        email: 'ju@email.com',
        status: 'aprovado',
        vehicleType: 'bicicleta',
        rating: 4.8,
        ratingCount: 120,
        deliveries: 141,
        hasDocument: true,
      ),
    ]);
    _customers.addAll([
      AdminCustomer(
        id: 'u1',
        name: 'Maria Silva',
        email: 'maria@email.com',
        phone: '(11) 98765-4321',
        status: 'ativo',
        createdAt: now.subtract(const Duration(days: 40)),
        rating: 5,
        orders: 12,
        spentCents: 162340,
        occurrences: 1,
      ),
      AdminCustomer(
        id: 'u2',
        name: 'João Pereira',
        email: 'joao@email.com',
        status: 'ativo',
        createdAt: now.subtract(const Duration(days: 12)),
        rating: 4.7,
        orders: 4,
        spentCents: 51290,
      ),
      AdminCustomer(
        id: 'u3',
        name: 'Ana Costa',
        email: 'ana@email.com',
        status: 'ativo',
        createdAt: now.subtract(const Duration(days: 2)),
        orders: 1,
        spentCents: 11890,
      ),
    ]);
    _orders.addAll([
      AdminOrder(
        id: 'a1b2c3d4-0001',
        status: 'em_rota',
        totalCents: 14230,
        createdAt: now.subtract(const Duration(minutes: 38)),
        customerName: 'Maria Silva',
        markets: 'SuperMais, EconoMarket',
        courierName: 'Carlos Lima',
        paymentMethod: 'pix',
      ),
      AdminOrder(
        id: 'b2c3d4e5-0002',
        status: 'em_separacao',
        totalCents: 11890,
        createdAt: now.subtract(const Duration(minutes: 12)),
        customerName: 'Ana Costa',
        markets: 'Mercado Central',
        paymentMethod: 'cartao',
      ),
      AdminOrder(
        id: 'c3d4e5f6-0003',
        status: 'entregue',
        totalCents: 12870,
        createdAt: now.subtract(const Duration(days: 1)),
        customerName: 'João Pereira',
        markets: 'SuperMais',
        courierName: 'Juliana Ramos',
        paymentMethod: 'pix',
        openOccurrences: 1,
      ),
    ]);
  }

  final _markets = <AdminMarket>[];
  final _couriers = <AdminCourier>[];
  final _customers = <AdminCustomer>[];
  final _orders = <AdminOrder>[];
  final _blocked = <String>{};
  final _hiddenRatings = <String>{};
  final _inactive = <String>{};
  var _settings = {
    'min_order_cents': 10000,
    'commission_pct': 10,
    'courier_share_pct': 80,
    'delivery_base_cents': 790,
    'delivery_extra_market_cents': 300,
    'market_hold_days': 2,
  };
  final _regions = [
    const AdminRegion(
      id: 'r1',
      name: 'Centro expandido',
      city: 'São Paulo',
      state: 'SP',
      lat: -23.557,
      lng: -46.656,
      radiusKm: 8,
      active: true,
      markets: 5,
      couriersOnline: 2,
    ),
  ];
  final _team = [
    const AdminMember(
      id: 'demo',
      name: 'Administrador',
      email: 'admin@demo.app',
      status: 'ativo',
      areas: {AdminArea.operacao, AdminArea.financeiro, AdminArea.sistema},
    ),
  ];
  final _audit = <AuditEntry>[];
  final _occ = <String, String>{'oc-demo-1': 'aberta'};

  Future<void> _wait() => Future<void>.delayed(const Duration(milliseconds: 200));

  void _log(String action, [String? entity, Object? data]) => _audit.insert(
    0,
    AuditEntry(
      action: action,
      entity: entity,
      data: data,
      userName: 'Administrador',
      userRole: 'admin',
      createdAt: DateTime.now(),
    ),
  );

  @override
  Future<Set<AdminArea>> areas() async => AdminArea.values.toSet();

  @override
  Future<AdminSummary> summary() async {
    await _wait();
    final today = DateUtils.dateOnly(DateTime.now());
    return AdminSummary(
      kpis: {
        'orders_today': 38,
        'gmv_today': 482350,
        'active_orders': _orders
            .where((o) => const {'pago', 'em_separacao', 'pronto_coleta', 'em_rota'}.contains(o.status))
            .length,
        'on_route': 1,
        'customers': 1284,
        'new_customers': 17,
        'markets_active': _markets.where((m) => m.status == 'ativo').length,
        'markets_pending': _markets.where((m) => m.status == 'pendente').length,
        'couriers_approved': _couriers.where((c) => c.status == 'aprovado').length,
        'couriers_online': _couriers.where((c) => c.isOnline).length,
        'couriers_pending': _couriers.where((c) => c.inReview).length,
        'occurrences_open': _occ.values.where((s) => s == 'aberta' || s == 'em_analise').length,
        'products_out': 6,
      },
      byDay: [
        for (var i = 6; i >= 0; i--)
          (day: today.subtract(Duration(days: i)), orders: 24 + (i * 7) % 15, gmvCents: 310000 + (i * 53000) % 190000),
      ],
    );
  }

  @override
  Future<List<AdminCustomer>> customers({String? q, String? status}) async {
    await _wait();
    final t = (q ?? '').toLowerCase();
    return [
      for (final c in _customers)
        if (t.isEmpty || c.name.toLowerCase().contains(t) || c.email.contains(t))
          AdminCustomer(
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            status: _blocked.contains(c.id) ? 'bloqueado' : 'ativo',
            createdAt: c.createdAt,
            rating: c.rating,
            orders: c.orders,
            spentCents: c.spentCents,
            occurrences: c.occurrences,
          ),
    ].where((c) => status == null || c.status == status).toList();
  }

  @override
  Future<void> setUserBlocked(String userId, bool blocked, {String? reason}) async {
    await _wait();
    blocked ? _blocked.add(userId) : _blocked.remove(userId);
    _log(blocked ? 'user.block' : 'user.unblock', 'user', {'reason': reason});
  }

  @override
  Future<List<AdminMarket>> markets({String? status, String? q}) async {
    await _wait();
    return _markets.where((m) => status == null || m.status == status).toList();
  }

  @override
  Future<void> setMarketStatus(String id, String status, {String? reason}) async {
    await _wait();
    if (status == 'suspenso' && (reason ?? '').isEmpty) {
      throw const ApiException(400, 'validation', 'Informe o motivo da suspensão.');
    }
    final i = _markets.indexWhere((m) => m.id == id);
    _markets[i] = _markets[i].withStatus(status);
    _log('market.$status', 'market', {'reason': reason});
  }

  @override
  Future<List<AdminCourier>> couriers({String? filter}) async {
    await _wait();
    return _couriers
        .where(
          (c) => switch (filter) {
            'analise' => c.inReview,
            'aprovado' => c.status == 'aprovado',
            'bloqueado' => c.status == 'bloqueado',
            _ => true,
          },
        )
        .toList();
  }

  @override
  Future<AdminCourier> courier(String id) async {
    await _wait();
    return _couriers.firstWhere((c) => c.id == id);
  }

  @override
  Future<Uint8List> courierDocument(String id, String type) async =>
      throw const ApiException(404, 'not_found', 'Na demonstração os documentos não são exibidos.');

  @override
  Future<void> decideCourier(String id, String decision, {String? note}) async {
    await _wait();
    if ((decision == 'recusar' || decision == 'bloquear') && (note ?? '').isEmpty) {
      throw const ApiException(400, 'validation', 'Explique o motivo para o entregador.');
    }
    final i = _couriers.indexWhere((c) => c.id == id);
    final c = _couriers[i];
    _couriers[i] = AdminCourier(
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      status: switch (decision) {
        'aprovar' || 'desbloquear' => 'aprovado',
        'bloquear' => 'bloqueado',
        _ => 'pendente',
      },
      vehicleType: c.vehicleType,
      vehiclePlate: c.vehiclePlate,
      vehicleModel: c.vehicleModel,
      vehicleColor: c.vehicleColor,
      cnhNumber: c.cnhNumber,
      birthDate: c.birthDate,
      cpf: c.cpf,
      pixKey: c.pixKey,
      submittedAt: decision == 'recusar' ? null : c.submittedAt,
      reviewNote: note,
      rating: c.rating,
      ratingCount: c.ratingCount,
      deliveries: c.deliveries,
      hasDocument: c.hasDocument,
      hasVehicleDoc: c.hasVehicleDoc,
    );
    _log('courier.$decision', 'courier', {'note': note});
  }

  @override
  Future<List<AdminProduct>> products({String? q, String? filter}) async {
    await _wait();
    final names = {for (final m in MockData.markets) m.id: m.name};
    final t = (q ?? '').toLowerCase();
    return [
      for (final (i, p) in MockData.products.indexed)
        if (t.isEmpty || p.name.toLowerCase().contains(t))
          AdminProduct(
            id: p.id,
            name: p.name,
            brand: p.brand,
            unit: p.unit,
            marketName: names[p.marketId] ?? '',
            priceCents: p.priceCents,
            promoPriceCents: p.promoPriceCents,
            stock: i % 9 == 0 ? 0 : p.stock,
            minStock: 5,
            active: !_inactive.contains(p.id),
            imageUrl: p.imageUrl,
          ),
    ].where((p) {
      return switch (filter) {
        'indisponivel' => p.stock == 0,
        'baixo' => p.stock > 0 && p.stock <= p.minStock,
        'inativo' => !p.active,
        _ => p.active,
      };
    }).toList();
  }

  @override
  Future<void> setProductActive(String id, bool active, {String? reason}) async {
    await _wait();
    if (!active && (reason ?? '').isEmpty) throw const ApiException(400, 'validation', 'Informe o motivo.');
    active ? _inactive.remove(id) : _inactive.add(id);
    _log(active ? 'product.activate' : 'product.deactivate', 'product', {'reason': reason});
  }

  @override
  Future<List<AdminOrder>> orders({String? group, String? q}) async {
    await _wait();
    return _orders
        .where(
          (o) => switch (group) {
            'andamento' => const {'pago', 'em_separacao', 'pronto_coleta', 'em_rota'}.contains(o.status),
            'entregues' => o.status == 'entregue',
            'cancelados' => o.status == 'cancelado',
            'pagamento' => o.status == 'aguardando_pagamento',
            _ => true,
          },
        )
        .toList();
  }

  @override
  Future<AdminOrderDetail> order(String id) async {
    await _wait();
    final o = _orders.firstWhere((o) => o.id == id);
    final products = MockData.products.take(4).toList();
    return AdminOrderDetail(
      order: o,
      subtotalCents: o.totalCents - 1090,
      deliveryFeeCents: 1090,
      customerEmail: 'cliente@email.com',
      customerPhone: '(11) 98765-4321',
      address: 'Av. Paulista, 1000 · Bela Vista · São Paulo',
      paidAt: o.createdAt.add(const Duration(minutes: 1)),
      markets: [
        (
          name: o.markets.split(', ').first,
          sequence: 1,
          status: o.status == 'entregue' ? 'retirado' : 'em_separacao',
          subtotalCents: o.totalCents - 1090,
          items: [
            for (final p in products) (name: p.name, quantity: 1, unitPriceCents: p.finalPriceCents, checked: true),
          ],
        ),
      ],
      payments: [
        (
          method: o.paymentMethod ?? 'pix',
          status: o.status == 'cancelado' ? 'estornado' : 'aprovado',
          amountCents: o.totalCents,
          refundedCents: 0,
          createdAt: o.createdAt,
        ),
      ],
      occurrences: const [],
    );
  }

  @override
  Future<void> cancelOrder(String id, String reason) async {
    await _wait();
    final i = _orders.indexWhere((o) => o.id == id);
    final o = _orders[i];
    if (!const {'aguardando_pagamento', 'pago', 'em_separacao', 'pronto_coleta'}.contains(o.status)) {
      throw const ApiException(409, 'not_cancellable', 'Este pedido não pode mais ser cancelado.');
    }
    _orders[i] = AdminOrder(
      id: o.id,
      status: 'cancelado',
      totalCents: o.totalCents,
      createdAt: o.createdAt,
      customerName: o.customerName,
      markets: o.markets,
      paymentMethod: o.paymentMethod,
    );
    _log('order.admin_cancel', 'order', {'reason': reason});
  }

  @override
  Future<List<AdminDelivery>> deliveries() async {
    await _wait();
    return const [
      AdminDelivery(
        orderId: 'a1b2c3d4-0001',
        status: 'em_rota',
        stops: 2,
        picked: 2,
        courierName: 'Carlos Lima',
        vehicleType: 'moto',
        minutesLeft: 14,
        gpsStale: false,
      ),
      AdminDelivery(orderId: 'b2c3d4e5-0002', status: 'em_separacao', stops: 1, picked: 0, minutesLeft: 41),
    ];
  }

  @override
  Future<List<AdminRegion>> regions() async {
    await _wait();
    return List.of(_regions);
  }

  @override
  Future<void> saveRegion({
    String? id,
    required String name,
    required String city,
    required String state,
    required double lat,
    required double lng,
    required double radiusKm,
  }) async {
    await _wait();
    final r = AdminRegion(
      id: id ?? 'r${_regions.length + 1}',
      name: name,
      city: city,
      state: state.toUpperCase(),
      lat: lat,
      lng: lng,
      radiusKm: radiusKm,
      active: true,
    );
    final i = _regions.indexWhere((x) => x.id == r.id);
    i < 0 ? _regions.add(r) : _regions[i] = r;
    _log(id == null ? 'region.create' : 'region.update', 'region');
  }

  @override
  Future<void> setRegionActive(String id, bool active) async {
    await _wait();
    final i = _regions.indexWhere((x) => x.id == id);
    final r = _regions[i];
    _regions[i] = AdminRegion(
      id: r.id,
      name: r.name,
      city: r.city,
      state: r.state,
      lat: r.lat,
      lng: r.lng,
      radiusKm: r.radiusKm,
      active: active,
      markets: r.markets,
      couriersOnline: r.couriersOnline,
    );
  }

  @override
  Future<List<AdminRating>> ratings({int maxStars = 5, bool hidden = false}) async {
    await _wait();
    final now = DateTime.now();
    final all = [
      AdminRating(
        source: 'loja',
        id: 'rv1',
        orderId: 'c3d4e5f6-0003',
        fromRole: 'cliente',
        fromName: 'João Pereira',
        toType: 'mercado',
        toName: 'SuperMais',
        stars: 2,
        comment: 'Veio um tomate amassado.',
        tags: const ['Embalagem ruim'],
        createdAt: now.subtract(const Duration(hours: 20)),
      ),
      AdminRating(
        source: 'interna',
        id: 'rv2',
        orderId: 'c3d4e5f6-0003',
        fromRole: 'cliente',
        fromName: 'João Pereira',
        toType: 'entregador',
        toName: 'Juliana Ramos',
        stars: 5,
        tags: const ['Pontual', 'Educado'],
        createdAt: now.subtract(const Duration(hours: 20)),
      ),
    ];
    return all.where((r) => r.stars <= maxStars && _hiddenRatings.contains(r.id) == hidden).toList();
  }

  @override
  Future<void> setRatingHidden(AdminRating r, bool hidden) async {
    await _wait();
    hidden ? _hiddenRatings.add(r.id) : _hiddenRatings.remove(r.id);
    _log(hidden ? 'rating.hide' : 'rating.show', 'rating');
  }

  @override
  Future<({List<AdminPayment> items, int receivedCents, int refundedCents, int pending})> payments({
    String? status,
  }) async {
    await _wait();
    final items = [
      for (final o in _orders)
        AdminPayment(
          id: 'pay-${o.id}',
          orderId: o.id,
          method: o.paymentMethod ?? 'pix',
          status: o.status == 'cancelado' ? 'estornado' : 'aprovado',
          amountCents: o.totalCents,
          createdAt: o.createdAt,
          customerName: o.customerName,
        ),
    ].where((p) => status == null || p.status == status).toList();
    return (items: items, receivedCents: 12450900, refundedCents: 38790, pending: 2);
  }

  @override
  Future<AdminReport> report(int days) async {
    await _wait();
    final today = DateUtils.dateOnly(DateTime.now());
    final gmv = 9870000 * days ~/ 30;
    final items = gmv * 92 ~/ 100;
    final delivery = gmv - items;
    final commission = items * (_settings['commission_pct']!) ~/ 100;
    final platformDelivery = delivery - delivery * _settings['courier_share_pct']! ~/ 100;
    return AdminReport(
      days: days,
      summary: {
        'orders': 812 * days ~/ 30,
        'gmv_cents': gmv,
        'items_cents': items,
        'delivery_cents': delivery,
        'savings_cents': gmv * 11 ~/ 100,
        'customers': 604 * days ~/ 30,
        'avg_ticket_cents': 12155,
        'commission_cents': commission,
        'platform_delivery_cents': platformDelivery,
        'platform_revenue_cents': commission + platformDelivery,
      },
      byDay: [
        for (var i = days - 1; i >= 0; i--)
          (day: today.subtract(Duration(days: i)), orders: 20 + (i * 7) % 15, gmvCents: 260000 + (i * 53000) % 190000),
      ],
      byMarket: [
        for (final m in _markets.where((m) => m.status == 'ativo'))
          (name: m.name, orders: m.orders30d * days ~/ 30, salesCents: m.sales30dCents * days ~/ 30),
      ],
      topProducts: [
        for (final (i, p) in MockData.products.take(8).indexed)
          (name: p.name, quantity: 180 - i * 17, salesCents: (180 - i * 17) * p.finalPriceCents),
      ],
      delivered: 790 * days ~/ 30,
      onTime: 741 * days ~/ 30,
      avgMinutes: 42,
    );
  }

  final _payouts = <Payout>[];
  var _generated = false;

  @override
  Future<AdminFinance> finance(int days) async {
    await _wait();
    final pending = _payouts.where((p) => p.status == 'pendente').fold(0, (s, p) => s + p.amountCents);
    return AdminFinance(
      commissionCents: 812340 * days ~/ 30,
      deliveryCents: 176520 * days ~/ 30,
      netCents: 950110 * days ~/ 30,
      marketsAvailableCents: _generated ? 0 : 1845210,
      marketsHeldCents: 392880,
      couriersAvailableCents: _generated ? 0 : 305430,
      pendingPayoutsCents: pending,
      refundsCents: 38790,
    );
  }

  @override
  Future<List<Payout>> payouts({String? status}) async {
    await _wait();
    return _payouts.where((p) => status == null || p.status == status).toList();
  }

  @override
  Future<({int created, int totalCents})> generatePayouts() async {
    await _wait();
    if (_generated) return (created: 0, totalCents: 0);
    _generated = true;
    final now = DateTime.now();
    _payouts.addAll([
      for (final (i, m) in _markets.where((m) => m.status == 'ativo').indexed)
        Payout(
          id: 'rp-m$i',
          partyType: 'mercado',
          partyName: m.name,
          amountCents: 520000 - i * 80000,
          status: 'pendente',
          pixKey: m.ownerEmail,
          createdAt: now,
          entries: 40 - i * 5,
        ),
      Payout(
        id: 'rp-c1',
        partyType: 'entregador',
        partyName: 'Carlos Lima',
        amountCents: 184320,
        status: 'pendente',
        pixKey: 'carlos@email.com',
        createdAt: now,
        entries: 21,
      ),
    ]);
    _log('payout.generate', 'payout');
    return (created: _payouts.length, totalCents: _payouts.fold(0, (s, p) => s + p.amountCents));
  }

  void _setPayout(String id, String status, [String? reference]) {
    final i = _payouts.indexWhere((p) => p.id == id);
    final p = _payouts[i];
    if (p.status != 'pendente') throw const ApiException(409, 'invalid_state', 'Repasse não está pendente.');
    _payouts[i] = Payout(
      id: p.id,
      partyType: p.partyType,
      partyName: p.partyName,
      amountCents: p.amountCents,
      status: status,
      pixKey: p.pixKey,
      reference: reference,
      createdAt: p.createdAt,
      paidAt: status == 'pago' ? DateTime.now() : null,
      entries: p.entries,
    );
  }

  @override
  Future<void> payPayout(String id, String reference) async {
    await _wait();
    _setPayout(id, 'pago', reference);
    _log('payout.paid', 'payout');
  }

  @override
  Future<void> cancelPayout(String id) async {
    await _wait();
    _setPayout(id, 'cancelado');
    _log('payout.cancel', 'payout');
  }

  @override
  Future<AdminSettings> settings() async {
    await _wait();
    return AdminSettings(
      values: Map.of(_settings),
      limits: const {
        'min_order_cents': (min: 0, max: 100000, def: 10000),
        'commission_pct': (min: 0, max: 50, def: 10),
        'courier_share_pct': (min: 0, max: 100, def: 80),
        'delivery_base_cents': (min: 0, max: 5000, def: 790),
        'delivery_extra_market_cents': (min: 0, max: 5000, def: 300),
        'market_hold_days': (min: 0, max: 30, def: 2),
      },
    );
  }

  @override
  Future<AdminSettings> saveSettings(Map<String, int> values) async {
    final s = await settings();
    for (final e in values.entries) {
      final l = s.limits[e.key]!;
      if (e.value < l.min || e.value > l.max) {
        throw ApiException(400, 'validation', 'Valor inválido (${l.min}–${l.max}).');
      }
    }
    _settings = {..._settings, ...values};
    _log('settings.update', 'settings', values);
    return settings();
  }

  @override
  Future<List<AdminMember>> team() async {
    await _wait();
    return List.of(_team);
  }

  @override
  Future<void> addMember({
    required String name,
    required String email,
    required String password,
    required Set<AdminArea> areas,
  }) async {
    await _wait();
    if (areas.isEmpty) throw const ApiException(400, 'validation', 'Escolha ao menos uma área.');
    if (_team.any((m) => m.email == email)) throw const ApiException(409, 'email_taken', 'E-mail já cadastrado.');
    _team.add(AdminMember(id: 'adm${_team.length}', name: name, email: email, status: 'ativo', areas: areas));
    _log('admin.create', 'user');
  }

  @override
  Future<void> updateMember(String id, {Set<AdminArea>? areas, bool? blocked}) async {
    await _wait();
    if (id == 'demo') {
      throw const ApiException(400, 'validation', 'Peça a outro administrador para alterar o seu acesso.');
    }
    final i = _team.indexWhere((m) => m.id == id);
    final m = _team[i];
    _team[i] = AdminMember(
      id: m.id,
      name: m.name,
      email: m.email,
      status: blocked == null ? m.status : (blocked ? 'bloqueado' : 'ativo'),
      areas: areas ?? m.areas,
    );
    _log('admin.update', 'user');
  }

  @override
  Future<({List<AuditEntry> items, int? nextOffset})> audit({String? action, int offset = 0}) async {
    await _wait();
    final base = [
      ..._audit,
      AuditEntry(
        action: 'courier.aprovar',
        entity: 'courier',
        userName: 'Administrador',
        userRole: 'admin',
        createdAt: DateTime.now().subtract(const Duration(days: 1)),
      ),
      AuditEntry(
        action: 'auth.login',
        entity: 'user',
        userName: 'Maria Silva',
        userRole: 'cliente',
        createdAt: DateTime.now().subtract(const Duration(days: 1, hours: 2)),
      ),
    ];
    return (items: base.where((a) => action == null || a.action.startsWith(action)).toList(), nextOffset: null);
  }

  AdminOccurrence _occItem(String id) => AdminOccurrence(
    summary: OccurrenceSummary(
      id: id,
      orderId: 'c3d4e5f6-0003',
      type: OccurrenceType.produtoErrado,
      status: _occ[id]!,
      createdAt: DateTime.now().subtract(const Duration(hours: 5)),
      requestedCents: 899,
      refundCents: _occ[id] == 'resolvida' ? 899 : 0,
    ),
    customerName: 'João Pereira',
    marketName: 'SuperMais',
    evidenceCount: 1,
  );

  @override
  Future<List<AdminOccurrence>> occurrences({String? status}) async {
    await _wait();
    return [
      for (final id in _occ.keys)
        if (status == null || _occ[id] == status) _occItem(id),
    ];
  }

  @override
  Future<AdminOccurrenceDetail> occurrence(String id) async {
    await _wait();
    final s = _occItem(id).summary;
    return AdminOccurrenceDetail(
      detail: OccurrenceDetail(
        summary: s,
        description: 'Pedi arroz Tio João e veio outra marca.',
        marketName: 'SuperMais',
        items: const [(name: 'Arroz Tipo 1 · 5 kg', quantity: 1, unitPriceCents: 899)],
        events: [
          OccurrenceEvent(role: 'cliente', kind: 'aberta', message: 'Veio outra marca.', createdAt: s.createdAt),
        ],
        evidenceCount: 0,
      ),
      customerName: 'João Pereira',
      orderTotalCents: 12870,
    );
  }

  @override
  Future<Uint8List> evidence(String occurrenceId, String evidenceId) async =>
      throw const ApiException(404, 'not_found', 'Foto indisponível na demonstração.');

  @override
  Future<void> analyze(String id) async {
    await _wait();
    if (_occ[id] != 'aberta') throw const ApiException(409, 'invalid_state', 'Ocorrência não está aberta.');
    _occ[id] = 'em_analise';
  }

  @override
  Future<void> decide(String id, String resolution, String note, {int? cents}) async {
    await _wait();
    if (note.trim().length < 3) throw const ApiException(400, 'validation', 'Escreva uma nota para o cliente.');
    _occ[id] = resolution == 'sem_reembolso' ? 'recusada' : 'resolvida';
    _log('occurrence.decide', 'occurrence', {'resolucao': resolution});
  }
}
