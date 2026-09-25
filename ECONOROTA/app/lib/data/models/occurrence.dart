/// Ocorrências (Fase 11).
library;

import 'package:flutter/material.dart';

import '../../core/utils/format.dart';

enum OccurrenceType {
  produtoErrado(
    'produto_errado',
    'Produto errado',
    'Veio um produto diferente do que pedi',
    Icons.swap_horiz_rounded,
    true,
  ),
  produtoFaltando(
    'produto_faltando',
    'Produto faltando',
    'Um produto não veio na entrega',
    Icons.remove_shopping_cart_rounded,
    true,
  ),
  produtoIndisponivel(
    'produto_indisponivel',
    'Produto com problema',
    'Vencido, estragado ou danificado',
    Icons.report_problem_rounded,
    true,
  ),
  substituicao(
    'substituicao_nao_autorizada',
    'Substituição não autorizada',
    'Trocaram por outro produto sem me perguntar',
    Icons.published_with_changes_rounded,
    true,
  ),
  entregaAtrasada('entrega_atrasada', 'Entrega atrasada', 'Passou do prazo prometido', Icons.timer_off_rounded, false),
  naoEntregue('pedido_nao_entregue', 'Pedido não entregue', 'Não recebi as compras', Icons.no_crash_rounded, false),
  reclamacao(
    'reclamacao',
    'Outra reclamação',
    'Atendimento, entregador ou outro assunto',
    Icons.support_agent_rounded,
    false,
  );

  const OccurrenceType(this.apiValue, this.label, this.hint, this.icon, this.needsItems);
  final String apiValue;
  final String label;
  final String hint;
  final IconData icon;

  /// Tipos de produto exigem escolher os itens.
  final bool needsItems;

  static OccurrenceType of(String v) => values.firstWhere((t) => t.apiValue == v, orElse: () => reclamacao);
}

String occurrenceStatusLabel(String s) => switch (s) {
  'aberta' => 'Aberta',
  'em_analise' => 'Em análise',
  'resolvida' => 'Resolvida',
  'recusada' => 'Encerrada sem reembolso',
  _ => s,
};

class OccurrenceSummary {
  const OccurrenceSummary({
    required this.id,
    required this.orderId,
    required this.type,
    required this.status,
    required this.createdAt,
    this.requestedCents = 0,
    this.refundCents = 0,
    this.auto = false,
  });

  final String id;
  final String orderId;
  final OccurrenceType type;
  final String status;
  final DateTime createdAt;
  final int requestedCents;
  final int refundCents;

  /// Aberta automaticamente (ex.: item em falta na separação, já reembolsado).
  final bool auto;

  String get orderCode => shortCode(orderId);
  bool get open => status == 'aberta' || status == 'em_analise';

  factory OccurrenceSummary.fromJson(Map<String, dynamic> j) => OccurrenceSummary(
    id: j['id'] as String,
    orderId: j['order_id'] as String,
    type: OccurrenceType.of(j['type'] as String),
    status: j['status'] as String,
    createdAt: DateTime.parse(j['created_at'] as String).toLocal(),
    requestedCents: j['requested_cents'] as int? ?? 0,
    refundCents: j['refund_cents'] as int? ?? 0,
    auto: (j['auto'] as num? ?? 0) == 1,
  );
}

class OccurrenceEvent {
  const OccurrenceEvent({required this.role, required this.kind, required this.createdAt, this.message});

  final String role;
  final String kind;
  final String? message;
  final DateTime createdAt;

  String get label => switch (kind) {
    'aberta' => 'Ocorrência aberta',
    'evidencia' => 'Foto enviada',
    'mensagem' => role == 'cliente' ? 'Você escreveu' : 'Mensagem do EconoRota',
    'em_analise' => 'Em análise pela equipe',
    'reembolso_total' => 'Reembolso total aprovado',
    'reembolso_parcial' => 'Reembolso aprovado',
    'sem_reembolso' => 'Encerrada sem reembolso',
    _ => kind,
  };

  factory OccurrenceEvent.fromJson(Map<String, dynamic> j) => OccurrenceEvent(
    role: j['author_role'] as String,
    kind: j['kind'] as String,
    message: j['message'] as String?,
    createdAt: DateTime.parse(j['created_at'] as String).toLocal(),
  );
}

class OccurrenceDetail {
  const OccurrenceDetail({
    required this.summary,
    required this.items,
    required this.events,
    required this.evidenceCount,
    this.evidenceIds = const [],
    this.description,
    this.marketName,
    this.adminNote,
  });

  final OccurrenceSummary summary;
  final String? description;
  final String? marketName;
  final String? adminNote;
  final List<({String name, int quantity, int unitPriceCents})> items;
  final List<OccurrenceEvent> events;
  final int evidenceCount;
  final List<String> evidenceIds;

  factory OccurrenceDetail.fromJson(Map<String, dynamic> j) => OccurrenceDetail(
    summary: OccurrenceSummary.fromJson(j),
    description: j['description'] as String?,
    marketName: j['market_name'] as String?,
    adminNote: j['admin_note'] as String?,
    items: [
      for (final i in (j['items'] as List? ?? const []).cast<Map<String, dynamic>>())
        (name: i['name'] as String, quantity: i['quantity'] as int, unitPriceCents: i['unit_price_cents'] as int),
    ],
    events: (j['events'] as List? ?? const []).cast<Map<String, dynamic>>().map(OccurrenceEvent.fromJson).toList(),
    evidenceCount: (j['evidence'] as List? ?? const []).length,
    evidenceIds: [for (final e in (j['evidence'] as List? ?? const []).cast<Map<String, dynamic>>()) e['id'] as String],
  );
}

/// Item do pedido que pode entrar numa ocorrência.
class OrderItemRef {
  const OrderItemRef({
    required this.id,
    required this.name,
    required this.quantity,
    required this.unitPriceCents,
    this.imageUrl,
  });

  final String id;
  final String name;
  final int quantity;
  final int unitPriceCents;
  final String? imageUrl;
}
