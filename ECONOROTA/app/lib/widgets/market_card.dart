import 'package:flutter/material.dart';

import '../core/compare/rules.dart';

import '../core/theme/app_colors.dart';
import '../core/utils/format.dart';
import '../data/models/catalog.dart';
import 'app_image.dart';

Widget _photo(Market m, double w, double h, [double radius = 14]) => ClipRRect(
  borderRadius: BorderRadius.circular(radius),
  child: SizedBox(
    width: w,
    height: h,
    child: ColorFiltered(
      colorFilter: m.isOpen
          ? const ColorFilter.mode(Colors.transparent, BlendMode.dst)
          : const ColorFilter.matrix([.33, .59, .11, 0, 0, .33, .59, .11, 0, 0, .33, .59, .11, 0, 0, 0, 0, 0, 1, 0]),
      child: AppImage(
        m.imageUrl,
        fallback: const ColoredBox(
          color: AppColors.primary,
          child: Center(child: Icon(Icons.storefront_rounded, color: AppColors.accent, size: 32)),
        ),
      ),
    ),
  ),
);

class OpenBadge extends StatelessWidget {
  const OpenBadge({super.key, required this.market});

  final Market market;

  @override
  Widget build(BuildContext context) {
    final open = market.isOpen;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: open ? AppColors.successSoft : AppColors.dangerSoft,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        open ? 'Aberto' : 'Fechado',
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: open ? AppColors.success : AppColors.discount,
        ),
      ),
    );
  }
}

class _Meta extends StatelessWidget {
  const _Meta(this.market);

  final Market market;

  @override
  Widget build(BuildContext context) {
    const style = TextStyle(fontSize: 13, color: AppColors.inkMuted);
    return Wrap(
      spacing: 10,
      runSpacing: 2,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.star_rounded, size: 16, color: Color(0xFFF5B301)),
            const SizedBox(width: 2),
            Text(
              '${market.rating.toStringAsFixed(1).replaceAll('.', ',')} (${market.ratingCount})',
              style: style.copyWith(color: AppColors.ink, fontWeight: FontWeight.w600),
            ),
          ],
        ),
        if (market.distanceKm != null)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.place_rounded, size: 15, color: AppColors.inkMuted),
              const SizedBox(width: 2),
              Text(distance(market.distanceKm!), style: style),
            ],
          ),
      ],
    );
  }
}

/// Card compacto para listas horizontais (home).
class MarketCard extends StatelessWidget {
  const MarketCard({super.key, required this.market, this.onTap, this.width = 250});

  final Market market;
  final VoidCallback? onTap;
  final double width;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: width,
    child: Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            children: [
              _photo(market, 84, 84),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            market.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontFamily: 'Montserrat',
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                              color: AppColors.ink,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        OpenBadge(market: market),
                      ],
                    ),
                    const SizedBox(height: 6),
                    _Meta(market),
                    const SizedBox(height: 4),
                    _Eta(market),
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

class _Eta extends StatelessWidget {
  const _Eta(this.market);

  final Market market;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(market.isOpen ? Icons.delivery_dining_rounded : Icons.schedule_rounded, size: 16, color: AppColors.inkMuted),
      const SizedBox(width: 4),
      Flexible(
        child: Text(
          market.isOpen ? market.eta : 'Abre às ${market.opensAt}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 12.5, color: AppColors.inkMuted),
        ),
      ),
    ],
  );
}

/// Linha completa da lista de mercados (taxa, pedido mínimo e ação).
class MarketListTile extends StatelessWidget {
  const MarketListTile({super.key, required this.market, this.onTap});

  final Market market;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final m = market;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _photo(m, 104, 88),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                m.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontFamily: 'Montserrat',
                                  fontWeight: FontWeight.w800,
                                  fontSize: 16,
                                  color: AppColors.ink,
                                ),
                              ),
                            ),
                            OpenBadge(market: m),
                          ],
                        ),
                        const SizedBox(height: 6),
                        _Meta(m),
                        const SizedBox(height: 4),
                        _Eta(m),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              const Divider(height: 1),
              const SizedBox(height: 10),
              Row(
                children: [
                  Flexible(
                    child: _Info(
                      icon: Icons.delivery_dining_rounded,
                      label: 'Entrega',
                      value: m.deliveryFeeCents == 0 ? 'Grátis' : money(m.deliveryFeeCents),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Flexible(
                    child: _Info(
                      icon: Icons.shopping_bag_outlined,
                      label: 'Mínimo',
                      value: money(effectiveMinOrder(m.minOrderCents)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Spacer(),
                  FilledButton(
                    onPressed: onTap,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      minimumSize: const Size(0, 40),
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('Ver loja', style: TextStyle(fontWeight: FontWeight.w700)),
                        Icon(Icons.chevron_right_rounded, size: 20),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Info extends StatelessWidget {
  const _Info({required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: const TextStyle(fontSize: 11.5, color: AppColors.inkMuted)),
      Text(
        value,
        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.ink),
      ),
    ],
  );
}
