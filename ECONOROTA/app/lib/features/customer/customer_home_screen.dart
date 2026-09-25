import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../data/models/catalog.dart';
import '../../data/repositories/catalog_repository.dart';
import '../../state/address_controller.dart';
import '../../state/cart_controller.dart';
import '../../widgets/brand_header.dart';
import '../../widgets/category_icon.dart';
import '../../widgets/market_card.dart';
import '../../widgets/promo_banner.dart';
import '../../widgets/section_title.dart';
import '../../widgets/skeleton.dart';
import 'promos.dart';
import 'widgets/common.dart';

class CustomerHomeScreen extends StatefulWidget {
  const CustomerHomeScreen({super.key});

  @override
  State<CustomerHomeScreen> createState() => _CustomerHomeScreenState();
}

class _CustomerHomeScreenState extends State<CustomerHomeScreen> {
  List<Category>? _categories;
  List<Product>? _offers;
  List<Market>? _markets;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final repo = context.read<CatalogRepository>();
    final a = context.read<AddressController>().current;
    setState(() => _error = null);
    try {
      final r = await (
        repo.categories(),
        repo.products(const ProductQuery(onSale: true, limit: 10)),
        repo.markets(lat: a?.lat, lng: a?.lng),
      ).wait;
      if (!mounted) return;
      setState(() {
        _categories = r.$1;
        _offers = r.$2.items;
        _markets = r.$3;
      });
    } catch (_) {
      if (mounted) setState(() => _error = 'Não foi possível carregar as ofertas. Verifique sua conexão.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return BrandScaffold(
      showAddress: true,
      onRefresh: _load,
      search: HeaderSearchField(hint: 'Buscar produtos, marcas...', onTap: () => context.go('/cliente/busca')),
      headerExtra: PromoCarousel(items: homePromos(context)),
      slivers: [
        if (_error != null)
          SliverToBoxAdapter(
            child: RetryBox(message: _error!, onRetry: _load),
          ),
        const SliverToBoxAdapter(child: _CompareCta()),
        SliverToBoxAdapter(child: _CategoryGrid(categories: _categories)),
        SliverToBoxAdapter(
          child: SectionTitle(
            'Ofertas para você',
            icon: Icons.local_fire_department_rounded,
            action: 'Ver todas',
            onAction: () => context.go('/cliente/ofertas'),
          ),
        ),
        SliverToBoxAdapter(child: ProductRail(products: _offers)),
        SliverToBoxAdapter(
          child: SectionTitle(
            'Mercados próximos',
            icon: Icons.storefront_rounded,
            iconColor: AppColors.primaryLight,
            action: 'Ver todos',
            onAction: () => context.push('/cliente/mercados'),
          ),
        ),
        SliverToBoxAdapter(
          child: SizedBox(
            height: 112,
            child: _markets != null && _markets!.isEmpty
                ? const Center(child: Text('Ainda não há mercados atendendo seu endereço.'))
                : ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: _markets?.length ?? 2,
                    separatorBuilder: (_, _) => const SizedBox(width: 12),
                    itemBuilder: (_, i) => _markets == null
                        ? const Skeleton(width: 280, height: 112, radius: 18)
                        : MarketCard(
                            market: _markets![i],
                            width: 290,
                            onTap: () => context.push('/cliente/mercado/${_markets![i].id}'),
                          ),
                  ),
          ),
        ),
      ],
    );
  }
}

class _CategoryGrid extends StatelessWidget {
  const _CategoryGrid({required this.categories});

  final List<Category>? categories;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, box) {
      final cols = (box.maxWidth / 86).floor().clamp(4, 8);
      final tile = (box.maxWidth - 16) / cols;
      final shown = categories?.take(cols * 2 - 1).toList();
      return Padding(
        padding: const EdgeInsets.fromLTRB(8, 4, 8, 0),
        child: Wrap(
          runSpacing: 12,
          children: [
            if (shown == null)
              for (var i = 0; i < cols * 2; i++)
                SizedBox(
                  width: tile,
                  child: const Center(child: Skeleton(width: 60, height: 60, radius: 18)),
                )
            else ...[
              for (final c in shown)
                SizedBox(
                  width: tile,
                  child: Center(
                    child: CategoryTile(category: c, size: 58, onTap: () => context.push('/cliente/categoria/${c.id}')),
                  ),
                ),
              SizedBox(
                width: tile,
                child: Center(
                  child: CategoryTile(
                    category: const Category(id: 'mais', name: 'Ver todas', icon: 'more', color: Color(0xFF9AA0BC)),
                    size: 58,
                    onTap: () => context.push('/cliente/categorias'),
                  ),
                ),
              ),
            ],
          ],
        ),
      );
    },
  );
}

/// Atalho principal: montar a lista e comparar entre mercados.
class _CompareCta extends StatelessWidget {
  const _CompareCta();

  @override
  Widget build(BuildContext context) {
    final count = context.select<CartController, int>((c) => c.items.length);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Material(
        color: AppColors.primary,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () => context.push(count == 0 ? '/cliente/selecionar' : '/cliente/comparar'),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              children: [
                Row(
                  children: [
                    Container(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(color: AppColors.accent, borderRadius: BorderRadius.circular(14)),
                      child: const Icon(Icons.compare_arrows_rounded, color: AppColors.onAccent),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            count == 0 ? 'Monte sua lista e economize' : 'Comparar minha lista ($count)',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16),
                          ),
                          const Text(
                            'Encontramos a combinação mais barata em até 3 mercados.',
                            style: TextStyle(color: Colors.white70, fontSize: 12.5),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right_rounded, color: Colors.white),
                  ],
                ),
                const SizedBox(height: 12),
                // Atalho: cole a lista e o EconoRota monta o carrinho.
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () => context.push('/cliente/lista-inteligente'),
                    icon: const Icon(Icons.auto_awesome_rounded),
                    label: const Text(
                      'Lista inteligente: digite ou cole sua lista',
                      style: TextStyle(fontWeight: FontWeight.w800),
                    ),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.accent,
                      foregroundColor: AppColors.onAccent,
                      minimumSize: const Size.fromHeight(46),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
