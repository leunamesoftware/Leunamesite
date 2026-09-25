import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/format.dart';
import '../../../data/models/compare.dart';
import '../../../data/repositories/compare_repository.dart';
import '../../../state/address_controller.dart';
import '../../../state/cart_controller.dart';
import '../../../state/checkout_controller.dart';
import '../../../widgets/app_image.dart';
import '../../../widgets/brand_header.dart';
import '../widgets/common.dart';
import 'checkout_widgets.dart';

/// Fase 6 — Seu carrinho: produtos separados por mercado, quantidades, preços, economia, entrega única e total.
class CheckoutCartScreen extends StatefulWidget {
  const CheckoutCartScreen({super.key});

  @override
  State<CheckoutCartScreen> createState() => _CheckoutCartScreenState();
}

class _CheckoutCartScreenState extends State<CheckoutCartScreen> {
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _refresh());
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _refresh() => context.read<CheckoutController>().refresh(
    context.read<CompareRepository>(),
    context.read<CartController>().wants,
    context.read<AddressController>().current,
  );

  /// Recalcula depois que o cliente para de tocar no +/−.
  void _changed() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), _refresh);
  }

  void _remove(String key, String name) {
    final entry = context.read<CartController>().take(key);
    if (entry == null) return;
    _changed();
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text('$name removido do carrinho.'),
          action: SnackBarAction(
            label: 'Desfazer',
            onPressed: () {
              context.read<CartController>().restore(entry);
              _changed();
            },
          ),
        ),
      );
  }

  Future<void> _clear() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Limpar carrinho?'),
        content: const Text('Todos os produtos serão removidos.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Limpar')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    context.read<CartController>().clear();
    context.read<CheckoutController>().clear();
    context.go('/cliente');
  }

  @override
  Widget build(BuildContext context) {
    final ck = context.watch<CheckoutController>();
    final cart = context.watch<CartController>();
    final r = ck.result;
    final plan = ck.plan;
    final ready =
        plan != null && !ck.loading && plan.missing.isEmpty && plan.itemsCents >= r!.minOrderCents && cart.count > 0;

    return BrandScaffold(
      showBack: true,
      title: 'Seu carrinho',
      subtitle: 'Produtos separados por mercado, com uma única taxa de entrega.',
      bottom: plan == null || cart.items.isEmpty
          ? null
          : _Bar(
              totalCents: plan.totalCents,
              loading: ck.loading,
              onContinue: ready ? () => context.push('/cliente/pedido/confirmar') : null,
            ),
      slivers: [
        const SliverToBoxAdapter(child: CheckoutSteps(current: 2)),
        if (ck.loading && r != null) const SliverToBoxAdapter(child: LinearProgressIndicator(minHeight: 2)),
        if (cart.items.isEmpty)
          SliverToBoxAdapter(
            child: LightEmpty(
              icon: Icons.remove_shopping_cart_outlined,
              title: 'Seu carrinho está vazio',
              message: 'Monte sua lista e o EconoRota encontra os melhores preços.',
              action: FilledButton(
                onPressed: () => context.go('/cliente/selecionar'),
                child: const Text('Montar lista'),
              ),
            ),
          )
        else if (ck.error != null && r == null)
          SliverToBoxAdapter(
            child: RetryBox(message: ck.error!, onRetry: _refresh),
          )
        else if (r == null || plan == null)
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.all(40),
              child: Center(child: CircularProgressIndicator()),
            ),
          )
        else
          SliverToBoxAdapter(
            child: CheckoutLayout(
              main: [
                if (plan.missing.isNotEmpty) _MissingNotice(names: plan.missing.map((k) => r.row(k).name).toList()),
                for (final (i, id) in (plan.route?.order ?? plan.marketIds).indexed) ...[
                  _MarketCart(
                    result: r,
                    plan: plan,
                    marketId: id,
                    stop: i + 1,
                    bestPrice: ck.bestPrice,
                    qtyOf: cart.quantityOfKey,
                    onMinus: (key, name) {
                      if (cart.quantityOfKey(key) <= 1) {
                        _remove(key, name);
                      } else {
                        cart.decrement(key);
                        _changed();
                      }
                    },
                    onPlus: (key) {
                      cart.increment(key);
                      _changed();
                    },
                    onRemove: _remove,
                  ),
                  const SizedBox(height: 12),
                ],
                Wrap(
                  alignment: WrapAlignment.spaceBetween,
                  children: [
                    TextButton.icon(
                      onPressed: () => context.go('/cliente'),
                      icon: const Icon(Icons.arrow_back_rounded),
                      label: const Text('Continuar comprando'),
                    ),
                    TextButton.icon(
                      onPressed: _clear,
                      style: TextButton.styleFrom(foregroundColor: AppColors.inkMuted),
                      icon: const Icon(Icons.delete_sweep_outlined),
                      label: const Text('Limpar carrinho'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
              ],
              side: [
                PurchaseSummary(result: r, plan: plan, savings: ck.savings, savingsPct: ck.savingsPct),
                if (plan.itemsCents < r.minOrderCents) ...[
                  const SizedBox(height: 10),
                  _Notice(
                    'Pedido mínimo de ${money(r.minOrderCents)} em produtos. '
                    'Faltam ${money(r.minOrderCents - plan.itemsCents)}.',
                  ),
                ],
                const SizedBox(height: 24),
              ],
            ),
          ),
      ],
    );
  }
}

class _MarketCart extends StatelessWidget {
  const _MarketCart({
    required this.result,
    required this.plan,
    required this.marketId,
    required this.stop,
    required this.bestPrice,
    required this.qtyOf,
    required this.onMinus,
    required this.onPlus,
    required this.onRemove,
  });

  final CompareResult result;
  final ComparePlan plan;
  final String marketId;
  final int stop;
  final int? Function(String key) bestPrice;
  final int Function(String key) qtyOf;
  final void Function(String key, String name) onMinus;
  final void Function(String key) onPlus;
  final void Function(String key, String name) onRemove;

  @override
  Widget build(BuildContext context) {
    final lines = plan.linesOf(marketId);
    final sub = lines.fold<int>(0, (s, l) => s + l.unitCents * qtyOf(l.key));
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        children: [
          MarketHeader(
            market: result.market(marketId),
            stop: stop,
            trailing: TextButton(
              onPressed: () => context.push('/cliente/mercado/$marketId/produtos'),
              child: const Text('Ver mais produtos'),
            ),
          ),
          const Divider(height: 20),
          for (final l in lines)
            _Line(row: result.row(l.key), line: l, qty: qtyOf(l.key), best: bestPrice(l.key), parent: this),
          const Divider(height: 16),
          KeyValue('Subtotal deste mercado', money(sub), bold: true),
        ],
      ),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line({required this.row, required this.line, required this.qty, required this.best, required this.parent});

  final CompareRow row;
  final CompareLine line;

  /// Quantidade atual no carrinho (responde na hora; o preço confirma após recalcular).
  final int qty;
  final int? best;
  final _MarketCart parent;

  @override
  Widget build(BuildContext context) {
    final isBest = best != null && line.unitCents <= best!;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: SizedBox(
              width: 44,
              height: 44,
              child: AppImage(
                row.imageUrl,
                fit: BoxFit.contain,
                fallback: const Icon(Icons.shopping_basket_rounded, color: AppColors.primaryLight),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  row.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink, fontSize: 14),
                ),
                Wrap(
                  spacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      '${row.unit} · ${money(line.unitCents)} un.',
                      style: const TextStyle(fontSize: 12.5, color: AppColors.inkMuted),
                    ),
                    if (isBest)
                      const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.verified_rounded, size: 14, color: AppColors.success),
                          SizedBox(width: 2),
                          Text(
                            'menor preço',
                            style: TextStyle(fontSize: 11.5, color: AppColors.success, fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                  ],
                ),
                Text(
                  money(line.unitCents * qty),
                  style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: qty <= 1 ? 'Remover ${row.name}' : 'Diminuir ${row.name}',
            onPressed: () => parent.onMinus(line.key, row.name),
            icon: Icon(qty <= 1 ? Icons.delete_outline_rounded : Icons.remove_rounded, color: AppColors.primary),
          ),
          SizedBox(
            width: 22,
            child: Text(
              '$qty',
              textAlign: TextAlign.center,
              style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink, fontSize: 16),
            ),
          ),
          IconButton(
            tooltip: 'Aumentar ${row.name}',
            onPressed: qty >= CartController.maxQty ? null : () => parent.onPlus(line.key),
            icon: const Icon(Icons.add_rounded, color: AppColors.primary),
          ),
        ],
      ),
    );
  }
}

class _MissingNotice extends StatelessWidget {
  const _MissingNotice({required this.names});

  final List<String> names;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: _Notice(
      'Sem estoque nos mercados escolhidos: ${names.join(', ')}. Remova ou volte à comparação para escolher outros mercados.',
    ),
  );
}

class _Notice extends StatelessWidget {
  const _Notice(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(14)),
    child: Row(
      children: [
        const Icon(Icons.info_rounded, color: Color(0xFFB45309)),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(color: Color(0xFF92400E), fontWeight: FontWeight.w600, fontSize: 13),
          ),
        ),
      ],
    ),
  );
}

class _Bar extends StatelessWidget {
  const _Bar({required this.totalCents, required this.loading, required this.onContinue});

  final int totalCents;
  final bool loading;
  final VoidCallback? onContinue;

  @override
  Widget build(BuildContext context) => SafeArea(
    child: Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.line)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Total com entrega', style: TextStyle(fontSize: 12.5, color: AppColors.inkMuted)),
                Text(
                  loading ? 'Atualizando…' : money(totalCents),
                  style: const TextStyle(
                    fontFamily: 'Montserrat',
                    fontWeight: FontWeight.w800,
                    fontSize: 20,
                    color: AppColors.ink,
                  ),
                ),
              ],
            ),
          ),
          FilledButton.icon(
            onPressed: onContinue,
            icon: const Icon(Icons.arrow_forward_rounded),
            label: const Text('Continuar', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.success,
              minimumSize: const Size(0, 52),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
          ),
        ],
      ),
    ),
  );
}
