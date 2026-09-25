import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../data/models/catalog.dart';
import '../../data/repositories/catalog_repository.dart';
import '../../state/search_history.dart';
import '../../widgets/brand_header.dart';
import '../../widgets/category_icon.dart';
import '../../widgets/section_title.dart';
import '../../widgets/sort_sheet.dart';
import 'widgets/common.dart';

/// Busca de produtos (aba Buscar), lista de uma categoria ([categoryId]) e produtos de uma loja ([marketId]).
class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key, this.categoryId, this.marketId, this.marketName});

  final String? categoryId;
  final String? marketId;
  final String? marketName;

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _text = TextEditingController();
  final _focus = FocusNode();
  final _scroll = ScrollController();
  Timer? _debounce;

  List<Category> _categories = const [];
  Suggestions _suggest = (terms: const <String>[], categories: const <Category>[]);
  final List<Product> _results = [];
  ProductSort _sort = ProductSort.relevance;
  List<String> _subs = const [];
  String? _sub;
  int? _next = 0;
  bool _loading = false;
  String? _error;
  int _generation = 0;

  bool get _categoryMode => widget.categoryId != null || widget.marketId != null;
  String get _query => _text.text.trim();
  bool get _hasQuery => _query.length >= 2 || _categoryMode;

  Category? get _category => _categories.where((c) => c.id == widget.categoryId).firstOrNull;

  @override
  void initState() {
    super.initState();
    if (_categoryMode) _sort = ProductSort.price;
    _scroll.addListener(() {
      if (_scroll.position.extentAfter < 600) _loadMore();
    });
    context.read<CatalogRepository>().categories().then((c) {
      if (mounted) setState(() => _categories = c);
    });
    if (widget.categoryId != null) {
      context.read<CatalogRepository>().subcategories(widget.categoryId!, marketId: widget.marketId).then((s) {
        if (mounted) setState(() => _subs = s);
      });
    }
    if (_categoryMode) _reset();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _text.dispose();
    _focus.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _onChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), _reset);
    setState(() {});
  }

  void _search(String term) {
    _text.text = term;
    _text.selection = TextSelection.collapsed(offset: term.length);
    _focus.unfocus();
    context.read<SearchHistory>().add(term);
    _reset();
  }

  Future<void> _reset() async {
    final gen = ++_generation;
    setState(() {
      _results.clear();
      _next = 0;
      _error = null;
    });
    if (!_hasQuery) return;
    if (!_categoryMode) {
      context.read<CatalogRepository>().suggest(_query).then((s) {
        if (mounted && gen == _generation) setState(() => _suggest = s);
      });
    }
    await _loadMore(gen);
  }

  Future<void> _loadMore([int? gen]) async {
    final g = gen ?? _generation;
    if (_loading || _next == null || !_hasQuery) return;
    setState(() => _loading = true);
    try {
      final page = await context.read<CatalogRepository>().products(
        ProductQuery(
          text: _categoryMode && _query.length < 2 ? null : _query,
          categoryId: widget.categoryId,
          marketId: widget.marketId,
          sub: _sub,
          sort: _sort,
          offset: _next!,
        ),
      );
      if (!mounted || g != _generation) return;
      setState(() {
        _results.addAll(page.items);
        _next = page.nextOffset;
      });
    } catch (_) {
      if (mounted && g == _generation) setState(() => _error = 'Não foi possível buscar agora. Tente novamente.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final history = context.watch<SearchHistory>();
    final title = !_categoryMode
        ? null
        : widget.marketName != null
        ? (widget.categoryId == null ? widget.marketName : '${_category?.name ?? 'Categoria'} · ${widget.marketName}')
        : (_category?.name ?? 'Categoria');

    return BrandScaffold(
      controller: _scroll,
      showBack: _categoryMode,
      title: title,
      subtitle: !_categoryMode
          ? null
          : widget.marketId != null
          ? 'Produtos desta loja.'
          : 'Os menores preços dos mercados perto de você.',
      search: HeaderSearchField(
        hint: _categoryMode ? 'Buscar em ${title ?? 'categoria'}...' : 'Buscar produtos, marcas...',
        controller: _text,
        focusNode: _focus,
        onChanged: _onChanged,
        onSubmitted: _search,
      ),
      slivers: [
        if (!_hasQuery) ...[
          if (history.items.isNotEmpty) ...[
            SliverToBoxAdapter(
              child: SectionTitle(
                'Buscas recentes',
                icon: Icons.history_rounded,
                iconColor: AppColors.inkMuted,
                trailing: TextButton(onPressed: history.clear, child: const Text('Limpar')),
              ),
            ),
            SliverToBoxAdapter(
              child: _Chips(items: history.items, onTap: _search, icon: Icons.history_rounded),
            ),
          ],
          const SliverToBoxAdapter(
            child: SectionTitle(
              'Explore por categoria',
              icon: Icons.grid_view_rounded,
              iconColor: AppColors.primaryLight,
            ),
          ),
          SliverToBoxAdapter(child: _CategoryRow(categories: _categories)),
          const SliverToBoxAdapter(
            child: LightEmpty(
              icon: Icons.search_rounded,
              title: 'O que você procura hoje?',
              message: 'Busque um produto e compare o preço em todos os mercados da sua região.',
            ),
          ),
        ] else ...[
          if (_subs.length > 1)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.only(top: 4),
                child: ChoiceChips<String?>(
                  values: [null, ..._subs],
                  selected: _sub,
                  label: (s) => s ?? 'Todos',
                  onSelected: (s) {
                    _sub = s;
                    _reset();
                  },
                ),
              ),
            ),
          if (!_categoryMode && _suggest.terms.isNotEmpty) ...[
            const SliverToBoxAdapter(
              child: SectionTitle('Sugestões de busca', icon: Icons.search_rounded, iconColor: AppColors.ink),
            ),
            SliverToBoxAdapter(
              child: _Chips(items: _suggest.terms, onTap: _search),
            ),
          ],
          if (!_categoryMode && _suggest.categories.isNotEmpty) ...[
            const SliverToBoxAdapter(
              child: SectionTitle(
                'Categorias relacionadas',
                icon: Icons.grid_view_rounded,
                iconColor: AppColors.primaryLight,
              ),
            ),
            SliverToBoxAdapter(child: _CategoryRow(categories: _suggest.categories)),
          ],
          SliverToBoxAdapter(
            child: SectionTitle(
              _categoryMode && _query.length < 2 ? (_sub ?? 'Produtos') : 'Resultados para “$_query”',
              trailing: SortButton<ProductSort>(
                value: _sort,
                options: ProductSort.values,
                label: (s) => s.label,
                onChanged: (s) {
                  _sort = s;
                  _reset();
                },
              ),
            ),
          ),
          if (_error != null)
            SliverToBoxAdapter(
              child: RetryBox(message: _error!, onRetry: _reset),
            ),
          if (!_loading && _results.isEmpty && _error == null)
            SliverToBoxAdapter(
              child: LightEmpty(
                icon: Icons.search_off_rounded,
                title: 'Nada encontrado',
                message: 'Tente outro nome, uma marca ou confira a ortografia.',
                action: _query.isEmpty
                    ? null
                    : TextButton(onPressed: () => _search(''), child: const Text('Limpar busca')),
              ),
            ),
          ProductGridSliver(products: _results, loading: _loading),
        ],
      ],
    );
  }
}

class _Chips extends StatelessWidget {
  const _Chips({required this.items, required this.onTap, this.icon});

  final List<String> items;
  final ValueChanged<String> onTap;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 42,
    child: ListView.separated(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(width: 8),
      itemBuilder: (_, i) => ActionChip(
        avatar: icon == null ? null : Icon(icon, size: 16, color: AppColors.inkMuted),
        label: Text(items[i]),
        onPressed: () => onTap(items[i]),
        backgroundColor: Colors.white,
        side: const BorderSide(color: AppColors.line),
        labelStyle: const TextStyle(color: AppColors.ink, fontWeight: FontWeight.w500),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      ),
    ),
  );
}

class _CategoryRow extends StatelessWidget {
  const _CategoryRow({required this.categories});

  final List<Category> categories;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 96,
    child: ListView.separated(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      itemCount: categories.length,
      separatorBuilder: (_, _) => const SizedBox(width: 2),
      itemBuilder: (_, i) => CategoryTile(
        category: categories[i],
        size: 56,
        onTap: () => context.push('/cliente/categoria/${categories[i].id}'),
      ),
    ),
  );
}
