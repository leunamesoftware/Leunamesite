import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/errors.dart';
import '../../../core/utils/format.dart';
import '../../../core/compare/optimizer.dart' show maxMarkets;
import '../../../core/compare/route.dart' show avgSpeedKmh;
import '../../../core/compare/rules.dart';
import '../../../data/models/catalog.dart';
import '../../../data/models/compare.dart';
import '../../../data/repositories/catalog_repository.dart';
import '../../../data/repositories/compare_repository.dart';
import '../../../state/address_controller.dart';
import '../../../state/cart_controller.dart';
import '../../../state/checkout_controller.dart';
import '../../../widgets/app_image.dart';
import '../../../widgets/category_icon.dart';
import '../../../widgets/skeleton.dart';
import '../checkout/checkout_widgets.dart';
import '../widgets/common.dart';

/// Comparação inteligente: melhor combinação (até 3 mercados) e tabela de preços por mercado.
class CompareScreen extends StatefulWidget {
  const CompareScreen({super.key, this.fromSmartList = false});

  /// Veio da lista inteligente: mostra "Encontramos a melhor combinação…".
  final bool fromSmartList;

  @override
  State<CompareScreen> createState() => _CompareScreenState();
}

class _CompareScreenState extends State<CompareScreen> {
  CompareResult? _r;
  String? _error;
  int _plan = 0;

  /// Mercados escolhidos pelo cliente (vazio = o EconoRota escolhe).
  List<String> _chosen = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final wants = context.read<CartController>().wants;
    final a = context.read<AddressController>().current;
    setState(() {
      _r = null;
      _error = null;
      _plan = 0;
    });
    if (wants.isEmpty) return;
    try {
      final r = await context.read<CompareRepository>().compare(wants, lat: a?.lat, lng: a?.lng, marketIds: _chosen);
      if (mounted) setState(() => _r = r);
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    }
  }

  Future<void> _chooseMarkets() async {
    final a = context.read<AddressController>().current;
    final all = (await context.read<CatalogRepository>().markets(
      lat: a?.lat,
      lng: a?.lng,
    )).where((m) => m.isOpen).toList();
    if (!mounted) return;
    final picked = await showModalBottomSheet<List<String>>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => _MarketPicker(markets: all, initial: _chosen),
    );
    if (picked != null && mounted) {
      setState(() => _chosen = picked);
      _load();
    }
  }

  /// Segue para o carrinho com os mercados do plano escolhido (visitante entra só na confirmação).
  void _continue(ComparePlan plan) {
    context.read<CheckoutController>().start(plan.marketIds);
    context.push('/cliente/pedido');
  }

  @override
  Widget build(BuildContext context) {
    final empty = context.select<CartController, bool>((c) => c.items.isEmpty);
    final r = _r;
    final plans = r?.plans ?? const <ComparePlan>[];
    final plan = plans.isEmpty ? null : plans[_plan.clamp(0, plans.length - 1)];

    return Theme(
      data: AppTheme.light,
      child: DefaultTabController(
        length: 3,
        child: Scaffold(
          backgroundColor: AppColors.sheet,
          appBar: AppBar(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            leading: IconButton(
              tooltip: 'Voltar',
              onPressed: () => context.canPop() ? context.pop() : context.go('/cliente'),
              icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
            ),
            title: const Text(
              'Comparação',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
            ),
            actions: [
              IconButton(
                tooltip: 'Escolher mercados',
                onPressed: _chooseMarkets,
                icon: Badge(
                  isLabelVisible: _chosen.isNotEmpty,
                  backgroundColor: AppColors.accent,
                  textColor: AppColors.onAccent,
                  label: Text('${_chosen.length}'),
                  child: const Icon(Icons.storefront_rounded, color: Colors.white),
                ),
              ),
              IconButton(
                tooltip: 'Editar lista',
                onPressed: () => context.push('/cliente/carrinho'),
                icon: const Icon(Icons.edit_note_rounded, color: Colors.white),
              ),
            ],
            bottom: const TabBar(
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              labelColor: AppColors.accent,
              unselectedLabelColor: Colors.white70,
              indicatorColor: AppColors.accent,
              labelStyle: TextStyle(fontWeight: FontWeight.w800),
              tabs: [
                Tab(text: 'Melhor combinação'),
                Tab(text: 'Economia'),
                Tab(text: 'Tabela de preços'),
              ],
            ),
          ),
          body: empty
              ? Center(
                  child: LightEmpty(
                    icon: Icons.playlist_add_rounded,
                    title: 'Sua lista está vazia',
                    message: 'Adicione produtos para comparar entre os mercados.',
                    action: FilledButton(
                      onPressed: () => context.push('/cliente/selecionar'),
                      child: const Text('Montar lista'),
                    ),
                  ),
                )
              : _error != null
              ? Center(
                  child: RetryBox(message: _error!, onRetry: _load),
                )
              : r == null
              ? const _Loading()
              : r.markets.isEmpty || plan == null
              ? const Center(
                  child: LightEmpty(
                    icon: Icons.storefront_outlined,
                    title: 'Nenhum mercado aberto atende sua lista agora',
                    message: 'Tente mais tarde ou confira o endereço de entrega.',
                  ),
                )
              : TabBarView(
                  children: [
                    _PlanView(
                      headline: widget.fromSmartList && _chosen.isEmpty,
                      chosen: _chosen,
                      onChooseMarkets: _chooseMarkets,
                      result: r,
                      plan: plan,
                      plans: plans,
                      selected: _plan,
                      onSelect: (i) => setState(() => _plan = i),
                      onRefresh: _load,
                    ),
                    _SavingsView(result: r, plan: plan),
                    _PriceTable(result: r),
                  ],
                ),
          bottomNavigationBar: plan == null || _error != null
              ? null
              : SafeArea(
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
                              Text(
                                'Total com entrega · ${plan.marketIds.length} ${plan.marketIds.length == 1 ? 'mercado' : 'mercados'}',
                                style: const TextStyle(fontSize: 12.5, color: AppColors.inkMuted),
                              ),
                              Text(
                                money(plan.totalCents),
                                style: const TextStyle(
                                  fontFamily: 'Montserrat',
                                  fontWeight: FontWeight.w800,
                                  fontSize: 22,
                                  color: AppColors.ink,
                                ),
                              ),
                            ],
                          ),
                        ),
                        FilledButton(
                          onPressed: plan.itemsCents >= r!.minOrderCents ? () => _continue(plan) : null,
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.success,
                            minimumSize: const Size(0, 52),
                            padding: const EdgeInsets.symmetric(horizontal: 20),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                          child: const Text('Continuar', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                        ),
                      ],
                    ),
                  ),
                ),
        ),
      ),
    );
  }
}

class _Loading extends StatelessWidget {
  const _Loading();

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(16),
    children: const [
      Center(
        child: Padding(
          padding: EdgeInsets.all(12),
          child: Text(
            'Comparando preços nos mercados perto de você…',
            style: TextStyle(color: AppColors.inkMuted, fontWeight: FontWeight.w600),
          ),
        ),
      ),
      Skeleton(height: 150, radius: 20),
      SizedBox(height: 12),
      Skeleton(height: 220, radius: 20),
    ],
  );
}

class _PlanView extends StatelessWidget {
  const _PlanView({
    this.headline = false,
    required this.chosen,
    required this.onChooseMarkets,
    required this.result,
    required this.plan,
    required this.plans,
    required this.selected,
    required this.onSelect,
    required this.onRefresh,
  });

  final bool headline;
  final List<String> chosen;
  final VoidCallback onChooseMarkets;
  final CompareResult result;
  final ComparePlan plan;
  final List<ComparePlan> plans;
  final int selected;
  final ValueChanged<int> onSelect;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final r = result;
    final best = r.best!;
    // Economia do plano escolhido em relação a comprar tudo no mercado único mais barato.
    final single = r.single;
    final vsSingle = single == null || single == plan ? 0 : single.totalCents - plan.totalCents;
    final vsAverage = r.savingsVsAverage;

    return RefreshIndicator(
      onRefresh: onRefresh,
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          if (headline) ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(gradient: AppColors.headerGradient, borderRadius: BorderRadius.circular(16)),
              child: Row(
                children: [
                  const Icon(Icons.auto_awesome_rounded, color: AppColors.accent, size: 28),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Encontramos a melhor combinação para sua compra.',
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15.5),
                        ),
                        Text(
                          '${r.rows.length} produtos · ${plan.marketIds.length} ${plan.marketIds.length == 1 ? 'mercado' : 'mercados'} · marcas pedidas respeitadas',
                          style: const TextStyle(color: Colors.white70, fontSize: 12.5),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
          Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            child: ListTile(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
                side: const BorderSide(color: AppColors.line),
              ),
              leading: const Icon(Icons.storefront_rounded, color: AppColors.primary),
              title: Text(
                chosen.isEmpty
                    ? 'O EconoRota escolhe os mercados'
                    : 'Você escolheu ${chosen.length} de ${result.maxMarkets} mercados',
                style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink, fontSize: 14.5),
              ),
              subtitle: Text(
                chosen.isEmpty
                    ? 'Entre os ${result.markets.length} abertos perto de você'
                    : result.markets.map((m) => m.name).join(', '),
                style: const TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
              ),
              trailing: TextButton(onPressed: onChooseMarkets, child: const Text('Alterar')),
            ),
          ),
          const SizedBox(height: 12),
          if (plans.length > 1) ...[
            Row(
              children: [
                for (var i = 0; i < plans.length; i++) ...[
                  if (i > 0) const SizedBox(width: 8),
                  Expanded(
                    child: _PlanChoice(
                      title: plans[i].label == 'cheapest' ? 'Mais barato' : 'Um só mercado',
                      subtitle:
                          '${money(plans[i].totalCents)} · ${plans[i].marketIds.length} ${plans[i].marketIds.length == 1 ? 'mercado' : 'mercados'}',
                      selected: selected == i,
                      onTap: () => onSelect(i),
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 12),
          ],
          _SummaryCard(result: r, plan: plan, vsSingle: vsSingle, vsAverage: plan == best ? vsAverage : 0),
          if (plan.itemsCents < r.minOrderCents) ...[
            const SizedBox(height: 12),
            _MinOrderNotice(minCents: r.minOrderCents, currentCents: plan.itemsCents),
          ],
          if (plan.missing.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(14)),
              child: Row(
                children: [
                  const Icon(Icons.warning_amber_rounded, color: Color(0xFFB45309)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Sem estoque perto de você: ${plan.missing.map((k) => r.row(k).name).join(', ')}.',
                      style: const TextStyle(color: Color(0xFF92400E), fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 12),
          _StayHome(result: r, plan: plan),
          if (plan.route != null) ...[const SizedBox(height: 12), _RouteCard(result: r, plan: plan)],
          for (final (i, id) in (plan.route?.order ?? plan.marketIds).indexed) ...[
            const SizedBox(height: 12),
            _MarketGroup(result: r, plan: plan, marketId: id, stop: i + 1),
          ],
          if (single != null && single != plan && single.totalCents > plan.totalCents) ...[
            const SizedBox(height: 16),
            _VsSingle(single: single, plan: plan),
          ],
          const SizedBox(height: 16),
          _Rules(result: r),
        ],
      ),
    );
  }
}

class _PlanChoice extends StatelessWidget {
  const _PlanChoice({required this.title, required this.subtitle, required this.selected, required this.onTap});

  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    selected: selected,
    button: true,
    child: Material(
      color: selected ? AppColors.brandSoft : Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: selected ? AppColors.primary : AppColors.line, width: selected ? 2 : 1),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink),
              ),
              FittedBox(
                child: Text(subtitle, style: const TextStyle(fontSize: 12.5, color: AppColors.inkMuted)),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.result, required this.plan, required this.vsSingle, required this.vsAverage});

  final CompareResult result;
  final ComparePlan plan;
  final int vsSingle;
  final int vsAverage;

  @override
  Widget build(BuildContext context) {
    final saving = vsSingle > 0 ? vsSingle : vsAverage;
    Widget row(String label, String value, {bool bold = false, Color? color}) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Expanded(
            child: Text(label, style: const TextStyle(color: Colors.white70)),
          ),
          Text(
            value,
            style: TextStyle(color: color ?? Colors.white, fontWeight: bold ? FontWeight.w800 : FontWeight.w600),
          ),
        ],
      ),
    );
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(gradient: AppColors.headerGradient, borderRadius: BorderRadius.circular(20)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.auto_awesome_rounded, color: AppColors.accent),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  plan.marketIds.length == 1
                      ? 'Tudo em ${result.market(plan.marketIds.first).name}'
                      : 'Melhor combinação: ${plan.marketIds.length} mercados',
                  style: const TextStyle(
                    fontFamily: 'Montserrat',
                    fontWeight: FontWeight.w800,
                    fontSize: 17,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
          if (saving > 0) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(color: AppColors.accent, borderRadius: BorderRadius.circular(12)),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.savings_rounded, color: AppColors.onAccent, size: 20),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      vsSingle > 0
                          ? 'Economia de ${money(saving)} vs. um só mercado'
                          : 'Economia de ${money(saving)} vs. preço médio',
                      style: const TextStyle(color: AppColors.onAccent, fontWeight: FontWeight.w800),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 10),
          row('Produtos (${plan.lines.fold<int>(0, (s, l) => s + l.qty)} un.)', money(plan.itemsCents)),
          Row(
            children: [
              const Expanded(
                child: Text('Entrega', style: TextStyle(color: Colors.white70)),
              ),
              InkWell(
                borderRadius: BorderRadius.circular(8),
                onTap: () => showDeliveryDetails(context, result, plan),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.info_outline_rounded, size: 16, color: Colors.white70),
                      const SizedBox(width: 4),
                      Text(
                        money(plan.deliveryCents),
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const Text(
            'Um entregador busca tudo e entrega de uma vez só.',
            style: TextStyle(color: Colors.white60, fontSize: 12),
          ),
          row('Previsão', 'até ${plan.etaMax} min'),
          const Divider(color: Colors.white24, height: 16),
          row('Total', money(plan.totalCents), bold: true, color: AppColors.accent),
        ],
      ),
    );
  }
}

class _MarketGroup extends StatelessWidget {
  const _MarketGroup({required this.result, required this.plan, required this.marketId, required this.stop});

  final CompareResult result;
  final ComparePlan plan;
  final String marketId;
  final int stop;

  @override
  Widget build(BuildContext context) {
    final m = result.market(marketId);
    final lines = plan.linesOf(marketId);
    final sub = lines.fold<int>(0, (s, l) => s + l.totalCents);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: SizedBox(
                    width: 44,
                    height: 44,
                    child: plan.marketIds.length > 1
                        ? ColoredBox(
                            color: AppColors.primary,
                            child: Center(
                              child: Text(
                                '$stop',
                                style: const TextStyle(
                                  color: AppColors.accent,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 20,
                                ),
                              ),
                            ),
                          )
                        : AppImage(
                            m.imageUrl,
                            fallback: const ColoredBox(
                              color: AppColors.primary,
                              child: Icon(Icons.storefront_rounded, color: AppColors.accent),
                            ),
                          ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        m.name,
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.ink),
                      ),
                      Text(
                        '${lines.length} ${lines.length == 1 ? 'produto' : 'produtos'}'
                        '${m.distanceKm != null ? ' · ${distance(m.distanceKm!)}' : ''}',
                        style: const TextStyle(fontSize: 12.5, color: AppColors.inkMuted),
                      ),
                    ],
                  ),
                ),
                Text(
                  money(sub),
                  style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink),
                ),
              ],
            ),
            if (plan.marketIds.length > 1) ...[
              const SizedBox(height: 10),
              _MinItems(count: lines.length, min: result.minItems),
            ],
            const Divider(height: 18),
            for (final l in lines) _LineRow(row: result.row(l.key), line: l),
            const Divider(height: 18),
            _Kv('Subtotal em ${m.name}', money(sub), bold: true),
          ],
        ),
      ),
    );
  }
}

class _LineRow extends StatelessWidget {
  const _LineRow({required this.row, required this.line});

  final CompareRow row;
  final CompareLine line;

  @override
  Widget build(BuildContext context) {
    final isBest = row.best != null && line.unitCents <= row.best!;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(
            width: 36,
            height: 36,
            child: AppImage(
              row.imageUrl,
              fit: BoxFit.contain,
              fallback: Icon(categoryIcon('mercearia'), color: AppColors.primaryLight.withValues(alpha: .5), size: 20),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              '${line.qty}× ${row.name} · ${row.unit}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: AppColors.ink),
            ),
          ),
          if (isBest)
            const Padding(
              padding: EdgeInsets.only(right: 6),
              child: Tooltip(
                message: 'Menor preço',
                child: Icon(Icons.verified_rounded, size: 16, color: AppColors.success),
              ),
            ),
          Text(
            money(line.totalCents),
            style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink),
          ),
        ],
      ),
    );
  }
}

class _Rules extends StatelessWidget {
  const _Rules({required this.result});

  final CompareResult result;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(color: AppColors.brandSoft, borderRadius: BorderRadius.circular(14)),
    child: Row(
      children: [
        const Icon(Icons.lightbulb_outline_rounded, color: AppColors.primary),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            'Dica do EconoRota: combinamos até ${result.maxMarkets} mercados, com no mínimo ${result.minItems} produtos em cada, '
            'e a entrega já está no total. Só dividimos o pedido quando você realmente economiza.',
            style: const TextStyle(color: AppColors.ink, fontSize: 13, height: 1.4),
          ),
        ),
      ],
    ),
  );
}

/// Tabela: produtos × mercados, com o menor preço de cada linha em destaque.
class _PriceTable extends StatelessWidget {
  const _PriceTable({required this.result});

  final CompareResult result;

  static const _productW = 150.0;
  static const _cellW = 104.0;

  @override
  Widget build(BuildContext context) {
    final r = result;
    Widget header(String text, {double w = _cellW, Widget? leading}) => Container(
      width: w,
      height: 52,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      alignment: Alignment.centerLeft,
      color: AppColors.primary,
      child: Row(
        children: [
          ?leading,
          Expanded(
            child: Text(
              text,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12.5),
            ),
          ),
        ],
      ),
    );

    return ListView(
      padding: const EdgeInsets.fromLTRB(0, 12, 0, 24),
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 0, 16, 10),
          child: Text(
            'Preço unitário e estoque em cada mercado. Em verde, o menor preço; “—” quando o mercado não vende. '
            'Arraste para o lado para ver todos.',
            style: TextStyle(color: AppColors.inkMuted, fontSize: 13),
          ),
        ),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: Container(
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.line),
                color: Colors.white,
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      header('Produto', w: _productW),
                      for (final m in r.markets) header(m.name),
                    ],
                  ),
                  for (final (i, row) in r.rows.indexed)
                    Container(
                      color: i.isEven ? Colors.white : AppColors.sheet,
                      child: Row(
                        children: [
                          SizedBox(
                            width: _productW,
                            height: 60,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 8),
                              child: Row(
                                children: [
                                  SizedBox(
                                    width: 30,
                                    height: 30,
                                    child: AppImage(
                                      row.imageUrl,
                                      fit: BoxFit.contain,
                                      fallback: const Icon(
                                        Icons.shopping_basket_outlined,
                                        size: 18,
                                        color: AppColors.primaryLight,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Column(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          row.name,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 12.5,
                                            color: AppColors.ink,
                                          ),
                                        ),
                                        Text(row.unit, style: const TextStyle(fontSize: 11, color: AppColors.inkMuted)),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          for (final m in r.markets)
                            _PriceCell(cents: row.prices[m.id], best: row.best, noStock: row.outOfStock.contains(m.id)),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _PriceCell extends StatelessWidget {
  const _PriceCell({required this.cents, required this.best, this.noStock = false});

  final int? cents;
  final int? best;
  final bool noStock;

  @override
  Widget build(BuildContext context) {
    final isBest = cents != null && cents == best;
    return Container(
      width: _PriceTable._cellW,
      height: 60,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: isBest ? AppColors.successSoft : null,
        border: const Border(left: BorderSide(color: AppColors.line)),
      ),
      child: cents == null
          ? (noStock
                ? const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.circle, size: 9, color: AppColors.discount),
                      SizedBox(width: 4),
                      Text(
                        'Sem estoque',
                        style: TextStyle(color: AppColors.discount, fontSize: 11.5, fontWeight: FontWeight.w600),
                      ),
                    ],
                  )
                : const Tooltip(
                    message: 'Não vende',
                    child: Text('—', style: TextStyle(color: AppColors.inkMuted)),
                  ))
          : FittedBox(
              fit: BoxFit.scaleDown,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    money(cents!),
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      color: isBest ? AppColors.success : AppColors.ink,
                      fontSize: 13.5,
                    ),
                  ),
                  if (isBest)
                    const Text(
                      'Menor preço',
                      style: TextStyle(fontSize: 10, color: AppColors.success, fontWeight: FontWeight.w700),
                    ),
                ],
              ),
            ),
    );
  }
}

/// Pedido mínimo do EconoRota: mostra quanto falta e leva de volta à lista.
class _MinOrderNotice extends StatelessWidget {
  const _MinOrderNotice({required this.minCents, required this.currentCents});

  final int minCents;
  final int currentCents;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(color: AppColors.infoSoft, borderRadius: BorderRadius.circular(14)),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Faltam ${money(minCents - currentCents)} para o pedido mínimo de ${money(minCents)}.',
          style: const TextStyle(color: AppColors.info, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: currentCents / minCents,
            minHeight: 8,
            color: AppColors.info,
            backgroundColor: Colors.white,
          ),
        ),
        const SizedBox(height: 6),
        TextButton.icon(
          onPressed: () => context.push('/cliente/selecionar'),
          icon: const Icon(Icons.add_rounded),
          label: const Text('Adicionar produtos'),
        ),
      ],
    ),
  );
}

/// Cálculo da economia do plano escolhido: seu preço × preço médio × preço mais alto, por item e no total.
class _SavingsView extends StatelessWidget {
  const _SavingsView({required this.result, required this.plan});

  final CompareResult result;
  final ComparePlan plan;

  @override
  Widget build(BuildContext context) {
    final r = result;
    var yours = 0, avg = 0, worst = 0;
    for (final l in plan.lines) {
      final row = r.row(l.key);
      yours += l.totalCents;
      avg += (row.average ?? l.unitCents) * l.qty;
      worst += (row.worst ?? l.unitCents) * l.qty;
    }
    final save = avg - yours;
    final pct = avg == 0 ? 0 : save * 100 / avg;
    final saveMax = worst - yours;

    Widget tile(IconData icon, String label, String value, {bool highlight = false}) => Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: highlight ? AppColors.successSoft : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: highlight ? AppColors.success : AppColors.line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: highlight ? AppColors.success : AppColors.primaryLight, size: 22),
            const SizedBox(height: 6),
            Text(label, style: const TextStyle(fontSize: 12, color: AppColors.inkMuted)),
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                value,
                style: TextStyle(
                  fontFamily: 'Montserrat',
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                  color: highlight ? AppColors.success : AppColors.ink,
                ),
              ),
            ),
          ],
        ),
      ),
    );

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(gradient: AppColors.headerGradient, borderRadius: BorderRadius.circular(20)),
          child: Row(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(color: AppColors.accent, borderRadius: BorderRadius.circular(16)),
                child: const Icon(Icons.savings_rounded, color: AppColors.onAccent, size: 30),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Você economiza', style: TextStyle(color: Colors.white70)),
                    Text(
                      save > 0 ? money(save) : money(0),
                      style: const TextStyle(
                        fontFamily: 'Montserrat',
                        fontWeight: FontWeight.w800,
                        fontSize: 28,
                        color: AppColors.accent,
                      ),
                    ),
                    Text(
                      save > 0
                          ? '${pct.toStringAsFixed(1).replaceAll('.', ',')}% abaixo do preço médio da região'
                          : 'Seus preços estão na média da região',
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            tile(Icons.shopping_cart_checkout_rounded, 'Seu total (produtos)', money(yours), highlight: true),
            const SizedBox(width: 8),
            tile(Icons.bar_chart_rounded, 'No preço médio', money(avg)),
            const SizedBox(width: 8),
            tile(Icons.trending_up_rounded, 'No preço mais alto', money(worst)),
          ],
        ),
        if (saveMax > save && saveMax > 0)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              'Comparado ao mercado mais caro de cada item, a diferença chega a ${money(saveMax)}.',
              style: const TextStyle(fontSize: 12.5, color: AppColors.inkMuted),
            ),
          ),
        const SizedBox(height: 16),
        const Text(
          'Por produto',
          style: TextStyle(fontFamily: 'Montserrat', fontWeight: FontWeight.w800, fontSize: 17, color: AppColors.ink),
        ),
        const SizedBox(height: 8),
        for (final l in plan.lines) _SavingRow(row: r.row(l.key), line: l, marketName: r.market(l.marketId).name),
        const SizedBox(height: 8),
        const Text(
          'Economia calculada sobre os preços dos mercados abertos que entregam no seu endereço, sem contar a taxa de entrega.',
          style: TextStyle(fontSize: 12, color: AppColors.inkMuted),
        ),
      ],
    );
  }
}

class _SavingRow extends StatelessWidget {
  const _SavingRow({required this.row, required this.line, required this.marketName});

  final CompareRow row;
  final CompareLine line;
  final String marketName;

  @override
  Widget build(BuildContext context) {
    final avg = row.average ?? line.unitCents;
    final worst = row.worst ?? line.unitCents;
    final save = (avg - line.unitCents) * line.qty;
    Widget col(String label, String value, {Color color = AppColors.ink}) => Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.inkMuted)),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              value,
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: color),
            ),
          ),
        ],
      ),
    );
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              Row(
                children: [
                  SizedBox(
                    width: 36,
                    height: 36,
                    child: AppImage(
                      row.imageUrl,
                      fit: BoxFit.contain,
                      fallback: const Icon(Icons.shopping_basket_outlined, color: AppColors.primaryLight, size: 20),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${line.qty}× ${row.name} · ${row.unit}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink),
                        ),
                        Text(marketName, style: const TextStyle(fontSize: 12, color: AppColors.primaryLight)),
                      ],
                    ),
                  ),
                  Text(
                    save > 0 ? '-${money(save)}' : money(0),
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      color: save > 0 ? AppColors.success : AppColors.inkMuted,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  col('Seu preço', money(line.unitCents), color: AppColors.success),
                  col('Médio', money(avg)),
                  col('Mais alto', money(worst)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MinItems extends StatelessWidget {
  const _MinItems({required this.count, required this.min});

  final int count;
  final int min;

  @override
  Widget build(BuildContext context) {
    final ok = count >= min;
    return Row(
      children: [
        SizedBox(
          width: 70,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: (count / min).clamp(0, 1).toDouble(),
              minHeight: 6,
              color: ok ? AppColors.success : AppColors.warning,
              backgroundColor: AppColors.line,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Icon(
          ok ? Icons.check_circle_rounded : Icons.error_outline_rounded,
          size: 16,
          color: ok ? AppColors.success : AppColors.warning,
        ),
        const SizedBox(width: 4),
        Flexible(
          child: Text(
            ok ? '$count itens · mínimo de $min atendido' : '$count de $min itens',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: ok ? AppColors.success : AppColors.warning,
            ),
          ),
        ),
      ],
    );
  }
}

/// Rota de entrega: ordem de coleta nos mercados e o trecho final até a casa.
class _RouteCard extends StatelessWidget {
  const _RouteCard({required this.result, required this.plan});

  final CompareResult result;
  final ComparePlan plan;

  @override
  Widget build(BuildContext context) {
    final route = plan.route!;
    final stops = [for (final id in route.order) result.market(id).name, 'Sua casa'];
    Widget dot(String label, bool home) => Container(
      width: 30,
      height: 30,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: home ? AppColors.primaryLight : AppColors.success, shape: BoxShape.circle),
      child: home
          ? const Icon(Icons.home_rounded, color: Colors.white, size: 18)
          : Text(
              label,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
            ),
    );
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.route_rounded, color: AppColors.primary),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text(
                    'Rota da entrega',
                    style: TextStyle(
                      fontFamily: 'Montserrat',
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
                      color: AppColors.ink,
                    ),
                  ),
                ),
                Text(
                  '${km(route.totalKm)} km · ~${route.minutes} min',
                  style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.primary),
                ),
              ],
            ),
            const SizedBox(height: 12),
            for (var i = 0; i < stops.length; i++)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Column(
                    children: [
                      dot('${i + 1}', i == stops.length - 1),
                      if (i < stops.length - 1) Container(width: 3, height: 26, color: AppColors.line),
                    ],
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 5),
                      child: Text(
                        i == stops.length - 1 ? stops[i] : 'Coleta: ${stops[i]}',
                        style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink),
                      ),
                    ),
                  ),
                  if (i > 0)
                    Padding(
                      padding: const EdgeInsets.only(top: 5),
                      child: Text(
                        '+${distance(route.legsKm[i - 1])}',
                        style: const TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
                      ),
                    ),
                ],
              ),
            const SizedBox(height: 6),
            const Text(
              'Um só entregador faz a rota: os mercados deixam o pedido pronto antes da chegada.',
              style: TextStyle(fontSize: 12, color: AppColors.inkMuted),
            ),
          ],
        ),
      ),
    );
  }
}

/// Escolha manual de até 3 mercados para a comparação.
class _MarketPicker extends StatefulWidget {
  const _MarketPicker({required this.markets, required this.initial});

  final List<Market> markets;
  final List<String> initial;

  @override
  State<_MarketPicker> createState() => _MarketPickerState();
}

class _MarketPickerState extends State<_MarketPicker> {
  late final _sel = [...widget.initial];

  @override
  Widget build(BuildContext context) => SafeArea(
    child: Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Escolha até $maxMarkets mercados',
            style: const TextStyle(
              fontFamily: 'Montserrat',
              fontWeight: FontWeight.w800,
              fontSize: 18,
              color: AppColors.ink,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            _sel.isEmpty
                ? 'Sem escolha, o EconoRota usa os mais vantajosos.'
                : '${_sel.length} de $maxMarkets selecionados',
            style: const TextStyle(color: AppColors.inkMuted),
          ),
          const SizedBox(height: 8),
          Flexible(
            child: ListView(
              shrinkWrap: true,
              children: [
                for (final m in widget.markets)
                  CheckboxListTile(
                    value: _sel.contains(m.id),
                    activeColor: AppColors.primary,
                    onChanged: !_sel.contains(m.id) && _sel.length >= maxMarkets
                        ? null
                        : (v) => setState(() => v == true ? _sel.add(m.id) : _sel.remove(m.id)),
                    title: Text(
                      m.name,
                      style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink),
                    ),
                    subtitle: Text(
                      [if (m.distanceKm != null) distance(m.distanceKm!), m.eta].join(' · '),
                      style: const TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context, <String>[]),
                  child: const Text('Automático'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  onPressed: () => Navigator.pop(context, _sel),
                  style: FilledButton.styleFrom(backgroundColor: AppColors.success),
                  child: const Text('Comparar'),
                ),
              ),
            ],
          ),
        ],
      ),
    ),
  );
}

class _Kv extends StatelessWidget {
  const _Kv(this.label, this.value, {this.bold = false});

  final String label;
  final String value;
  final bool bold;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 2),
    child: Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              color: bold ? AppColors.ink : AppColors.inkMuted,
              fontWeight: bold ? FontWeight.w800 : FontWeight.w400,
            ),
          ),
        ),
        Text(
          value,
          style: TextStyle(color: AppColors.ink, fontWeight: bold ? FontWeight.w800 : FontWeight.w600),
        ),
      ],
    ),
  );
}

/// "Se comprasse tudo em um só mercado" → "Com o EconoRota" → economia.
class _VsSingle extends StatelessWidget {
  const _VsSingle({required this.single, required this.plan});

  final ComparePlan single;
  final ComparePlan plan;

  @override
  Widget build(BuildContext context) {
    final save = single.totalCents - plan.totalCents;
    final pct = save * 100 / single.totalCents;
    Widget box(String label, String value, Color bg, Color fg) => Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: TextStyle(fontSize: 12, color: fg.withValues(alpha: .8))),
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                value,
                style: TextStyle(fontFamily: 'Montserrat', fontWeight: FontWeight.w800, fontSize: 18, color: fg),
              ),
            ),
          ],
        ),
      ),
    );
    return Column(
      children: [
        Row(
          children: [
            box('Tudo em um só mercado', money(single.totalCents), Colors.white, AppColors.inkMuted),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 6),
              child: Icon(Icons.arrow_forward_rounded, color: AppColors.primary),
            ),
            box('Com o EconoRota', money(plan.totalCents), AppColors.successSoft, AppColors.success),
          ],
        ),
        const SizedBox(height: 8),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(gradient: AppColors.headerGradient, borderRadius: BorderRadius.circular(14)),
          child: Row(
            children: [
              const Icon(Icons.savings_rounded, color: AppColors.accent),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Você economiza ${money(save)}',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: AppColors.accent, borderRadius: BorderRadius.circular(20)),
                child: Text(
                  '${pct.toStringAsFixed(0)}% de economia',
                  style: const TextStyle(color: AppColors.onAccent, fontWeight: FontWeight.w800, fontSize: 12),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Diferencial do EconoRota: quanto custaria (em dinheiro e tempo) ir às compras você mesmo.
/// Estimativa honesta: só fala em economia de dinheiro quando ela existe.
class _StayHome extends StatelessWidget {
  const _StayHome({required this.result, required this.plan});

  final CompareResult result;
  final ComparePlan plan;

  @override
  Widget build(BuildContext context) {
    // Indo você mesmo: o mercado único mais barato (ou o do plano), ida e volta.
    final self = result.single ?? plan;
    final km = self.marketIds.fold<double>(0, (s, id) => s + (result.market(id).distanceKm ?? 0)) * 2;
    final minutes = (km / avgSpeedKmh * 60).round() + shoppingMinutesPerMarket * self.marketIds.length;
    final tripCents = (km * tripCostPerKmCents).round();
    final selfTotal = self.itemsCents + tripCents;
    final saving = selfTotal - plan.totalCents;
    final productSaving = self.itemsCents - plan.itemsCents;

    Widget row(IconData icon, String label, String value) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.primary),
          const SizedBox(width: 8),
          Expanded(
            child: Text(label, style: const TextStyle(color: AppColors.ink, fontSize: 13.5)),
          ),
          Text(
            value,
            style: const TextStyle(color: AppColors.ink, fontWeight: FontWeight.w700, fontSize: 13.5),
          ),
        ],
      ),
    );

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.home_rounded, color: AppColors.primary),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Sem sair de casa',
                  style: TextStyle(
                    fontFamily: 'Montserrat',
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                    color: AppColors.ink,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Text('Se você fosse ao mercado:', style: TextStyle(color: AppColors.inkMuted, fontSize: 12.5)),
          const SizedBox(height: 4),
          row(Icons.schedule_rounded, 'Tempo (ida, compras, fila e volta)', '~${_duration(minutes)}'),
          row(
            Icons.local_gas_station_rounded,
            'Combustível ou condução (${km.toStringAsFixed(1).replaceAll('.', ',')} km)',
            '~${money(tripCents)}',
          ),
          if (productSaving > 0)
            row(Icons.sell_rounded, 'Produtos mais caros em um só mercado', '+${money(productSaving)}'),
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: AppColors.successSoft, borderRadius: BorderRadius.circular(12)),
            child: Text(
              saving > 0
                  ? 'Com o EconoRota você paga ~${money(saving)} a menos, ganha ~${_duration(minutes)} livres e recebe tudo na porta de casa.'
                  : 'Com o EconoRota você ganha ~${_duration(minutes)} livres, não pega fila nem carrega peso: recebe tudo na porta de casa.',
              style: const TextStyle(
                color: AppColors.success,
                fontWeight: FontWeight.w700,
                fontSize: 13.5,
                height: 1.35,
              ),
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Estimativa: carro a ~R\$ 1,00/km e 25 min de compras por mercado.',
            style: TextStyle(color: AppColors.inkMuted, fontSize: 11.5),
          ),
        ],
      ),
    );
  }

  static String _duration(int min) => min < 60 ? '$min min' : '${min ~/ 60}h${(min % 60).toString().padLeft(2, '0')}';
}
