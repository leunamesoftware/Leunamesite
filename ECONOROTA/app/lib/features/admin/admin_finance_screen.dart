import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../data/models/finance.dart';
import '../../data/repositories/admin_repository.dart';
import '../market/market_widgets.dart';
import '../shared/finance_widgets.dart';
import 'admin_widgets.dart';

/// Financeiro da plataforma: receita, saldos a repassar e repasses (Pix) para mercados e entregadores.
class AdminFinanceScreen extends StatefulWidget {
  const AdminFinanceScreen({super.key});

  @override
  State<AdminFinanceScreen> createState() => _AdminFinanceScreenState();
}

class _AdminFinanceScreenState extends State<AdminFinanceScreen> {
  AdminFinance? _f;
  var _version = 0;

  @override
  void initState() {
    super.initState();
    _loadTotals();
  }

  Future<void> _loadTotals() async {
    final f = await context.read<AdminRepository>().finance(30);
    if (mounted) setState(() => _f = f);
  }

  Future<void> _generate() async {
    final repo = context.read<AdminRepository>();
    final ok = await confirmAction(
      context,
      'Gerar repasses?',
      'Cria um repasse para cada mercado e entregador com saldo liberado. Depois, faça o Pix e confirme cada um aqui.',
      confirm: 'Gerar',
    );
    if (!ok || !mounted) return;
    ({int created, int totalCents})? r;
    await runAction(context, () async => r = await repo.generatePayouts(), 'Repasses gerados.');
    if (!mounted || r == null) return;
    notify(
      context,
      r!.created == 0 ? 'Nenhum saldo liberado para repassar.' : '${r!.created} repasse(s) · ${money(r!.totalCents)}',
    );
    setState(() => _version++);
    _loadTotals();
  }

  @override
  Widget build(BuildContext context) {
    final repo = context.read<AdminRepository>();
    final f = _f;
    return AdminListPage<Payout>(
      key: ValueKey(_version),
      title: 'Financeiro e repasses',
      subtitle: 'Últimos 30 dias',
      filters: const [('pendente', 'A pagar'), ('pago', 'Pagos'), ('cancelado', 'Cancelados'), (null, 'Todos')],
      emptyTitle: 'Nenhum repasse nesta lista',
      emptyIcon: Icons.account_balance_wallet_outlined,
      header: Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (f != null)
              KpiGrid(
                children: [
                  KpiCard(
                    icon: Icons.account_balance_rounded,
                    label: 'Receita líquida da plataforma',
                    value: money(f.netCents),
                    color: AppColors.success,
                  ),
                  KpiCard(icon: Icons.percent_rounded, label: 'Comissões', value: money(f.commissionCents)),
                  KpiCard(
                    icon: Icons.local_shipping_rounded,
                    label: 'Parte das entregas',
                    value: money(f.deliveryCents),
                  ),
                  KpiCard(
                    icon: Icons.undo_rounded,
                    label: 'Reembolsos após entrega',
                    value: money(f.refundsCents),
                    color: AppColors.discount,
                  ),
                  KpiCard(
                    icon: Icons.storefront_rounded,
                    label: 'Mercados: liberado (+${money(f.marketsHeldCents)} a liberar)',
                    value: money(f.marketsAvailableCents),
                    color: AppColors.roleMarket,
                  ),
                  KpiCard(
                    icon: Icons.delivery_dining_rounded,
                    label: 'Entregadores: liberado',
                    value: money(f.couriersAvailableCents),
                    color: AppColors.roleCourier,
                  ),
                  KpiCard(
                    icon: Icons.schedule_rounded,
                    label: 'Repasses a pagar',
                    value: money(f.pendingPayoutsCents),
                    color: amberFg,
                  ),
                ],
              ),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: _generate,
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
              icon: const Icon(Icons.playlist_add_check_rounded),
              label: const Text('Gerar repasses do saldo liberado'),
            ),
          ],
        ),
      ),
      load: (s, _) => repo.payouts(status: s),
      itemBuilder: (context, p, reload) => PanelCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  p.partyType == 'mercado' ? Icons.storefront_rounded : Icons.delivery_dining_rounded,
                  color: AppColors.primary,
                ),
                const SizedBox(width: 10),
                Expanded(child: Text(p.partyName ?? '—', style: strong)),
                Text(money(p.amountCents), style: strong),
                const SizedBox(width: 8),
                payoutPill(p.status),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              [
                p.partyType == 'mercado' ? 'Mercado' : 'Entregador',
                'Pix: ${p.pixKey ?? 'não cadastrada'}',
                '${p.entries} lançamentos',
                'gerado ${date(p.createdAt)}',
                if (p.reference != null) 'ref. ${p.reference}',
              ].join(' · '),
              style: muted,
            ),
            if (p.status == 'pendente')
              Align(
                alignment: Alignment.centerRight,
                child: Wrap(
                  spacing: 8,
                  children: [
                    TextButton(
                      style: TextButton.styleFrom(foregroundColor: AppColors.discount),
                      onPressed: () async {
                        if (!await confirmAction(context, 'Cancelar repasse?', 'Os valores voltam para o saldo.')) {
                          return;
                        }
                        if (!context.mounted) return;
                        if (await runAction(context, () => repo.cancelPayout(p.id), 'Repasse cancelado.')) {
                          reload();
                          _loadTotals();
                        }
                      },
                      child: const Text('Cancelar'),
                    ),
                    FilledButton.icon(
                      onPressed: p.pixKey == null
                          ? null
                          : () async {
                              final ref = await askText(
                                context,
                                title: 'Confirmar Pix de ${money(p.amountCents)}',
                                label: 'Identificador da transação (E2E) ou comprovante',
                                confirm: 'Confirmar pagamento',
                              );
                              if (ref == null || !context.mounted) return;
                              if (await runAction(
                                context,
                                () => repo.payPayout(p.id, ref),
                                'Repasse marcado como pago.',
                              )) {
                                reload();
                                _loadTotals();
                              }
                            },
                      icon: const Icon(Icons.pix_rounded),
                      label: const Text('Marcar como pago'),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
