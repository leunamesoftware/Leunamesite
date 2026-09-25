import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/errors.dart';
import '../../core/utils/format.dart';
import '../../data/models/market_panel.dart';
import '../../data/repositories/market_panel_repository.dart';
import '../customer/widgets/common.dart';
import 'market_widgets.dart';

/// Recebimento de pedidos: Novos → Separação → Prontos, e Histórico.
class MarketOrdersScreen extends StatelessWidget {
  const MarketOrdersScreen({super.key});

  @override
  Widget build(BuildContext context) => Theme(
    data: AppTheme.light,
    child: DefaultTabController(
      length: PanelOrderGroup.values.length,
      child: Scaffold(
        backgroundColor: AppColors.sheet,
        appBar: AppBar(
          backgroundColor: AppColors.primary,
          surfaceTintColor: Colors.transparent,
          title: const Text(
            'Pedidos',
            style: TextStyle(color: Colors.white, fontFamily: 'Montserrat', fontWeight: FontWeight.w800),
          ),
          bottom: TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            labelColor: AppColors.accent,
            unselectedLabelColor: Colors.white70,
            indicatorColor: AppColors.accent,
            labelStyle: const TextStyle(fontWeight: FontWeight.w800),
            tabs: [for (final g in PanelOrderGroup.values) Tab(text: g.label)],
          ),
        ),
        body: TabBarView(children: [for (final g in PanelOrderGroup.values) _OrderList(group: g)]),
      ),
    ),
  );
}

class _OrderList extends StatefulWidget {
  const _OrderList({required this.group});

  final PanelOrderGroup group;

  @override
  State<_OrderList> createState() => _OrderListState();
}

class _OrderListState extends State<_OrderList> {
  List<PanelOrder>? _items;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await context.read<MarketPanelRepository>().orders(widget.group);
      if (mounted) {
        setState(() {
          _items = r;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;
    if (_error != null && items == null) {
      return Center(
        child: RetryBox(message: _error!, onRetry: _load),
      );
    }
    if (items == null) return const Center(child: CircularProgressIndicator());
    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (items.isEmpty)
            LightEmpty(
              icon: Icons.inbox_outlined,
              title: switch (widget.group) {
                PanelOrderGroup.news => 'Nenhum pedido novo',
                PanelOrderGroup.separating => 'Nada em separação',
                PanelOrderGroup.ready => 'Nenhum pedido aguardando retirada',
                PanelOrderGroup.history => 'Sem histórico ainda',
              },
              message: widget.group == PanelOrderGroup.news
                  ? 'Os pedidos aparecem aqui assim que o pagamento é aprovado.'
                  : null,
            ),
          for (final o in items)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 900),
                  child: PanelCard(
                    onTap: () async {
                      await context.push('/mercado/pedidos/${o.id}');
                      _load();
                    },
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 22,
                          backgroundColor: AppColors.brandSoft,
                          child: Text(
                            '${o.itemCount}',
                            style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w800),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Pedido ${o.code}',
                                style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink, fontSize: 15),
                              ),
                              Text(
                                '${o.itemCount} itens · ${timeAgo(o.createdAt)}'
                                '${o.marketCount > 1 ? ' · coleta ${o.sequence} de ${o.marketCount}' : ''}',
                                style: const TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
                              ),
                              const SizedBox(height: 6),
                              orderStatusPill(o),
                            ],
                          ),
                        ),
                        Text(
                          money(o.subtotalCents),
                          style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink),
                        ),
                        const Icon(Icons.chevron_right_rounded, color: AppColors.inkMuted),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Um pedido: aceitar → separar → conferir item a item → pronto para o entregador.
class MarketOrderScreen extends StatefulWidget {
  const MarketOrderScreen({super.key, required this.id});

  final String id;

  @override
  State<MarketOrderScreen> createState() => _MarketOrderScreenState();
}

class _MarketOrderScreenState extends State<MarketOrderScreen> {
  ({PanelOrder order, List<PanelOrderItem> items})? _d;
  String? _error;
  bool _busy = false;
  final Map<String, bool> _marks = {};

  MarketPanelRepository get _repo => context.read<MarketPanelRepository>();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final d = await _repo.order(widget.id);
      if (!mounted) return;
      setState(() {
        _d = d;
        _error = null;
        _marks
          ..clear()
          ..addAll({
            for (final i in d.items)
              if (i.checked != null) i.id: i.checked!,
          });
      });
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    }
  }

  Future<void> _run(Future<void> Function() action, String done) async {
    setState(() => _busy = true);
    try {
      await action();
      await _load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(done)));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(friendlyError(e))));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = _d;
    final o = d?.order;
    final checking = o != null && (o.status == 'em_separacao' || o.status == 'conferido');
    final allMarked = d != null && d.items.every((i) => _marks.containsKey(i.id));
    final missing = _marks.values.where((ok) => !ok).length;
    return PanelPage(
      title: o == null ? 'Pedido' : 'Pedido ${o.code}',
      subtitle: o == null ? null : '${o.itemCount} itens · ${money(o.subtotalCents)} · ${timeAgo(o.createdAt)}',
      showBack: true,
      maxWidth: 820,
      bottom: o == null ? null : _actionBar(o, allMarked, missing),
      children: [
        if (_error != null && d == null)
          RetryBox(message: _error!, onRetry: _load)
        else if (d == null)
          const Padding(
            padding: EdgeInsets.all(40),
            child: Center(child: CircularProgressIndicator()),
          )
        else ...[
          _Steps(status: o!.status),
          const SizedBox(height: 12),
          if (o.marketCount > 1)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                'Este pedido tem ${o.marketCount} mercados. O entregador passa aqui na coleta ${o.sequence} de ${o.marketCount}.',
                style: const TextStyle(color: AppColors.inkMuted, fontSize: 13),
              ),
            ),
          if (checking)
            const Padding(
              padding: EdgeInsets.only(bottom: 8),
              child: Text(
                'Conferência: marque cada item como separado (verde) ou em falta (vermelho).',
                style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink),
              ),
            ),
          for (final i in d.items)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: PanelCard(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 18,
                      backgroundColor: AppColors.brandSoft,
                      child: Text(
                        '${i.quantity}×',
                        style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w800, fontSize: 12.5),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            i.name,
                            style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink),
                          ),
                          Text(
                            '${money(i.unitPriceCents)} un.${i.barcode != null ? ' · cód. ${i.barcode}' : ''}',
                            style: const TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
                          ),
                          if (i.cold)
                            const Text(
                              '❄ Refrigerado · separe por último',
                              style: TextStyle(color: AppColors.info, fontSize: 12.5, fontWeight: FontWeight.w600),
                            ),
                        ],
                      ),
                    ),
                    if (checking) ...[
                      _Mark(
                        tooltip: 'Separado: ${i.name}',
                        icon: Icons.check_rounded,
                        color: AppColors.success,
                        on: _marks[i.id] == true,
                        onTap: () => setState(() => _marks[i.id] = true),
                      ),
                      const SizedBox(width: 6),
                      _Mark(
                        tooltip: 'Em falta: ${i.name}',
                        icon: Icons.close_rounded,
                        color: AppColors.discount,
                        on: _marks[i.id] == false,
                        onTap: () => setState(() => _marks[i.id] = false),
                      ),
                    ] else if (i.checked != null)
                      Icon(
                        i.checked! ? Icons.check_circle_rounded : Icons.cancel_rounded,
                        color: i.checked! ? AppColors.success : AppColors.discount,
                      ),
                  ],
                ),
              ),
            ),
          if (checking && missing > 0)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: AppColors.dangerSoft, borderRadius: BorderRadius.circular(14)),
              child: Text(
                '$missing ${missing == 1 ? 'item em falta' : 'itens em falta'}. A falta fica registrada no pedido para o cliente ser avisado e reembolsado.',
                style: const TextStyle(color: AppColors.discount, fontWeight: FontWeight.w700),
              ),
            ),
        ],
      ],
    );
  }

  Widget? _actionBar(PanelOrder o, bool allMarked, int missing) {
    final (label, onPressed) = switch (o.status) {
      'novo' => ('Aceitar e começar a separar', () => _run(() => _repo.accept(o.id), 'Pedido aceito. Boa separação!')),
      'em_separacao' => (
        'Concluir conferência',
        allMarked ? () => _run(() => _repo.check(o.id, Map.of(_marks)), 'Conferência registrada.') : null,
      ),
      'conferido' => (
        'Pedido pronto para retirada',
        () => _run(() => _repo.ready(o.id), 'Pronto! O entregador será avisado.'),
      ),
      'entregue' => ('Avaliar cliente e entregador', () => context.push('/avaliar/${o.orderId}')),
      _ => (null, null),
    };
    if (label == null) return null;
    return SafeArea(
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: AppColors.line)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (o.status == 'em_separacao' && !allMarked)
              const Padding(
                padding: EdgeInsets.only(bottom: 6),
                child: Text(
                  'Marque todos os itens para concluir.',
                  style: TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
                ),
              ),
            if (o.status == 'conferido')
              TextButton(
                onPressed: _busy
                    ? null
                    : () => setState(() => _d = (order: _copy(o, 'em_separacao'), items: _d!.items)),
                child: const Text('Refazer conferência'),
              ),
            FilledButton(
              onPressed: _busy ? null : onPressed,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.success,
                minimumSize: const Size.fromHeight(52),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: _busy
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                    )
                  : Text(label, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            ),
          ],
        ),
      ),
    );
  }

  PanelOrder _copy(PanelOrder o, String status) => PanelOrder(
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

class _Mark extends StatelessWidget {
  const _Mark({required this.tooltip, required this.icon, required this.color, required this.on, required this.onTap});

  final String tooltip;
  final IconData icon;
  final Color color;
  final bool on;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => IconButton(
    tooltip: tooltip,
    onPressed: onTap,
    style: IconButton.styleFrom(
      backgroundColor: on ? color : Colors.white,
      side: BorderSide(color: on ? color : AppColors.line),
      minimumSize: const Size(44, 44),
    ),
    icon: Icon(icon, color: on ? Colors.white : color),
  );
}

class _Steps extends StatelessWidget {
  const _Steps({required this.status});

  final String status;
  static const _labels = ['Recebido', 'Separação', 'Conferência', 'Pronto'];

  @override
  Widget build(BuildContext context) {
    final current = switch (status) {
      'novo' => 0,
      'em_separacao' => 1,
      'conferido' => 2,
      'cancelado' => -1,
      _ => 3,
    };
    if (current < 0) {
      return const Pill(
        'Pedido cancelado pelo cliente',
        fg: AppColors.discount,
        bg: AppColors.dangerSoft,
        icon: Icons.cancel_rounded,
      );
    }
    return Row(
      children: [
        for (var i = 0; i < 4; i++) ...[
          if (i > 0) Expanded(child: Container(height: 2, color: i <= current ? AppColors.success : AppColors.line)),
          Column(
            children: [
              CircleAvatar(
                radius: 12,
                backgroundColor: i <= current ? AppColors.success : AppColors.line,
                child: Icon(
                  i < current || current == 3 ? Icons.check_rounded : Icons.circle,
                  size: i < current || current == 3 ? 15 : 8,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                _labels[i],
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: i == current ? FontWeight.w800 : FontWeight.w500,
                  color: i <= current ? AppColors.ink : AppColors.inkMuted,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}
