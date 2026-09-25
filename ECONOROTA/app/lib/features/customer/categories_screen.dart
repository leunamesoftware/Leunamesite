import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../data/models/catalog.dart';
import '../../data/repositories/catalog_repository.dart';
import '../../widgets/brand_header.dart';
import '../../widgets/category_icon.dart';
import '../../widgets/skeleton.dart';
import 'widgets/common.dart';

class CategoriesScreen extends StatefulWidget {
  const CategoriesScreen({super.key});

  @override
  State<CategoriesScreen> createState() => _CategoriesScreenState();
}

class _CategoriesScreenState extends State<CategoriesScreen> {
  List<Category>? _all;
  String _filter = '';
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = false);
    try {
      final c = await context.read<CatalogRepository>().categories();
      if (mounted) setState(() => _all = c);
    } catch (_) {
      if (mounted) setState(() => _error = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final f = _filter.trim().toLowerCase();
    final list = _all?.where((c) => f.isEmpty || c.name.toLowerCase().contains(f)).toList();
    return BrandScaffold(
      showBack: true,
      title: 'Categorias',
      subtitle: 'Escolha uma categoria e encontre os melhores preços.',
      search: HeaderSearchField(hint: 'Filtrar categorias...', onChanged: (v) => setState(() => _filter = v)),
      slivers: [
        if (_error)
          SliverToBoxAdapter(
            child: RetryBox(message: 'Não foi possível carregar as categorias.', onRetry: _load),
          ),
        if (list != null && list.isEmpty)
          const SliverToBoxAdapter(
            child: LightEmpty(icon: Icons.search_off_rounded, title: 'Nenhuma categoria encontrada'),
          ),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
              maxCrossAxisExtent: 200,
              mainAxisExtent: 120,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
            ),
            delegate: SliverChildBuilderDelegate(
              (_, i) => list == null
                  ? const Skeleton(height: 120, radius: 20)
                  : _CategoryCard(category: list[i], onTap: () => context.push('/cliente/categoria/${list[i].id}')),
              childCount: list?.length ?? 8,
            ),
          ),
        ),
      ],
    );
  }
}

class _CategoryCard extends StatelessWidget {
  const _CategoryCard({required this.category, required this.onTap});

  final Category category;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = category.color;
    return Semantics(
      button: true,
      label: category.name,
      excludeSemantics: true,
      child: Material(
        borderRadius: BorderRadius.circular(20),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Ink(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color.lerp(c, Colors.white, .15)!, c],
              ),
            ),
            child: Stack(
              children: [
                Positioned(
                  right: -14,
                  bottom: -18,
                  child: Icon(categoryIcon(category.id), size: 96, color: Colors.white.withValues(alpha: .22)),
                ),
                Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(color: Colors.white.withValues(alpha: .25), shape: BoxShape.circle),
                        child: Icon(categoryIcon(category.id), color: Colors.white, size: 22),
                      ),
                      const Spacer(),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              category.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontFamily: 'Montserrat',
                                fontWeight: FontWeight.w800,
                                fontSize: 16,
                                color: Colors.white,
                              ),
                            ),
                          ),
                          const Icon(Icons.chevron_right_rounded, color: Colors.white),
                        ],
                      ),
                    ],
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
