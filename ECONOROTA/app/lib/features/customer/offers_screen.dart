import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../data/models/catalog.dart';
import '../../data/repositories/catalog_repository.dart';
import '../../widgets/brand_header.dart';
import '../../widgets/promo_banner.dart';
import '../../widgets/section_title.dart';
import '../../widgets/sort_sheet.dart';
import 'widgets/common.dart';

/// Ofertas gerais (aba Ofertas) ou de uma loja ([marketId]).
class OffersScreen extends StatefulWidget {
  const OffersScreen({super.key, this.marketId, this.marketName});

  final String? marketId;
  final String? marketName;

  @override
  State<OffersScreen> createState() => _OffersScreenState();
}

class _OffersScreenState extends State<OffersScreen> {
  final _scroll = ScrollController();
  List<Category> _categories = const [];
  String? _category;
  ProductSort _sort = ProductSort.discount;
  List<Product>? _featured;
  final List<Product> _more = [];
  int? _next = 0;
  bool _loading = false;
  String? _error;
  int _gen = 0;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.extentAfter < 600) _loadMore();
    });
    context.read<CatalogRepository>().categories().then((c) {
      if (mounted) setState(() => _categories = c);
    });
    _reset();
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _reset() async {
    final gen = ++_gen;
    setState(() {
      _featured = null;
      _more.clear();
      _next = 0;
      _error = null;
    });
    try {
      final top = await context.read<CatalogRepository>().products(
        ProductQuery(
          onSale: true,
          marketId: widget.marketId,
          categoryId: _category,
          sort: ProductSort.discount,
          limit: 6,
        ),
      );
      if (!mounted || gen != _gen) return;
      setState(() => _featured = top.items);
      await _loadMore(gen);
    } catch (_) {
      if (mounted && gen == _gen) setState(() => _error = 'Não foi possível carregar as ofertas.');
    }
  }

  Future<void> _loadMore([int? gen]) async {
    final g = gen ?? _gen;
    if (_loading || _next == null) return;
    setState(() => _loading = true);
    try {
      final page = await context.read<CatalogRepository>().products(
        ProductQuery(onSale: true, marketId: widget.marketId, categoryId: _category, sort: _sort, offset: _next!),
      );
      if (!mounted || g != _gen) return;
      setState(() {
        _more.addAll(page.items);
        _next = page.nextOffset;
      });
    } catch (_) {
      if (mounted && g == _gen) setState(() => _error = 'Não foi possível carregar as ofertas.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final chips = [null, ..._categories.map((c) => c.id)];
    final names = {for (final c in _categories) c.id: c.name};
    final store = widget.marketId != null;
    final maxOff = _featured == null || _featured!.isEmpty ? null : _featured!.first.discountPct;
    return BrandScaffold(
      controller: _scroll,
      showBack: store,
      title: store ? 'Promoções' : 'Ofertas para você',
      subtitle: store ? widget.marketName : 'Os melhores preços dos mercados da sua região.',
      showAddress: !store,
      onRefresh: _reset,
      search: HeaderSearchField(
        hint: store ? 'Buscar nesta loja...' : 'Buscar ofertas, produtos ou marcas...',
        onTap: () => store
            ? context.push(
                Uri(
                  path: '/cliente/mercado/${widget.marketId}/produtos',
                  queryParameters: {'mercado': widget.marketName ?? ''},
                ).toString(),
              )
            : context.go('/cliente/busca'),
      ),
      headerExtra: PromoBanner(
        height: 150,
        promo: Promo(
          title: store ? 'Ofertas' : 'Ofertas',
          highlight: store ? 'imperdíveis' : 'todos os dias',
          text: maxOff != null && maxOff > 0
              ? 'Descontos de até $maxOff% ${store ? 'nesta loja' : 'perto de você'}.'
              : 'Preços atualizados pelos mercados parceiros.',
          image: 'assets/images/art/onboarding_cart.webp',
          colors: const [Color(0xFF0B5B34), Color(0xFF0A3A2A)],
        ),
      ),
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: 4),
            child: ChoiceChips<String?>(
              values: chips,
              selected: _category,
              label: (id) => id == null ? 'Todas' : names[id]!,
              onSelected: (id) {
                _category = id;
                _reset();
              },
            ),
          ),
        ),
        if (_error != null)
          SliverToBoxAdapter(
            child: RetryBox(message: _error!, onRetry: _reset),
          ),
        if (_featured == null || _featured!.isNotEmpty) ...[
          SliverToBoxAdapter(
            child: SectionTitle(
              widget.marketId != null ? 'Promoções em destaque' : 'Ofertas em destaque',
              icon: Icons.local_fire_department_rounded,
            ),
          ),
          SliverToBoxAdapter(child: ProductRail(products: _featured)),
        ],
        SliverToBoxAdapter(
          child: SectionTitle(
            'Mais ofertas',
            icon: Icons.sell_rounded,
            iconColor: AppColors.primaryLight,
            trailing: SortButton<ProductSort>(
              value: _sort,
              options: const [ProductSort.discount, ProductSort.price],
              label: (s) => s.label,
              onChanged: (s) {
                _sort = s;
                _reset();
              },
            ),
          ),
        ),
        if (!_loading && _more.isEmpty && _error == null)
          SliverToBoxAdapter(
            child: LightEmpty(
              icon: Icons.sell_outlined,
              title: 'Sem ofertas nesta categoria',
              message: 'Volte mais tarde: os mercados atualizam os preços todos os dias.',
              action: TextButton(
                onPressed: () {
                  _category = null;
                  _reset();
                },
                child: const Text('Ver todas as ofertas'),
              ),
            ),
          ),
        ProductGridSliver(products: _more, loading: _loading),
      ],
    );
  }
}
