import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../data/models/store.dart';
import '../../../data/repositories/store_repository.dart';
import '../../../widgets/brand_header.dart';
import '../../../widgets/category_icon.dart';
import '../../../widgets/skeleton.dart';
import '../widgets/common.dart';

/// Categorias vendidas por um mercado, com quantidade de produtos e ofertas.
class MarketCategoriesScreen extends StatefulWidget {
  const MarketCategoriesScreen({super.key, required this.marketId, this.marketName});

  final String marketId;
  final String? marketName;

  @override
  State<MarketCategoriesScreen> createState() => _MarketCategoriesScreenState();
}

class _MarketCategoriesScreenState extends State<MarketCategoriesScreen> {
  List<StoreCategory>? _items;
  String _filter = '';
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final d = await context.read<StoreRepository>().market(widget.marketId);
      if (mounted) setState(() => _items = d.categories);
    } catch (_) {
      if (mounted) setState(() => _error = 'Não foi possível carregar as categorias.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final f = _filter.trim().toLowerCase();
    final list = _items?.where((c) => f.isEmpty || c.category.name.toLowerCase().contains(f)).toList();
    return BrandScaffold(
      showBack: true,
      title: 'Categorias da loja',
      subtitle: widget.marketName ?? 'Encontre tudo o que você precisa.',
      search: HeaderSearchField(hint: 'Buscar categoria', onChanged: (v) => setState(() => _filter = v)),
      slivers: [
        if (_error != null)
          SliverToBoxAdapter(
            child: RetryBox(message: _error!, onRetry: _load),
          ),
        if (list != null && list.isEmpty)
          const SliverToBoxAdapter(
            child: LightEmpty(icon: Icons.search_off_rounded, title: 'Nenhuma categoria encontrada'),
          ),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
              maxCrossAxisExtent: 220,
              mainAxisExtent: 112,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
            ),
            delegate: SliverChildBuilderDelegate(
              (_, i) => list == null
                  ? const Skeleton(height: 112, radius: 18)
                  : _Tile(
                      item: list[i],
                      onTap: () => context.push(
                        Uri(
                          path: '/cliente/mercado/${widget.marketId}/produtos',
                          queryParameters: {'mercado': widget.marketName ?? '', 'categoria': list[i].category.id},
                        ).toString(),
                      ),
                    ),
              childCount: list?.length ?? 6,
            ),
          ),
        ),
      ],
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.item, required this.onTap});

  final StoreCategory item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = item.category;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(color: c.color, borderRadius: BorderRadius.circular(14)),
                child: Icon(categoryIcon(c.id), color: Colors.white, size: 22),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      c.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontFamily: 'Montserrat',
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                        color: AppColors.ink,
                      ),
                    ),
                    Text(
                      '${item.count} ${item.count == 1 ? 'produto' : 'produtos'}',
                      style: const TextStyle(fontSize: 12.5, color: AppColors.inkMuted),
                    ),
                    if (item.onSale > 0)
                      Text(
                        '${item.onSale} em oferta',
                        style: const TextStyle(fontSize: 12.5, color: AppColors.discount, fontWeight: FontWeight.w700),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
