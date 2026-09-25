import 'dart:typed_data';

import '../../services/api_client.dart';
import '../mock/mock_data.dart';
import '../models/occurrence.dart';

/// Ocorrências do cliente (Fase 11).
abstract interface class OccurrencesRepository {
  Future<List<OccurrenceSummary>> list();
  Future<OccurrenceDetail> detail(String id);
  Future<List<OrderItemRef>> orderItems(String orderId);
  Future<OccurrenceDetail> open(
    String orderId,
    OccurrenceType type, {
    String? description,
    Map<String, int> items = const {},
  });
  Future<void> addEvidence(String id, Uint8List bytes, String contentType);
  Future<void> message(String id, String text);
}

class ApiOccurrencesRepository implements OccurrencesRepository {
  ApiOccurrencesRepository(this._api);

  final ApiClient _api;

  @override
  Future<List<OccurrenceSummary>> list() async {
    final j = await _api.get('/me/ocorrencias');
    return (j['items'] as List).cast<Map<String, dynamic>>().map(OccurrenceSummary.fromJson).toList();
  }

  @override
  Future<OccurrenceDetail> detail(String id) async =>
      OccurrenceDetail.fromJson((await _api.get('/me/ocorrencias/$id'))['occurrence'] as Map<String, dynamic>);

  @override
  Future<List<OrderItemRef>> orderItems(String orderId) async {
    final o = (await _api.get('/me/orders/$orderId'))['order'] as Map<String, dynamic>;
    return [
      for (final m in (o['markets'] as List).cast<Map<String, dynamic>>())
        for (final i in (m['items'] as List).cast<Map<String, dynamic>>())
          if (i['checked'] != 0)
            OrderItemRef(
              id: i['id'] as String,
              name: i['name'] as String,
              quantity: i['quantity'] as int,
              unitPriceCents: i['unit_price_cents'] as int,
              imageUrl: i['image_url'] as String?,
            ),
    ];
  }

  @override
  Future<OccurrenceDetail> open(
    String orderId,
    OccurrenceType type, {
    String? description,
    Map<String, int> items = const {},
  }) async {
    final j = await _api.post('/me/orders/$orderId/ocorrencias', {
      'tipo': type.apiValue,
      'descricao': ?description,
      if (items.isNotEmpty)
        'itens': [
          for (final e in items.entries) {'id': e.key, 'quantidade': e.value},
        ],
    });
    return OccurrenceDetail.fromJson(j['occurrence'] as Map<String, dynamic>);
  }

  @override
  Future<void> addEvidence(String id, Uint8List bytes, String contentType) =>
      _api.upload('/me/ocorrencias/$id/evidencias', bytes, contentType);

  @override
  Future<void> message(String id, String text) => _api.post('/me/ocorrencias/$id/mensagens', {'mensagem': text});
}

/// Demonstração (mesmas regras principais da API).
class MockOccurrencesRepository implements OccurrencesRepository {
  final List<OccurrenceDetail> _items = [
    OccurrenceDetail(
      summary: OccurrenceSummary(
        id: 'oc-auto-0001',
        orderId: MockData.orders.first.id,
        type: OccurrenceType.produtoIndisponivel,
        status: 'resolvida',
        createdAt: DateTime.now().subtract(const Duration(days: 2)),
        requestedCents: 449,
        refundCents: 449,
        auto: true,
      ),
      description: 'Itens em falta na separação do mercado.',
      marketName: 'SuperMais',
      items: const [(name: 'Tomate · 1 kg', quantity: 1, unitPriceCents: 449)],
      events: [
        OccurrenceEvent(
          role: 'sistema',
          kind: 'reembolso_parcial',
          message: 'Reembolso automático de 4,49 pelos itens em falta.',
          createdAt: DateTime.now().subtract(const Duration(days: 2)),
        ),
      ],
      evidenceCount: 0,
    ),
  ];
  var _seq = 0;

  Future<void> _wait() => Future<void>.delayed(const Duration(milliseconds: 250));

  @override
  Future<List<OccurrenceSummary>> list() async {
    await _wait();
    return [for (final d in _items) d.summary];
  }

  @override
  Future<OccurrenceDetail> detail(String id) async {
    await _wait();
    return _items.firstWhere(
      (d) => d.summary.id == id,
      orElse: () => throw const ApiException(404, 'not_found', 'Ocorrência não encontrada.'),
    );
  }

  @override
  Future<List<OrderItemRef>> orderItems(String orderId) async {
    await _wait();
    final products = MockData.products.where((p) => p.marketId == 'm1').take(4).toList();
    return [
      for (final (i, p) in products.indexed)
        OrderItemRef(
          id: '$orderId-i$i',
          name: [p.name, p.unit].join(' · '),
          quantity: i == 0 ? 2 : 1,
          unitPriceCents: p.finalPriceCents,
          imageUrl: p.imageUrl,
        ),
    ];
  }

  @override
  Future<OccurrenceDetail> open(
    String orderId,
    OccurrenceType type, {
    String? description,
    Map<String, int> items = const {},
  }) async {
    await _wait();
    if (type.needsItems && items.isEmpty) {
      throw const ApiException(400, 'validation', 'Escolha os produtos com problema.');
    }
    if (type == OccurrenceType.reclamacao && (description ?? '').trim().isEmpty) {
      throw const ApiException(400, 'validation', 'Conte o que aconteceu.');
    }
    if (_items.any((d) => d.summary.orderId == orderId && d.summary.type == type && d.summary.open)) {
      throw const ApiException(409, 'duplicate', 'Já existe uma ocorrência deste tipo em análise para este pedido.');
    }
    final refs = await orderItems(orderId);
    final chosen = [
      for (final r in refs)
        if (items[r.id] != null) (name: r.name, quantity: items[r.id]!, unitPriceCents: r.unitPriceCents),
    ];
    final d = OccurrenceDetail(
      summary: OccurrenceSummary(
        id: 'oc-${++_seq}',
        orderId: orderId,
        type: type,
        status: 'aberta',
        createdAt: DateTime.now(),
        requestedCents: chosen.fold(0, (s, i) => s + i.quantity * i.unitPriceCents),
      ),
      description: description,
      items: chosen,
      events: [OccurrenceEvent(role: 'cliente', kind: 'aberta', message: description, createdAt: DateTime.now())],
      evidenceCount: 0,
    );
    _items.insert(0, d);
    return d;
  }

  void _replace(String id, OccurrenceDetail Function(OccurrenceDetail) f) {
    final i = _items.indexWhere((d) => d.summary.id == id);
    if (i >= 0) _items[i] = f(_items[i]);
  }

  @override
  Future<void> addEvidence(String id, Uint8List bytes, String contentType) async {
    await _wait();
    _replace(
      id,
      (d) => OccurrenceDetail(
        summary: d.summary,
        description: d.description,
        marketName: d.marketName,
        items: d.items,
        events: [
          ...d.events,
          OccurrenceEvent(role: 'cliente', kind: 'evidencia', createdAt: DateTime.now()),
        ],
        evidenceCount: d.evidenceCount + 1,
      ),
    );
  }

  @override
  Future<void> message(String id, String text) async {
    await _wait();
    _replace(
      id,
      (d) => OccurrenceDetail(
        summary: d.summary,
        description: d.description,
        marketName: d.marketName,
        items: d.items,
        events: [
          ...d.events,
          OccurrenceEvent(role: 'cliente', kind: 'mensagem', message: text, createdAt: DateTime.now()),
        ],
        evidenceCount: d.evidenceCount,
      ),
    );
  }
}
