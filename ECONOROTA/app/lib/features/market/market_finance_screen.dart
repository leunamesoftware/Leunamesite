import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/errors.dart';
import '../../core/utils/format.dart';
import '../../data/models/market_panel.dart';
import '../../data/repositories/market_panel_repository.dart';
import '../customer/widgets/common.dart';
import '../shared/finance_widgets.dart';
import 'market_widgets.dart';

/// Financeiro: vendas, comissão do EconoRota e valor a receber, por dia.
class MarketFinanceScreen extends StatefulWidget {
  const MarketFinanceScreen({super.key});

  @override
  State<MarketFinanceScreen> createState() => _MarketFinanceScreenState();
}

class _MarketFinanceScreenState extends State<MarketFinanceScreen> {
  int _days = 7;
  PanelFinance? _f;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final f = await context.read<MarketPanelRepository>().finance(_days);
      if (mounted) {
        setState(() {
          _f = f;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final f = _f;
    return PanelPage(
      title: 'Financeiro',
      subtitle: 'Vendas e valores a receber',
      onRefresh: _load,
      maxWidth: 900,
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
              _f = null;
            });
            _load();
          },
        ),
        const SizedBox(height: 12),
        if (_error != null && f == null)
          RetryBox(message: _error!, onRetry: _load)
        else if (f == null)
          const Padding(
            padding: EdgeInsets.all(40),
            child: Center(child: CircularProgressIndicator()),
          )
        else ...[
          LayoutBuilder(
            builder: (_, b) {
              final cols = b.maxWidth >= 700 ? 3 : 1;
              final w = (b.maxWidth - 10 * (cols - 1)) / cols;
              return Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  SizedBox(
                    width: w,
                    child: KpiCard(
                      icon: Icons.point_of_sale_rounded,
                      label: 'Vendas (${f.orders} pedidos)',
                      value: money(f.grossCents),
                    ),
                  ),
                  SizedBox(
                    width: w,
                    child: KpiCard(
                      icon: Icons.percent_rounded,
                      label: 'Comissão EconoRota (${f.commissionPct}%)',
                      value: '− ${money(f.commissionCents)}',
                      color: AppColors.discount,
                    ),
                  ),
                  SizedBox(
                    width: w,
                    child: KpiCard(
                      icon: Icons.account_balance_rounded,
                      label: 'A receber',
                      value: money(f.netCents),
                      color: AppColors.success,
                    ),
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: 16),
          const Text(
            'Por dia',
            style: TextStyle(fontFamily: 'Montserrat', fontWeight: FontWeight.w800, fontSize: 17, color: AppColors.ink),
          ),
          const SizedBox(height: 8),
          if (f.byDay.isEmpty)
            const LightEmpty(icon: Icons.bar_chart_rounded, title: 'Sem vendas no período')
          else
            PanelCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  for (final (i, d) in f.byDay.indexed) ...[
                    if (i > 0) const Divider(height: 1),
                    ListTile(
                      title: Text(
                        date(d.day),
                        style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink),
                      ),
                      subtitle: Text('${d.orders} pedidos · vendas ${money(d.grossCents)}'),
                      trailing: Text(
                        money(d.netCents),
                        style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.success),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          const SizedBox(height: 10),
          const Text(
            'Valores de pedidos pagos. O percentual de comissão e as datas de repasse são definidos no contrato com o EconoRota.',
            style: TextStyle(color: AppColors.inkMuted, fontSize: 12),
          ),
          const SizedBox(height: 20),
          FinanceStatementView(load: context.read<MarketPanelRepository>().statement, header: const _PixKeyCard()),
        ],
      ],
    );
  }
}

/// Chave Pix para receber os repasses.
class _PixKeyCard extends StatefulWidget {
  const _PixKeyCard();

  @override
  State<_PixKeyCard> createState() => _PixKeyCardState();
}

class _PixKeyCardState extends State<_PixKeyCard> {
  String? _key;
  var _loaded = false;

  @override
  void initState() {
    super.initState();
    context.read<MarketPanelRepository>().summary().then((s) {
      if (mounted) {
        setState(() {
          _key = s.market.pixKey;
          _loaded = true;
        });
      }
    }, onError: (_) => mounted ? setState(() => _loaded = true) : null);
  }

  Future<void> _edit() async {
    final ctrl = TextEditingController(text: _key);
    final value = await showDialog<String>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Chave Pix para repasses'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'CNPJ, e-mail, telefone ou chave aleatória'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c), child: const Text('Voltar')),
          FilledButton(onPressed: () => Navigator.pop(c, ctrl.text.trim()), child: const Text('Salvar')),
        ],
      ),
    );
    if (value == null || !mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    try {
      final m = await context.read<MarketPanelRepository>().updateStore(pixKey: value);
      setState(() => _key = m.pixKey);
      messenger.showSnackBar(const SnackBar(content: Text('Chave Pix salva.')));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(friendlyError(e))));
    }
  }

  @override
  Widget build(BuildContext context) => PanelCard(
    onTap: _loaded ? _edit : null,
    child: Row(
      children: [
        const Icon(Icons.pix_rounded, color: AppColors.primary),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Chave Pix para repasses',
                style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink),
              ),
              Text(
                !_loaded ? 'Carregando…' : (_key ?? 'Não cadastrada — toque para informar'),
                style: TextStyle(color: _key == null ? AppColors.discount : AppColors.inkMuted, fontSize: 12.5),
              ),
            ],
          ),
        ),
        const Icon(Icons.edit_rounded, color: AppColors.inkMuted),
      ],
    ),
  );
}
