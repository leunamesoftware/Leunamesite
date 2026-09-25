/// Financeiro (Fase 15): saldo, extrato e repasses.
library;

DateTime? _dt(Object? v) => v == null ? null : DateTime.tryParse(v as String)?.toLocal();

class FinanceBalance {
  const FinanceBalance({this.availableCents = 0, this.pendingCents = 0, this.paidOutCents = 0});

  /// Liberado e ainda não repassado.
  final int availableCents;

  /// Aguardando o prazo de reclamação (mercados).
  final int pendingCents;

  /// Já incluído em repasses.
  final int paidOutCents;

  factory FinanceBalance.fromJson(Map<String, dynamic> j) => FinanceBalance(
    availableCents: (j['available_cents'] as num?)?.toInt() ?? 0,
    pendingCents: (j['pending_cents'] as num?)?.toInt() ?? 0,
    paidOutCents: (j['paid_out_cents'] as num?)?.toInt() ?? 0,
  );
}

class LedgerEntry {
  const LedgerEntry({
    required this.kind,
    required this.amountCents,
    required this.createdAt,
    this.orderId,
    this.note,
    this.availableAt,
    this.payoutStatus,
  });

  final String? orderId;

  /// venda · comissao · entrega · taxa_plataforma · reembolso · ajuste
  final String kind;
  final int amountCents;
  final String? note;
  final DateTime? availableAt;
  final DateTime createdAt;
  final String? payoutStatus;

  String get label => switch (kind) {
    'venda' => 'Venda',
    'comissao' => 'Comissão',
    'entrega' => 'Entrega',
    'taxa_plataforma' => 'Parte da entrega',
    'reembolso' => 'Reembolso',
    _ => 'Ajuste',
  };

  factory LedgerEntry.fromJson(Map<String, dynamic> j) => LedgerEntry(
    orderId: j['order_id'] as String?,
    kind: j['kind'] as String,
    amountCents: (j['amount_cents'] as num).toInt(),
    note: j['note'] as String?,
    availableAt: _dt(j['available_at']),
    createdAt: _dt(j['created_at'])!,
    payoutStatus: j['payout_status'] as String?,
  );
}

class Payout {
  const Payout({
    required this.id,
    required this.amountCents,
    required this.status,
    required this.createdAt,
    this.reference,
    this.paidAt,
    this.partyType,
    this.partyName,
    this.pixKey,
    this.entries = 0,
  });

  final String id;
  final int amountCents;

  /// pendente · pago · cancelado
  final String status;
  final String? reference;
  final DateTime createdAt;
  final DateTime? paidAt;
  final String? partyType;
  final String? partyName;
  final String? pixKey;
  final int entries;

  factory Payout.fromJson(Map<String, dynamic> j) => Payout(
    id: j['id'] as String,
    amountCents: (j['amount_cents'] as num).toInt(),
    status: j['status'] as String,
    reference: j['reference'] as String?,
    createdAt: _dt(j['created_at'])!,
    paidAt: _dt(j['paid_at']),
    partyType: j['party_type'] as String?,
    partyName: j['party_name'] as String?,
    pixKey: j['pix_key'] as String?,
    entries: (j['entries'] as num?)?.toInt() ?? 0,
  );
}

class FinanceStatement {
  const FinanceStatement({required this.balance, required this.entries, required this.payouts, this.holdDays});

  final FinanceBalance balance;
  final List<LedgerEntry> entries;
  final List<Payout> payouts;
  final int? holdDays;

  factory FinanceStatement.fromJson(Map<String, dynamic> j) => FinanceStatement(
    balance: FinanceBalance.fromJson(j['balance'] as Map<String, dynamic>),
    entries: [for (final e in (j['entries'] as List).cast<Map<String, dynamic>>()) LedgerEntry.fromJson(e)],
    payouts: [for (final p in (j['payouts'] as List? ?? const []).cast<Map<String, dynamic>>()) Payout.fromJson(p)],
    holdDays: (j['hold_days'] as num?)?.toInt(),
  );
}

/// Visão financeira da administração.
class AdminFinance {
  const AdminFinance({
    required this.commissionCents,
    required this.deliveryCents,
    required this.netCents,
    required this.marketsAvailableCents,
    required this.marketsHeldCents,
    required this.couriersAvailableCents,
    required this.pendingPayoutsCents,
    required this.refundsCents,
  });

  final int commissionCents;
  final int deliveryCents;
  final int netCents;
  final int marketsAvailableCents;
  final int marketsHeldCents;
  final int couriersAvailableCents;
  final int pendingPayoutsCents;
  final int refundsCents;

  factory AdminFinance.fromJson(Map<String, dynamic> j) {
    int n(Map<String, dynamic>? m, String k) => (m?[k] as num?)?.toInt() ?? 0;
    final p = j['platform'] as Map<String, dynamic>?;
    final m = j['markets'] as Map<String, dynamic>?;
    final c = j['couriers'] as Map<String, dynamic>?;
    return AdminFinance(
      commissionCents: n(p, 'commission_cents'),
      deliveryCents: n(p, 'delivery_cents'),
      netCents: n(p, 'net_cents'),
      marketsAvailableCents: n(m, 'available_cents'),
      marketsHeldCents: n(m, 'held_cents'),
      couriersAvailableCents: n(c, 'available_cents'),
      pendingPayoutsCents: n(m, 'pending_payouts_cents') + n(c, 'pending_payouts_cents'),
      refundsCents: (j['refunds_cents'] as num?)?.toInt() ?? 0,
    );
  }
}
