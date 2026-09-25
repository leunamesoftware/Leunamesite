import '../../services/api_client.dart';
import '../mock/mock_data.dart';
import '../models/finance.dart';
import '../models/market_panel.dart';

/// Painel do supermercado (Fase 8). A API filtra tudo pelo mercado do usuário logado.
abstract interface class MarketPanelRepository {
  Future<({PanelMarket market, PanelKpis kpis})> summary();
  Future<PanelMarket> updateStore({bool? isOpen, String? opensAt, String? closesAt, String? pixKey});
  Future<List<PanelCategory>> categories();
  Future<List<PanelProduct>> products({String? query, String? categoryId, String? filter});
  Future<PanelProduct> createProduct(ProductDraft d);
  Future<PanelProduct> updateProduct(String id, Map<String, dynamic> changes);
  Future<int> moveStock(String productId, StockMoveType type, int quantity, {String? reason});
  Future<List<StockMove>> movements({String? productId});
  Future<List<PanelOrder>> orders(PanelOrderGroup group);
  Future<({PanelOrder order, List<PanelOrderItem> items})> order(String id);
  Future<void> accept(String id);

  /// Devolve quantos itens ficaram em falta.
  Future<int> check(String id, Map<String, bool> items);
  Future<void> ready(String id);
  Future<PanelFinance> finance(int days);
  Future<FinanceStatement> statement();
  Future<StoreProfile> storeProfile();
  Future<StoreProfile> saveStoreProfile(Map<String, dynamic> changes);
}

class ApiMarketPanelRepository implements MarketPanelRepository {
  ApiMarketPanelRepository(this._api);

  final ApiClient _api;

  @override
  Future<({PanelMarket market, PanelKpis kpis})> summary() async {
    final j = await _api.get('/painel/resumo');
    return (
      market: PanelMarket.fromJson(j['market'] as Map<String, dynamic>),
      kpis: PanelKpis.fromJson(j['kpis'] as Map<String, dynamic>),
    );
  }

  @override
  Future<PanelMarket> updateStore({bool? isOpen, String? opensAt, String? closesAt, String? pixKey}) async {
    final j = await _api.patch('/painel/loja', {
      'is_open': ?isOpen,
      'opens_at': ?opensAt,
      'closes_at': ?closesAt,
      'pix_key': ?pixKey,
    });
    return PanelMarket.fromJson(j['market'] as Map<String, dynamic>);
  }

  @override
  Future<List<PanelCategory>> categories() async {
    final j = await _api.get('/painel/categorias');
    return (j['items'] as List).cast<Map<String, dynamic>>().map(PanelCategory.fromJson).toList();
  }

  @override
  Future<List<PanelProduct>> products({String? query, String? categoryId, String? filter}) async {
    final params = {'q': ?query, 'categoria': ?categoryId, 'filtro': ?filter}..removeWhere((_, v) => v.isEmpty);
    final j = await _api.get('/painel/produtos${params.isEmpty ? '' : '?${Uri(queryParameters: params).query}'}');
    return (j['items'] as List).cast<Map<String, dynamic>>().map(PanelProduct.fromJson).toList();
  }

  @override
  Future<PanelProduct> createProduct(ProductDraft d) async {
    final j = await _api.post('/painel/produtos', d.toJson(withStock: true));
    return PanelProduct.fromJson(j['product'] as Map<String, dynamic>);
  }

  @override
  Future<PanelProduct> updateProduct(String id, Map<String, dynamic> changes) async {
    final j = await _api.patch('/painel/produtos/$id', changes);
    return PanelProduct.fromJson(j['product'] as Map<String, dynamic>);
  }

  @override
  Future<int> moveStock(String productId, StockMoveType type, int quantity, {String? reason}) async {
    final j = await _api.post('/painel/produtos/$productId/estoque', {
      'tipo': type.name,
      'quantidade': quantity,
      'motivo': ?reason,
    });
    return j['stock'] as int;
  }

  @override
  Future<List<StockMove>> movements({String? productId}) async {
    final j = await _api.get('/painel/estoque/movimentos${productId == null ? '' : '?produto=$productId'}');
    return (j['items'] as List).cast<Map<String, dynamic>>().map(StockMove.fromJson).toList();
  }

  @override
  Future<List<PanelOrder>> orders(PanelOrderGroup group) async {
    final j = await _api.get('/painel/pedidos?grupo=${group.apiValue}');
    return (j['items'] as List).cast<Map<String, dynamic>>().map(PanelOrder.fromJson).toList();
  }

  @override
  Future<({PanelOrder order, List<PanelOrderItem> items})> order(String id) async {
    final j = (await _api.get('/painel/pedidos/$id'))['order'] as Map<String, dynamic>;
    return (
      order: PanelOrder.fromJson(j),
      items: (j['items'] as List).cast<Map<String, dynamic>>().map(PanelOrderItem.fromJson).toList(),
    );
  }

  @override
  Future<void> accept(String id) => _api.post('/painel/pedidos/$id/aceitar', {});

  @override
  Future<int> check(String id, Map<String, bool> items) async {
    final j = await _api.post('/painel/pedidos/$id/conferencia', {
      'itens': [
        for (final e in items.entries) {'id': e.key, 'ok': e.value},
      ],
    });
    return j['missing'] as int? ?? 0;
  }

  @override
  Future<void> ready(String id) => _api.post('/painel/pedidos/$id/pronto', {});

  @override
  Future<PanelFinance> finance(int days) async =>
      PanelFinance.fromJson(await _api.get('/painel/financeiro?dias=$days'));

  @override
  Future<FinanceStatement> statement() async => FinanceStatement.fromJson(await _api.get('/painel/extrato'));

  @override
  Future<StoreProfile> storeProfile() async =>
      StoreProfile.fromJson((await _api.get('/painel/loja'))['market'] as Map<String, dynamic>);

  @override
  Future<StoreProfile> saveStoreProfile(Map<String, dynamic> changes) async =>
      StoreProfile.fromJson((await _api.patch('/painel/loja', changes))['market'] as Map<String, dynamic>);
}

/// Painel de demonstração (SuperMais), com os mesmos comportamentos da API.
class MockMarketPanelRepository implements MarketPanelRepository {
  MockMarketPanelRepository() {
    final now = DateTime.now();
    _products = [
      for (final p in MockData.products.where((p) => p.marketId == 'm1'))
        PanelProduct(
          id: p.id,
          categoryId: p.categoryId,
          name: p.name,
          brand: p.brand,
          unit: p.unit,
          priceCents: p.priceCents,
          promoPriceCents: p.promoPriceCents,
          stock: p.stock,
          minStock: 15,
          imageUrl: p.imageUrl,
          expiresOn: p.id == 'p1' ? now.add(const Duration(days: 2)) : null,
        ),
    ];
    PanelOrder o(String id, String status, int minutesAgo, int items, int cents, [int markets = 1]) => PanelOrder(
      id: 'om-$id',
      orderId: '$id-0000-4000-8000-000000000000',
      status: status,
      subtotalCents: cents,
      createdAt: now.subtract(Duration(minutes: minutesAgo)),
      itemCount: items,
      marketCount: markets,
    );
    _orders = [
      o('a1b2c3', 'novo', 4, 7, 8940, 2),
      o('d4e5f6', 'novo', 11, 3, 4590),
      o('0a9b8c', 'em_separacao', 25, 9, 12380, 3),
      o('7d6e5f', 'pronto', 48, 5, 6720),
      o('3c2b1a', 'entregue', 60 * 26, 12, 15490),
      o('9f8e7d', 'cancelado', 60 * 30, 2, 2380),
    ];
    for (final ord in _orders) {
      final list = _products.take(ord.itemCount.clamp(1, 6)).toList();
      _items[ord.id] = [
        for (final (i, p) in list.indexed)
          PanelOrderItem(
            id: '${ord.id}-$i',
            name: [p.name, p.brand, p.unit].whereType<String>().join(' · '),
            unitPriceCents: p.promoPriceCents ?? p.priceCents,
            quantity: i == 0 ? 2 : 1,
            imageUrl: p.imageUrl,
            checked: ord.status == 'pronto' ? true : null,
            cold: const {'carnes', 'laticinios', 'congelados', 'frios'}.contains(p.categoryId),
          ),
      ]..sort((a, b) => (a.cold ? 1 : 0) - (b.cold ? 1 : 0));
    }
  }

  late List<PanelProduct> _products;
  late List<PanelOrder> _orders;
  final Map<String, List<PanelOrderItem>> _items = {};
  final List<StockMove> _moves = [];
  var _market = const PanelMarket(id: 'm1', name: 'SuperMais', isOpen: true, opensAt: '07:00', closesAt: '23:00');
  var _seq = 0;

  Future<void> _wait() => Future<void>.delayed(const Duration(milliseconds: 250));

  ApiException _bad(String m) => ApiException(400, 'validation', m);

  @override
  Future<({PanelMarket market, PanelKpis kpis})> summary() async {
    await _wait();
    final today = DateTime.now();
    bool isToday(DateTime d) => d.year == today.year && d.month == today.month && d.day == today.day;
    final paid = _orders.where((o) => o.status != 'cancelado' && isToday(o.createdAt));
    final active = _products.where((p) => p.active);
    return (
      market: _market,
      kpis: PanelKpis(
        ordersToday: paid.length,
        revenueToday: paid.fold(0, (s, o) => s + o.subtotalCents),
        newOrders: _orders.where((o) => o.status == 'novo').length,
        separating: _orders.where((o) => o.status == 'em_separacao' || o.status == 'conferido').length,
        lowStock: active.where((p) => p.level == StockLevel.low).length,
        unavailable: active.where((p) => p.level == StockLevel.out).length,
        expiring: active.where((p) => p.expiringSoon).length,
      ),
    );
  }

  @override
  Future<PanelMarket> updateStore({bool? isOpen, String? opensAt, String? closesAt, String? pixKey}) async {
    await _wait();
    if (pixKey != null && pixKey.trim().length < 3) throw _bad('Chave Pix inválida.');
    return _market = _market.copyWith(isOpen: isOpen, opensAt: opensAt, closesAt: closesAt, pixKey: pixKey);
  }

  @override
  Future<List<PanelCategory>> categories() async {
    await _wait();
    return [
      for (final c in MockData.categories)
        PanelCategory(
          id: c.id,
          name: c.name,
          products: _products.where((p) => p.active && p.categoryId == c.id).length,
        ),
    ];
  }

  @override
  Future<List<PanelProduct>> products({String? query, String? categoryId, String? filter}) async {
    await _wait();
    final q = query?.trim().toLowerCase() ?? '';
    return _products.where((p) {
      if (q.isNotEmpty &&
          !p.name.toLowerCase().contains(q) &&
          !(p.brand?.toLowerCase().contains(q) ?? false) &&
          p.barcode != q) {
        return false;
      }
      if (categoryId != null && p.categoryId != categoryId) return false;
      return switch (filter) {
        'inativos' => !p.active,
        'baixo' => p.active && p.level == StockLevel.low,
        'indisponivel' => p.active && p.level == StockLevel.out,
        'vencendo' => p.active && p.expiringSoon,
        _ => p.active,
      };
    }).toList()..sort((a, b) => a.name.compareTo(b.name));
  }

  void _validate(ProductDraft d) {
    if (d.name.trim().length < 2) throw _bad('Informe o nome do produto.');
    if (d.priceCents <= 0) throw _bad('Informe o preço.');
    if (d.promoPriceCents != null && d.promoPriceCents! >= d.priceCents) {
      throw _bad('O preço promocional precisa ser menor que o preço normal.');
    }
  }

  @override
  Future<PanelProduct> createProduct(ProductDraft d) async {
    await _wait();
    _validate(d);
    final p = PanelProduct(
      id: 'novo-${++_seq}',
      categoryId: d.categoryId,
      name: d.name.trim(),
      brand: d.brand,
      unit: d.unit,
      barcode: d.barcode,
      priceCents: d.priceCents,
      promoPriceCents: d.promoPriceCents,
      stock: d.stock,
      minStock: d.minStock,
      description: d.description,
      expiresOn: d.expiresOn,
    );
    _products.add(p);
    if (d.stock > 0) _log(p, StockMoveType.entrada, d.stock, d.stock, 'Cadastro do produto');
    return p;
  }

  @override
  Future<PanelProduct> updateProduct(String id, Map<String, dynamic> changes) async {
    await _wait();
    final i = _products.indexWhere((p) => p.id == id);
    if (i < 0) throw const ApiException(404, 'not_found', 'Produto não encontrado.');
    final c = _products[i];
    final exp = changes.containsKey('expires_on') ? changes['expires_on'] as String? : null;
    final next = PanelProduct(
      id: c.id,
      categoryId: changes['category_id'] as String? ?? c.categoryId,
      name: changes['name'] as String? ?? c.name,
      brand: changes.containsKey('brand') ? changes['brand'] as String? : c.brand,
      unit: changes['unit'] as String? ?? c.unit,
      barcode: changes.containsKey('barcode') ? changes['barcode'] as String? : c.barcode,
      priceCents: changes['price_cents'] as int? ?? c.priceCents,
      promoPriceCents: changes.containsKey('promo_price_cents')
          ? changes['promo_price_cents'] as int?
          : c.promoPriceCents,
      stock: c.stock,
      minStock: changes['min_stock'] as int? ?? c.minStock,
      active: changes['is_active'] as bool? ?? c.active,
      imageUrl: c.imageUrl,
      description: changes.containsKey('description') ? changes['description'] as String? : c.description,
      expiresOn: changes.containsKey('expires_on') ? (exp == null ? null : DateTime.parse(exp)) : c.expiresOn,
    );
    if (next.promoPriceCents != null && next.promoPriceCents! >= next.priceCents) {
      throw _bad('O preço promocional precisa ser menor que o preço normal.');
    }
    return _products[i] = next;
  }

  void _log(PanelProduct p, StockMoveType t, int qty, int after, String? reason) => _moves.insert(
    0,
    StockMove(
      productName: p.name,
      type: t,
      quantity: qty,
      stockAfter: after,
      reason: reason,
      createdAt: DateTime.now(),
    ),
  );

  @override
  Future<int> moveStock(String productId, StockMoveType type, int quantity, {String? reason}) async {
    await _wait();
    final i = _products.indexWhere((p) => p.id == productId);
    if (i < 0) throw const ApiException(404, 'not_found', 'Produto não encontrado.');
    final cur = _products[i].stock;
    final next = switch (type) {
      StockMoveType.entrada => cur + quantity,
      StockMoveType.saida => cur - quantity,
      _ => quantity,
    };
    if (next < 0) throw _bad('Saída maior que o estoque atual ($cur).');
    _products[i] = _products[i].copyWith(stock: next);
    _log(_products[i], type, next - cur, next, reason);
    return next;
  }

  @override
  Future<List<StockMove>> movements({String? productId}) async {
    await _wait();
    final name = productId == null ? null : _products.firstWhere((p) => p.id == productId).name;
    return _moves.where((m) => name == null || m.productName == name).toList();
  }

  @override
  Future<List<PanelOrder>> orders(PanelOrderGroup group) async {
    await _wait();
    return _orders.where((o) {
      return switch (group) {
        PanelOrderGroup.news => o.status == 'novo',
        PanelOrderGroup.separating => o.status == 'em_separacao' || o.status == 'conferido',
        PanelOrderGroup.ready => o.status == 'pronto',
        PanelOrderGroup.history => const {'pronto', 'retirado', 'entregue', 'cancelado'}.contains(o.status),
      };
    }).toList();
  }

  PanelOrder _get(String id) => _orders.firstWhere(
    (o) => o.id == id,
    orElse: () => throw const ApiException(404, 'not_found', 'Pedido não encontrado.'),
  );

  void _set(String id, String status) {
    final o = _get(id);
    _orders[_orders.indexOf(o)] = PanelOrder(
      id: o.id,
      orderId: o.orderId,
      status: status,
      subtotalCents: o.subtotalCents,
      createdAt: o.createdAt,
      itemCount: o.itemCount,
      marketCount: o.marketCount,
      sequence: o.sequence,
    );
  }

  @override
  Future<({PanelOrder order, List<PanelOrderItem> items})> order(String id) async {
    await _wait();
    return (order: _get(id), items: _items[id] ?? const []);
  }

  @override
  Future<void> accept(String id) async {
    await _wait();
    if (_get(id).status != 'novo') throw const ApiException(409, 'invalid_state', 'Este pedido já foi aceito.');
    _set(id, 'em_separacao');
  }

  @override
  Future<int> check(String id, Map<String, bool> items) async {
    await _wait();
    final list = _items[id] ?? const [];
    if (list.any((i) => !items.containsKey(i.id))) throw _bad('Confira todos os itens do pedido.');
    _items[id] = [
      for (final i in list)
        PanelOrderItem(
          id: i.id,
          name: i.name,
          unitPriceCents: i.unitPriceCents,
          quantity: i.quantity,
          imageUrl: i.imageUrl,
          barcode: i.barcode,
          checked: items[i.id],
          cold: i.cold,
        ),
    ];
    _set(id, 'conferido');
    return items.values.where((ok) => !ok).length;
  }

  @override
  Future<void> ready(String id) async {
    await _wait();
    if (_get(id).status != 'conferido') {
      throw const ApiException(409, 'invalid_state', 'Confira os itens antes de marcar como pronto.');
    }
    _set(id, 'pronto');
  }

  @override
  Future<PanelFinance> finance(int days) async {
    await _wait();
    const pct = 10;
    final today = DateTime.now();
    final byDay = [
      for (var d = 0; d < days; d++)
        if (d % 3 != 2)
          () {
            final gross = 18000 + (d * 7919 % 26000);
            return (
              day: DateTime(today.year, today.month, today.day - d),
              orders: 3 + d % 5,
              grossCents: gross,
              netCents: gross - (gross * pct / 100).round(),
            );
          }(),
    ];
    final gross = byDay.fold(0, (s, d) => s + d.grossCents);
    final commission = (gross * pct / 100).round();
    return PanelFinance(
      days: days,
      commissionPct: pct,
      orders: byDay.fold(0, (s, d) => s + d.orders),
      grossCents: gross,
      commissionCents: commission,
      netCents: gross - commission,
      byDay: byDay,
    );
  }

  @override
  Future<FinanceStatement> statement() async {
    await _wait();
    final now = DateTime.now();
    return FinanceStatement(
      balance: const FinanceBalance(availableCents: 184320, pendingCents: 52410, paidOutCents: 1320990),
      holdDays: 2,
      entries: [
        LedgerEntry(orderId: '3c2b1a', kind: 'venda', amountCents: 14400, note: 'Produtos entregues', createdAt: now),
        LedgerEntry(orderId: '3c2b1a', kind: 'comissao', amountCents: -1440, note: 'Comissão 10%', createdAt: now),
        LedgerEntry(
          orderId: '8a7b6c',
          kind: 'reembolso',
          amountCents: -899,
          note: 'Reembolso de produto trocado',
          createdAt: now.subtract(const Duration(days: 1)),
        ),
      ],
      payouts: [
        Payout(
          id: 'rp1',
          amountCents: 412300,
          status: 'pago',
          reference: 'PIX E2E8812',
          createdAt: now.subtract(const Duration(days: 7)),
          paidAt: now.subtract(const Duration(days: 7)),
        ),
      ],
    );
  }

  Map<String, dynamic> _profile = {
    'name': 'SuperMais',
    'status': 'ativo',
    'document': '12345678000190',
    'phone': '(11) 3333-4444',
    'address': 'Rua Augusta, 900',
    'district': 'Consolação',
    'city': 'São Paulo',
    'state': 'SP',
    'lat': -23.554,
    'lng': -46.658,
    'eta_min': 20,
  };

  StoreProfile _currentProfile() {
    final p = {..._profile, 'opens_at': _market.opensAt, 'closes_at': _market.closesAt, 'pix_key': _market.pixKey};
    return StoreProfile.fromJson({
      ...p,
      'missing': [
        if (p['document'] == null) 'document',
        if (p['address'] == null) 'address',
        if (p['lat'] == null) 'location',
        if (p['pix_key'] == null) 'pix_key',
      ],
    });
  }

  @override
  Future<StoreProfile> storeProfile() async {
    await _wait();
    return _currentProfile();
  }

  @override
  Future<StoreProfile> saveStoreProfile(Map<String, dynamic> changes) async {
    await _wait();
    final doc = changes['document'];
    if (doc != null && doc.toString().replaceAll(RegExp(r'\D'), '').length != 14) {
      throw _bad('CNPJ inválido (14 números).');
    }
    _profile = {
      ..._profile,
      ...changes
        ..remove('pix_key')
        ..remove('opens_at')
        ..remove('closes_at'),
    };
    if (changes['state'] != null) _profile['state'] = changes['state'].toString().toUpperCase();
    return _currentProfile();
  }
}
