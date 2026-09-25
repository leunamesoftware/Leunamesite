import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../data/models/catalog.dart';
import '../../data/repositories/catalog_repository.dart';
import '../../state/address_controller.dart';
import '../../widgets/brand_header.dart';
import '../../widgets/market_card.dart';
import '../../widgets/skeleton.dart';
import 'widgets/common.dart';

enum _Filter { all, open, distance, rating, fee }

extension on _Filter {
  String get label => switch (this) {
    _Filter.all => 'Todos',
    _Filter.open => 'Abertos agora',
    _Filter.distance => 'Mais perto',
    _Filter.rating => 'Melhor avaliação',
    _Filter.fee => 'Menor taxa',
  };
}

class MarketsScreen extends StatefulWidget {
  const MarketsScreen({super.key});

  @override
  State<MarketsScreen> createState() => _MarketsScreenState();
}

class _MarketsScreenState extends State<MarketsScreen> {
  _Filter _filter = _Filter.all;
  String _text = '';
  Timer? _debounce;
  List<Market>? _markets;
  String? _error;
  int _gen = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    final gen = ++_gen;
    final a = context.read<AddressController>().current;
    setState(() {
      _markets = null;
      _error = null;
    });
    try {
      final list = await context.read<CatalogRepository>().markets(
        lat: a?.lat,
        lng: a?.lng,
        text: _text,
        onlyOpen: _filter == _Filter.open,
        sort: switch (_filter) {
          _Filter.rating => MarketSort.rating,
          _Filter.fee => MarketSort.fee,
          _ => MarketSort.distance,
        },
      );
      if (mounted && gen == _gen) setState(() => _markets = list);
    } catch (_) {
      if (mounted && gen == _gen) setState(() => _error = 'Não foi possível carregar os mercados.');
    }
  }

  @override
  Widget build(BuildContext context) => BrandScaffold(
    showBack: true,
    title: 'Mercados próximos',
    subtitle: 'Os mercados que entregam no seu endereço.',
    showAddress: true,
    onRefresh: _load,
    search: HeaderSearchField(
      hint: 'Buscar mercados...',
      onChanged: (v) {
        _text = v;
        _debounce?.cancel();
        _debounce = Timer(const Duration(milliseconds: 300), _load);
      },
    ),
    slivers: [
      SliverToBoxAdapter(
        child: ChoiceChips<_Filter>(
          values: _Filter.values,
          selected: _filter,
          label: (f) => f.label,
          onSelected: (f) {
            setState(() => _filter = f);
            _load();
          },
        ),
      ),
      const SliverToBoxAdapter(child: SizedBox(height: 12)),
      if (_error != null)
        SliverToBoxAdapter(
          child: RetryBox(message: _error!, onRetry: _load),
        ),
      if (_markets != null && _markets!.isEmpty)
        const SliverToBoxAdapter(
          child: LightEmpty(
            icon: Icons.storefront_outlined,
            title: 'Nenhum mercado encontrado',
            message: 'Tente outro filtro ou confira seu endereço de entrega.',
          ),
        ),
      SliverList.separated(
        itemCount: _markets?.length ?? (_error == null ? 3 : 0),
        separatorBuilder: (_, _) => const SizedBox(height: 12),
        itemBuilder: (_, i) => Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: _markets == null
              ? const Skeleton(height: 170, radius: 18)
              : MarketListTile(market: _markets![i], onTap: () => context.push('/cliente/mercado/${_markets![i].id}')),
        ),
      ),
    ],
  );
}
