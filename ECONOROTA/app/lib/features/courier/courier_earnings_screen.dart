import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/errors.dart';
import '../../core/utils/format.dart';
import '../../data/models/courier.dart';
import '../../data/repositories/courier_repository.dart';
import '../customer/widgets/common.dart';
import '../market/market_widgets.dart';
import '../shared/finance_widgets.dart';

/// Ganhos do entregador por período.
class CourierEarningsScreen extends StatefulWidget {
  const CourierEarningsScreen({super.key});

  @override
  State<CourierEarningsScreen> createState() => _CourierEarningsScreenState();
}

class _CourierEarningsScreenState extends State<CourierEarningsScreen> {
  int _days = 7;
  CourierEarnings? _e;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final e = await context.read<CourierRepository>().earnings(_days);
      if (mounted) {
        setState(() {
          _e = e;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final e = _e;
    return PanelPage(
      title: 'Ganhos',
      subtitle: 'Entregas finalizadas',
      onRefresh: _load,
      maxWidth: 720,
      children: [
        SegmentedButton<int>(
          segments: const [
            ButtonSegment(value: 7, label: Text('Últimos 7 dias')),
            ButtonSegment(value: 30, label: Text('Últimos 30 dias')),
          ],
          selected: {_days},
          onSelectionChanged: (s) {
            setState(() {
              _days = s.first;
              _e = null;
            });
            _load();
          },
        ),
        const SizedBox(height: 12),
        if (_error != null && e == null)
          RetryBox(message: _error!, onRetry: _load)
        else if (e == null)
          const Padding(
            padding: EdgeInsets.all(40),
            child: Center(child: CircularProgressIndicator()),
          )
        else ...[
          Row(
            children: [
              Expanded(
                child: KpiCard(
                  icon: Icons.payments_rounded,
                  label: 'Total ganho',
                  value: money(e.earningCents),
                  color: AppColors.success,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: KpiCard(icon: Icons.delivery_dining_rounded, label: 'Entregas', value: '${e.deliveries}'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (e.byDay.isEmpty)
            const LightEmpty(icon: Icons.savings_outlined, title: 'Nenhuma entrega no período')
          else
            PanelCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  for (final (i, d) in e.byDay.indexed) ...[
                    if (i > 0) const Divider(height: 1),
                    ListTile(
                      title: Text(
                        date(d.day),
                        style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink),
                      ),
                      subtitle: Text('${d.deliveries} ${d.deliveries == 1 ? 'entrega' : 'entregas'}'),
                      trailing: Text(
                        money(d.earningCents),
                        style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.success),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          const SizedBox(height: 10),
          const Text(
            'Os valores são pagos na chave Pix do seu cadastro, conforme o calendário de repasses do EconoRota.',
            style: TextStyle(color: AppColors.inkMuted, fontSize: 12),
          ),
          const SizedBox(height: 20),
          FinanceStatementView(load: context.read<CourierRepository>().statement),
        ],
      ],
    );
  }
}

/// Histórico de entregas.
class CourierHistoryScreen extends StatelessWidget {
  const CourierHistoryScreen({super.key});

  @override
  Widget build(BuildContext context) => FutureBuilder<List<DeliveryHistoryItem>>(
    future: context.read<CourierRepository>().history(),
    builder: (context, snap) => PanelPage(
      title: 'Histórico',
      subtitle: 'Suas entregas',
      maxWidth: 720,
      children: [
        if (snap.hasError)
          Text(friendlyError(snap.error!))
        else if (!snap.hasData)
          const Padding(
            padding: EdgeInsets.all(40),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (snap.data!.isEmpty)
          const LightEmpty(icon: Icons.history_rounded, title: 'Nenhuma entrega ainda')
        else
          for (final h in snap.data!)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: PanelCard(
                onTap: h.status == 'entregue' ? () => context.push('/avaliar/${h.id}') : null,
                child: Row(
                  children: [
                    Icon(
                      h.status == 'entregue' ? Icons.check_circle_rounded : Icons.cancel_rounded,
                      color: h.status == 'entregue' ? AppColors.success : AppColors.discount,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            h.markets,
                            style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink),
                          ),
                          Text(
                            h.status == 'entregue' && h.deliveredAt != null
                                ? 'Entregue em ${dateTime(h.deliveredAt!)}'
                                : 'Cancelado',
                            style: const TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
                          ),
                        ],
                      ),
                    ),
                    if (h.earningCents != null)
                      Text(
                        money(h.earningCents!),
                        style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.success),
                      ),
                  ],
                ),
              ),
            ),
      ],
    ),
  );
}
