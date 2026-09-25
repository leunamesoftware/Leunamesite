import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/errors.dart';
import '../../core/utils/format.dart';
import '../../data/models/market_panel.dart';
import '../../data/repositories/market_panel_repository.dart';
import '../customer/widgets/common.dart';
import 'market_widgets.dart';

/// Estoque: entrada, saída e ajuste; estoque baixo e indisponível primeiro; histórico de movimentos.
class MarketStockScreen extends StatelessWidget {
  const MarketStockScreen({super.key});

  @override
  Widget build(BuildContext context) => Theme(
    data: AppTheme.light,
    child: DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: AppColors.sheet,
        appBar: AppBar(
          backgroundColor: AppColors.primary,
          surfaceTintColor: Colors.transparent,
          title: const Text(
            'Estoque',
            style: TextStyle(color: Colors.white, fontFamily: 'Montserrat', fontWeight: FontWeight.w800),
          ),
          bottom: const TabBar(
            labelColor: AppColors.accent,
            unselectedLabelColor: Colors.white70,
            indicatorColor: AppColors.accent,
            labelStyle: TextStyle(fontWeight: FontWeight.w800),
            tabs: [
              Tab(text: 'Produtos'),
              Tab(text: 'Movimentações'),
            ],
          ),
        ),
        body: const TabBarView(children: [_StockList(), _Moves()]),
      ),
    ),
  );
}

class _StockList extends StatefulWidget {
  const _StockList();

  @override
  State<_StockList> createState() => _StockListState();
}

class _StockListState extends State<_StockList> {
  List<PanelProduct>? _items;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await context.read<MarketPanelRepository>().products();
      // Primeiro o que precisa de atenção: indisponível, baixo e depois o resto.
      r.sort(
        (a, b) => a.level.index != b.level.index ? b.level.index.compareTo(a.level.index) : a.stock.compareTo(b.stock),
      );
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

  Future<void> _move(PanelProduct p) async {
    ScaffoldMessenger.of(context).clearSnackBars();
    final done = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: Colors.white,
      builder: (_) => StockMoveSheet(product: p),
    );
    if (done == true) _load();
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
          for (final p in items)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 900),
                  child: PanelCard(
                    onTap: () => _move(p),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                p.name,
                                style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink),
                              ),
                              Text(
                                '${[p.brand, p.unit].whereType<String>().join(' · ')} · mínimo ${p.minStock}',
                                style: const TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
                              ),
                              const SizedBox(height: 6),
                              Wrap(
                                spacing: 6,
                                runSpacing: 4,
                                children: [StockPill(p), if (p.expiresOn != null) ExpiryPill(p.expiresOn!)],
                              ),
                            ],
                          ),
                        ),
                        FilledButton.tonalIcon(
                          onPressed: () => _move(p),
                          icon: const Icon(Icons.swap_vert_rounded),
                          label: const Text('Movimentar'),
                        ),
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

/// Entrada (compra/reposição), saída (avaria, perda, uso) ou ajuste (contagem).
class StockMoveSheet extends StatefulWidget {
  const StockMoveSheet({super.key, required this.product});

  final PanelProduct product;

  @override
  State<StockMoveSheet> createState() => _StockMoveSheetState();
}

class _StockMoveSheetState extends State<StockMoveSheet> {
  StockMoveType _type = StockMoveType.entrada;
  final _qty = TextEditingController();
  final _reason = TextEditingController();
  String? _error;
  bool _saving = false;

  @override
  void dispose() {
    _qty.dispose();
    _reason.dispose();
    super.dispose();
  }

  int? get _preview {
    final q = int.tryParse(_qty.text);
    if (q == null) return null;
    return switch (_type) {
      StockMoveType.entrada => widget.product.stock + q,
      StockMoveType.saida => widget.product.stock - q,
      _ => q,
    };
  }

  Future<void> _save() async {
    final q = int.tryParse(_qty.text);
    if (q == null || (q <= 0 && _type != StockMoveType.ajuste)) {
      setState(() => _error = 'Informe a quantidade.');
      return;
    }
    if ((_preview ?? 0) < 0) {
      setState(() => _error = 'Saída maior que o estoque atual (${widget.product.stock}).');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await context.read<MarketPanelRepository>().moveStock(
        widget.product.id,
        _type,
        q,
        reason: _reason.text.trim().isEmpty ? null : _reason.text.trim(),
      );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => Theme(
    data: AppTheme.light,
    child: SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            widget.product.name,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: AppColors.ink),
          ),
          Text('Estoque atual: ${widget.product.stock}', style: const TextStyle(color: AppColors.inkMuted)),
          const SizedBox(height: 12),
          SegmentedButton<StockMoveType>(
            segments: const [
              ButtonSegment(value: StockMoveType.entrada, label: Text('Entrada'), icon: Icon(Icons.add_rounded)),
              ButtonSegment(value: StockMoveType.saida, label: Text('Saída'), icon: Icon(Icons.remove_rounded)),
              ButtonSegment(value: StockMoveType.ajuste, label: Text('Ajuste'), icon: Icon(Icons.tune_rounded)),
            ],
            selected: {_type},
            onSelectionChanged: (s) => setState(() => _type = s.first),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _qty,
            autofocus: true,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              labelText: _type == StockMoveType.ajuste ? 'Quantidade contada (novo estoque)' : 'Quantidade',
              helperText: _preview == null ? null : 'Estoque ficará em $_preview',
              errorText: _error,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _reason,
            maxLength: 120,
            decoration: InputDecoration(
              labelText: 'Motivo (opcional)',
              hintText: _type == StockMoveType.entrada ? 'Ex.: Nota fiscal 1234' : 'Ex.: Avaria, vencido, contagem',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
            ),
          ),
          FilledButton(
            onPressed: _saving ? null : _save,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.success,
              minimumSize: const Size.fromHeight(52),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: Text('Registrar ${_type.label.toLowerCase()}', style: const TextStyle(fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    ),
  );
}

class _Moves extends StatefulWidget {
  const _Moves();

  @override
  State<_Moves> createState() => _MovesState();
}

class _MovesState extends State<_Moves> {
  // Carrega ao abrir a aba (sempre atualizado).
  late final Future<List<StockMove>> _future = context.read<MarketPanelRepository>().movements();

  @override
  Widget build(BuildContext context) => FutureBuilder<List<StockMove>>(
    future: _future,
    builder: (context, snap) {
      if (snap.hasError) return Center(child: Text(friendlyError(snap.error!)));
      if (!snap.hasData) return const Center(child: CircularProgressIndicator());
      final list = snap.data!;
      if (list.isEmpty) {
        return const Center(
          child: LightEmpty(
            icon: Icons.history_rounded,
            title: 'Nenhuma movimentação ainda',
            message: 'Entradas, saídas, ajustes e vendas aparecem aqui.',
          ),
        );
      }
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          for (final m in list)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: PanelCard(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                child: Row(
                  children: [
                    Icon(
                      m.quantity >= 0 ? Icons.south_west_rounded : Icons.north_east_rounded,
                      color: m.quantity >= 0 ? AppColors.success : AppColors.discount,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            m.productName,
                            style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink),
                          ),
                          Text(
                            [m.type.label, if (m.reason != null) m.reason!, dateTime(m.createdAt)].join(' · '),
                            style: const TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
                          ),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          '${m.quantity > 0 ? '+' : ''}${m.quantity}',
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            color: m.quantity >= 0 ? AppColors.success : AppColors.discount,
                          ),
                        ),
                        if (m.stockAfter != null)
                          Text('fica ${m.stockAfter}', style: const TextStyle(color: AppColors.inkMuted, fontSize: 12)),
                      ],
                    ),
                  ],
                ),
              ),
            ),
        ],
      );
    },
  );
}
