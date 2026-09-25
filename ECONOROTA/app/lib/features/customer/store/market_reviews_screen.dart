import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../data/models/store.dart';
import '../../../data/repositories/store_repository.dart';
import '../../../widgets/brand_header.dart';
import '../../../widgets/skeleton.dart';
import '../widgets/common.dart';

/// Avaliação do mercado: nota média, distribuição por estrelas e comentários.
class MarketReviewsScreen extends StatefulWidget {
  const MarketReviewsScreen({super.key, required this.marketId, this.marketName});

  final String marketId;
  final String? marketName;

  @override
  State<MarketReviewsScreen> createState() => _MarketReviewsScreenState();
}

class _MarketReviewsScreenState extends State<MarketReviewsScreen> {
  ReviewPage? _page;
  final List<Review> _items = [];
  bool _loadingMore = false;
  int? _stars;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _error = null;
      _page = null;
      _items.clear();
    });
    try {
      final p = await context.read<StoreRepository>().reviews(widget.marketId, stars: _stars);
      if (!mounted) return;
      setState(() {
        _page = p;
        _items.addAll(p.items);
      });
    } catch (_) {
      if (mounted) setState(() => _error = 'Não foi possível carregar as avaliações.');
    }
  }

  Future<void> _more() async {
    final next = _page?.nextOffset;
    if (next == null || _loadingMore) return;
    setState(() => _loadingMore = true);
    try {
      final p = await context.read<StoreRepository>().reviews(widget.marketId, offset: next, stars: _stars);
      if (!mounted) return;
      setState(() {
        _page = ReviewPage(
          average: _page!.average,
          count: _page!.count,
          byStar: _page!.byStar,
          items: _items,
          nextOffset: p.nextOffset,
        );
        _items.addAll(p.items);
      });
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = _page;
    return BrandScaffold(
      showBack: true,
      title: 'Avaliações',
      subtitle: widget.marketName,
      slivers: [
        if (_error != null)
          SliverToBoxAdapter(
            child: RetryBox(message: _error!, onRetry: _load),
          ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: p == null ? const Skeleton(height: 150, radius: 18) : _Summary(page: p),
          ),
        ),
        if (p != null && p.count > 0)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: ChoiceChips<int?>(
                values: const [null, 5, 4, 3, 2, 1],
                selected: _stars,
                label: (s) =>
                    s == null ? 'Todas (${p.count})' : '$s ${s == 1 ? 'estrela' : 'estrelas'} (${p.byStar[s] ?? 0})',
                onSelected: (s) {
                  _stars = s;
                  _load();
                },
              ),
            ),
          ),
        if (p != null && _items.isEmpty)
          const SliverToBoxAdapter(
            child: LightEmpty(
              icon: Icons.reviews_outlined,
              title: 'Ainda sem avaliações',
              message: 'As avaliações aparecem aqui depois das primeiras entregas.',
            ),
          ),
        SliverList.separated(
          itemCount: _items.length,
          separatorBuilder: (_, _) => const SizedBox(height: 10),
          itemBuilder: (_, i) => Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: _ReviewCard(review: _items[i]),
          ),
        ),
        if (p?.nextOffset != null)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: OutlinedButton(onPressed: _loadingMore ? null : _more, child: const Text('Ver mais avaliações')),
            ),
          ),
      ],
    );
  }
}

class Stars extends StatelessWidget {
  const Stars({super.key, required this.value, this.size = 18});

  final double value;
  final double size;

  @override
  Widget build(BuildContext context) => Semantics(
    label: '${value.toStringAsFixed(1)} de 5 estrelas',
    excludeSemantics: true,
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 1; i <= 5; i++)
          Icon(
            value >= i ? Icons.star_rounded : (value >= i - .5 ? Icons.star_half_rounded : Icons.star_outline_rounded),
            color: const Color(0xFFF5B301),
            size: size,
          ),
      ],
    ),
  );
}

class _Summary extends StatelessWidget {
  const _Summary({required this.page});

  final ReviewPage page;

  @override
  Widget build(BuildContext context) {
    final avg = page.average;
    int pct(int s) => page.count == 0 ? 0 : ((page.byStar[s] ?? 0) * 100 / page.count).round();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            SizedBox(
              width: 116,
              child: Column(
                children: [
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      avg == null ? '–' : avg.toStringAsFixed(1).replaceAll('.', ','),
                      style: const TextStyle(
                        fontFamily: 'Montserrat',
                        fontWeight: FontWeight.w800,
                        fontSize: 40,
                        color: AppColors.ink,
                      ),
                    ),
                  ),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Stars(value: avg ?? 0),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Baseado em ${page.count} avaliações',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 12, color: AppColors.inkMuted),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                children: [
                  for (var s = 5; s >= 1; s--)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2),
                      child: Row(
                        children: [
                          SizedBox(
                            width: 14,
                            child: Text('$s', style: const TextStyle(fontSize: 12.5, color: AppColors.ink)),
                          ),
                          const Icon(Icons.star_rounded, size: 14, color: Color(0xFFF5B301)),
                          const SizedBox(width: 6),
                          Expanded(
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: LinearProgressIndicator(
                                value: pct(s) / 100,
                                minHeight: 8,
                                color: const Color(0xFFF5B301),
                                backgroundColor: AppColors.line,
                              ),
                            ),
                          ),
                          SizedBox(
                            width: 40,
                            child: FittedBox(
                              fit: BoxFit.scaleDown,
                              alignment: Alignment.centerRight,
                              child: Text(
                                '${pct(s)}%',
                                style: const TextStyle(fontSize: 12.5, color: AppColors.inkMuted),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReviewCard extends StatelessWidget {
  const _ReviewCard({required this.review});

  final Review review;

  @override
  Widget build(BuildContext context) {
    final r = review;
    final d = r.createdAt;
    final date = '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 18,
                  backgroundColor: AppColors.brandSoft,
                  child: Text(
                    r.author[0],
                    style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w800),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        r.author,
                        style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink),
                      ),
                      Text(date, style: const TextStyle(fontSize: 12, color: AppColors.inkMuted)),
                    ],
                  ),
                ),
                Stars(value: r.rating.toDouble(), size: 16),
              ],
            ),
            if (r.comment?.isNotEmpty ?? false) ...[
              const SizedBox(height: 10),
              Text(r.comment!, style: const TextStyle(color: AppColors.ink, height: 1.4)),
            ],
          ],
        ),
      ),
    );
  }
}
