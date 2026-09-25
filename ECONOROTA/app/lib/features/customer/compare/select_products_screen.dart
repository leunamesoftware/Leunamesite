import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/format.dart';
import '../../../data/models/catalog.dart';
import '../../../data/models/compare.dart';
import '../../../data/repositories/catalog_repository.dart';
import '../../../data/repositories/compare_repository.dart';
import '../../../state/cart_controller.dart';
import '../../../widgets/app_image.dart';
import '../../../widgets/brand_header.dart';
import '../../../widgets/category_icon.dart';
import '../../../widgets/skeleton.dart';
import '../widgets/common.dart';

/// Seleção dos produtos para comparar (lista de compras sem escolher mercado).
class SelectProductsScreen extends StatefulWidget {
  const SelectProductsScreen({super.key});

  @override
  State<SelectProductsScreen> createState() => _SelectProductsScreenState();
}

class _SelectProductsScreenState extends State<SelectProductsScreen> {
  List<Category> _categories = const [];
  String? _category;
  String _text = '';
  Timer? _debounce;
  List<CatalogItem>? _items;
  String? _error;
  int _gen = 0;

  @override
  void initState() {
    super.initState();
    context.read<CatalogRepository>().categories().then((c) {
      if (mounted) setState(() => _categories = c);
    });
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    final gen = ++_gen;
    setState(() {
      _items = null;
      _error = null;
    });
    try {
      final r = await context.read<CompareRepository>().catalog(text: _text, categoryId: _category);
      if (mounted && gen == _gen) setState(() => _items = r);
    } catch (_) {
      if (mounted && gen == _gen) setState(() => _error = 'Não foi possível carregar os produtos.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartController>();
    final names = {for (final c in _categories) c.id: c.name};
    return BrandScaffold(
      showBack: true,
      title: 'Monte sua lista',
      subtitle: 'Escolha os produtos. O EconoRota encontra onde cada um está mais barato.',
      search: HeaderSearchField(
        hint: 'Buscar produtos...',
        onChanged: (v) {
          _text = v.trim();
          _debounce?.cancel();
          _debounce = Timer(const Duration(milliseconds: 300), _load);
        },
      ),
      bottom: cart.items.isEmpty ? null : _CompareBar(count: cart.items.length, estimate: cart.estimatedCents),
      slivers: [
        SliverToBoxAdapter(
          child: ChoiceChips<String?>(
            values: [null, ..._categories.map((c) => c.id)],
            selected: _category,
            label: (id) => id == null ? 'Todos' : names[id]!,
            onSelected: (id) {
              _category = id;
              _load();
            },
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: 12)),
        if (_error != null)
          SliverToBoxAdapter(
            child: RetryBox(message: _error!, onRetry: _load),
          ),
        if (_items != null && _items!.isEmpty)
          const SliverToBoxAdapter(
            child: LightEmpty(icon: Icons.search_off_rounded, title: 'Nenhum produto encontrado'),
          ),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
              maxCrossAxisExtent: 180,
              mainAxisExtent: 214,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
            ),
            delegate: SliverChildBuilderDelegate(
              (_, i) => _items == null
                  ? const Skeleton(height: 214, radius: 18)
                  : _SelectCard(
                      item: _items![i],
                      selected: cart.quantityOfKey(_items![i].key) > 0,
                      onTap: () => context.read<CartController>().toggleItem(_items![i]),
                    ),
              childCount: _items?.length ?? 6,
            ),
          ),
        ),
      ],
    );
  }
}

class _SelectCard extends StatelessWidget {
  const _SelectCard({required this.item, required this.selected, required this.onTap});

  final CatalogItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    checked: selected,
    label: '${item.name}, ${item.unit}, a partir de ${money(item.minPriceCents)}, em ${item.markets} mercados',
    excludeSemantics: true,
    child: Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: selected ? AppColors.success : AppColors.line, width: selected ? 2.5 : 1),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    AppImage(
                      item.imageUrl,
                      fit: BoxFit.contain,
                      fallback: Icon(
                        categoryIcon(item.categoryId),
                        size: 44,
                        color: AppColors.primaryLight.withValues(alpha: .5),
                      ),
                    ),
                    Positioned(
                      top: 0,
                      right: 0,
                      child: Icon(
                        selected ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
                        color: selected ? AppColors.success : AppColors.inkMuted,
                        size: 26,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 6),
              Text(
                item.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.ink),
              ),
              Text(item.unit, style: const TextStyle(fontSize: 12, color: AppColors.inkMuted)),
              const SizedBox(height: 2),
              Text.rich(
                TextSpan(
                  children: [
                    const TextSpan(
                      text: 'a partir de ',
                      style: TextStyle(fontSize: 11.5, color: AppColors.inkMuted),
                    ),
                    TextSpan(
                      text: money(item.minPriceCents),
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: AppColors.success),
                    ),
                  ],
                ),
              ),
              Text(
                '${item.markets} ${item.markets == 1 ? 'mercado' : 'mercados'}',
                style: const TextStyle(fontSize: 11.5, color: AppColors.primaryLight, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _CompareBar extends StatelessWidget {
  const _CompareBar({required this.count, required this.estimate});

  final int count;
  final int estimate;

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
                Text(
                  '$count ${count == 1 ? 'produto selecionado' : 'produtos selecionados'}',
                  style: const TextStyle(fontSize: 12.5, color: AppColors.inkMuted),
                ),
                Text(
                  'a partir de ${money(estimate)}',
                  style: const TextStyle(
                    fontFamily: 'Montserrat',
                    fontWeight: FontWeight.w800,
                    fontSize: 18,
                    color: AppColors.ink,
                  ),
                ),
              ],
            ),
          ),
          FilledButton.icon(
            onPressed: () => context.push('/cliente/comparar'),
            icon: const Icon(Icons.compare_arrows_rounded),
            label: const Text('Comparar preços', style: TextStyle(fontWeight: FontWeight.w800)),
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
