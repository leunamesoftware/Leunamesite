import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/compare/rules.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/errors.dart';
import '../../../core/utils/format.dart';
import '../../../data/models/catalog.dart';
import '../../../data/models/store.dart';
import '../../../data/repositories/catalog_repository.dart';
import '../../../data/repositories/store_repository.dart';
import '../../../state/address_controller.dart';
import '../../../widgets/app_image.dart';
import '../../../widgets/brand_header.dart';
import '../../../widgets/category_icon.dart';
import '../../../widgets/market_card.dart';
import '../../../widgets/section_title.dart';
import '../../../widgets/skeleton.dart';
import '../widgets/common.dart';

/// Loja de um mercado: capa, informações de entrega, categorias, ofertas e vitrines por categoria.
class MarketStoreScreen extends StatefulWidget {
  const MarketStoreScreen({super.key, required this.marketId});

  final String marketId;

  @override
  State<MarketStoreScreen> createState() => _MarketStoreScreenState();
}

class _MarketStoreScreenState extends State<MarketStoreScreen> {
  MarketDetails? _details;
  List<Product>? _offers;
  final Map<String, List<Product>> _shelves = {};
  String? _error;

  static const _shelfCount = 4;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final a = context.read<AddressController>().current;
    final store = context.read<StoreRepository>();
    final catalog = context.read<CatalogRepository>();
    setState(() => _error = null);
    try {
      final d = await store.market(widget.marketId, lat: a?.lat, lng: a?.lng);
      if (!mounted) return;
      setState(() => _details = d);
      final shelves = d.categories.take(_shelfCount).toList();
      final r = await Future.wait([
        catalog.products(ProductQuery(marketId: widget.marketId, onSale: true, limit: 10)),
        for (final s in shelves)
          catalog.products(ProductQuery(marketId: widget.marketId, categoryId: s.category.id, limit: 10)),
      ]);
      if (!mounted) return;
      setState(() {
        _offers = r.first.items;
        for (var i = 0; i < shelves.length; i++) {
          _shelves[shelves[i].category.id] = r[i + 1].items;
        }
      });
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    }
  }

  void _openProducts({String? categoryId}) {
    final q = {'mercado': _details?.market.name ?? '', 'categoria': ?categoryId};
    context.push(Uri(path: '/cliente/mercado/${widget.marketId}/produtos', queryParameters: q).toString());
  }

  @override
  Widget build(BuildContext context) {
    final d = _details;
    final m = d?.market;
    return Theme(
      data: AppTheme.light,
      child: Scaffold(
        backgroundColor: AppColors.sheet,
        body: RefreshIndicator(
          onRefresh: _load,
          color: AppColors.primary,
          child: CustomScrollView(
            slivers: [
              SliverAppBar(
                pinned: true,
                expandedHeight: 190,
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                leading: IconButton(
                  tooltip: 'Voltar',
                  onPressed: () => context.canPop() ? context.pop() : context.go('/cliente'),
                  icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
                ),
                title: Text(
                  m?.name ?? '',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
                ),
                actions: [
                  IconButton(
                    tooltip: 'Buscar nesta loja',
                    onPressed: m == null ? null : _openProducts,
                    icon: const Icon(Icons.search_rounded, color: Colors.white),
                  ),
                  const CartButton(),
                ],
                flexibleSpace: FlexibleSpaceBar(
                  collapseMode: CollapseMode.parallax,
                  background: Stack(
                    fit: StackFit.expand,
                    children: [
                      AppImage(m?.imageUrl, fallback: const ColoredBox(color: AppColors.primary)),
                      const DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [Color(0xCC14062B), Color(0x3314062B), Color(0xDD14062B)],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              if (_error != null)
                SliverToBoxAdapter(
                  child: RetryBox(message: _error!, onRetry: _load),
                )
              else ...[
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
                    child: m == null ? const Skeleton(height: 150, radius: 20) : _InfoCard(market: m),
                  ),
                ),
                if (d != null && d.categories.isNotEmpty) ...[
                  SliverToBoxAdapter(
                    child: SectionTitle(
                      'Categorias',
                      icon: Icons.grid_view_rounded,
                      iconColor: AppColors.primaryLight,
                      action: 'Ver todas',
                      onAction: () => context.push(
                        Uri(
                          path: '/cliente/mercado/${widget.marketId}/categorias',
                          queryParameters: {'mercado': m!.name},
                        ).toString(),
                      ),
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: SizedBox(
                      height: 96,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        itemCount: d.categories.length,
                        separatorBuilder: (_, _) => const SizedBox(width: 2),
                        itemBuilder: (_, i) => CategoryTile(
                          category: d.categories[i].category,
                          size: 56,
                          onTap: () => _openProducts(categoryId: d.categories[i].category.id),
                        ),
                      ),
                    ),
                  ),
                ],
                if (_offers == null || _offers!.isNotEmpty) ...[
                  const SliverToBoxAdapter(
                    child: SectionTitle('Ofertas desta loja', icon: Icons.local_fire_department_rounded),
                  ),
                  SliverToBoxAdapter(child: ProductRail(products: _offers)),
                ],
                if (d != null)
                  for (final s in d.categories.take(_shelfCount))
                    if (_shelves[s.category.id]?.isNotEmpty ?? true) ...[
                      SliverToBoxAdapter(
                        child: SectionTitle(
                          s.category.name,
                          icon: categoryIcon(s.category.id),
                          iconColor: s.category.color,
                          action: 'Ver todos',
                          onAction: () => _openProducts(categoryId: s.category.id),
                        ),
                      ),
                      SliverToBoxAdapter(child: ProductRail(products: _shelves[s.category.id])),
                    ],
                if (d != null)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 20, 16, 24),
                      child: OutlinedButton.icon(
                        onPressed: _openProducts,
                        icon: const Icon(Icons.storefront_rounded),
                        label: const Text('Ver todos os produtos da loja'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.primary,
                          minimumSize: const Size.fromHeight(50),
                          side: const BorderSide(color: AppColors.primary, width: 1.5),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                      ),
                    ),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.market});

  final Market market;

  @override
  Widget build(BuildContext context) {
    final m = market;
    Widget chip(IconData icon, String label, String value) => Expanded(
      child: Column(
        children: [
          Icon(icon, color: AppColors.primaryLight, size: 22),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(fontSize: 11.5, color: AppColors.inkMuted)),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              value,
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: AppColors.ink),
            ),
          ),
        ],
      ),
    );
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    m.name,
                    style: const TextStyle(
                      fontFamily: 'Montserrat',
                      fontWeight: FontWeight.w800,
                      fontSize: 20,
                      color: AppColors.ink,
                    ),
                  ),
                ),
                OpenBadge(market: m),
              ],
            ),
            const SizedBox(height: 4),
            InkWell(
              borderRadius: BorderRadius.circular(8),
              onTap: () => context.push(
                Uri(path: '/cliente/mercado/${m.id}/avaliacoes', queryParameters: {'mercado': m.name}).toString(),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    const Icon(Icons.star_rounded, color: Color(0xFFF5B301), size: 20),
                    const SizedBox(width: 4),
                    Text(
                      m.rating.toStringAsFixed(1).replaceAll('.', ','),
                      style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink),
                    ),
                    Flexible(
                      child: Text(
                        ' (${m.ratingCount})',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: AppColors.inkMuted),
                      ),
                    ),
                    const Icon(Icons.chevron_right_rounded, color: AppColors.inkMuted, size: 20),
                    const Spacer(),
                    if (m.distanceKm != null) ...[
                      const Icon(Icons.place_rounded, size: 16, color: AppColors.inkMuted),
                      Text(distance(m.distanceKm!), style: const TextStyle(color: AppColors.inkMuted)),
                    ],
                  ],
                ),
              ),
            ),
            if (!m.isOpen)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(top: 8),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: AppColors.dangerSoft, borderRadius: BorderRadius.circular(12)),
                child: Text(
                  'Fechado agora. Abre às ${m.opensAt}. Você já pode montar sua lista e comparar preços.',
                  style: const TextStyle(color: AppColors.discount, fontWeight: FontWeight.w600, fontSize: 13),
                ),
              ),
            const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Divider(height: 1)),
            Row(
              children: [
                chip(Icons.delivery_dining_rounded, 'Entrega', m.eta),
                chip(Icons.payments_outlined, 'Taxa', m.deliveryFeeCents == 0 ? 'Grátis' : money(m.deliveryFeeCents)),
                chip(Icons.shopping_bag_outlined, 'Mínimo', money(effectiveMinOrder(m.minOrderCents))),
                chip(Icons.schedule_rounded, 'Horário', '${m.opensAt}–${m.closesAt}'),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
