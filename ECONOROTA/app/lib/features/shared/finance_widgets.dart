import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/errors.dart';
import '../../core/utils/format.dart';
import '../../data/models/finance.dart';
import '../market/market_widgets.dart';

/// Saldo, repasses e extrato (mercado e entregador).
class FinanceStatementView extends StatefulWidget {
  const FinanceStatementView({super.key, required this.load, this.header});

  final Future<FinanceStatement> Function() load;
  final Widget? header;

  @override
  State<FinanceStatementView> createState() => _FinanceStatementViewState();
}

class _FinanceStatementViewState extends State<FinanceStatementView> {
  late Future<FinanceStatement> _future = widget.load();

  static const _title = TextStyle(
    fontFamily: 'Montserrat',
    fontWeight: FontWeight.w800,
    fontSize: 17,
    color: AppColors.ink,
  );
  static const _muted = TextStyle(color: AppColors.inkMuted, fontSize: 12.5);

  @override
  Widget build(BuildContext context) => FutureBuilder<FinanceStatement>(
    future: _future,
    builder: (context, snap) {
      if (snap.hasError) {
        return TextButton(
          onPressed: () => setState(() => _future = widget.load()),
          child: Text('${friendlyError(snap.error!)} Tocar para tentar de novo.'),
        );
      }
      final s = snap.data;
      if (s == null) {
        return const Padding(
          padding: EdgeInsets.all(24),
          child: Center(child: CircularProgressIndicator()),
        );
      }
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Saldo e repasses', style: _title),
          const SizedBox(height: 8),
          LayoutBuilder(
            builder: (_, b) {
              final cols = b.maxWidth >= 700 ? 3 : (b.maxWidth >= 420 ? 2 : 1);
              final w = (b.maxWidth - 10 * (cols - 1)) / cols;
              return Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  SizedBox(
                    width: w,
                    child: KpiCard(
                      icon: Icons.account_balance_wallet_rounded,
                      label: 'Disponível para o próximo repasse',
                      value: money(s.balance.availableCents),
                      color: AppColors.success,
                    ),
                  ),
                  if (s.balance.pendingCents != 0)
                    SizedBox(
                      width: w,
                      child: KpiCard(
                        icon: Icons.hourglass_top_rounded,
                        label: 'A liberar${s.holdDays != null ? ' (${s.holdDays} dias após a entrega)' : ''}',
                        value: money(s.balance.pendingCents),
                        color: const Color(0xFF92400E),
                      ),
                    ),
                  SizedBox(
                    width: w,
                    child: KpiCard(
                      icon: Icons.task_alt_rounded,
                      label: 'Já repassado',
                      value: money(s.balance.paidOutCents),
                    ),
                  ),
                ],
              );
            },
          ),
          if (widget.header != null) ...[const SizedBox(height: 10), widget.header!],
          const SizedBox(height: 14),
          const Text('Repasses', style: _title),
          const SizedBox(height: 8),
          if (s.payouts.isEmpty)
            const Text('Nenhum repasse ainda. Os repasses são feitos por Pix pelo EconoRota.', style: _muted)
          else
            for (final p in s.payouts)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: PanelCard(
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              money(p.amountCents),
                              style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink),
                            ),
                            Text(
                              [
                                'Gerado em ${date(p.createdAt)}',
                                if (p.paidAt != null) 'pago em ${date(p.paidAt!)}',
                                ?p.reference,
                              ].join(' · '),
                              style: _muted,
                            ),
                          ],
                        ),
                      ),
                      payoutPill(p.status),
                    ],
                  ),
                ),
              ),
          const SizedBox(height: 14),
          const Text('Extrato', style: _title),
          const SizedBox(height: 8),
          if (s.entries.isEmpty)
            const Text('Sem lançamentos. Cada entrega concluída gera os valores aqui.', style: _muted)
          else
            PanelCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  for (final (i, e) in s.entries.indexed) ...[
                    if (i > 0) const Divider(height: 1),
                    ListTile(
                      dense: true,
                      title: Text(
                        e.label,
                        style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink),
                      ),
                      subtitle: Text(
                        [
                          dateTime(e.createdAt),
                          if (e.orderId != null) 'pedido ${shortCode(e.orderId!)}',
                          if (e.payoutStatus == null && e.availableAt != null && e.availableAt!.isAfter(DateTime.now()))
                            'libera em ${date(e.availableAt!)}',
                        ].join(' · '),
                      ),
                      trailing: Text(
                        '${e.amountCents < 0 ? '− ' : ''}${money(e.amountCents.abs())}',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          color: e.amountCents < 0 ? AppColors.discount : AppColors.success,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
        ],
      );
    },
  );
}

Pill payoutPill(String status) => switch (status) {
  'pago' => const Pill('Pago', fg: AppColors.success, bg: AppColors.successSoft, icon: Icons.check_circle_rounded),
  'cancelado' => const Pill('Cancelado', fg: AppColors.inkMuted, bg: AppColors.sheet, icon: Icons.cancel_rounded),
  _ => const Pill('A pagar', fg: Color(0xFF92400E), bg: Color(0xFFFEF3C7), icon: Icons.schedule_rounded),
};
