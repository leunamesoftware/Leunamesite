import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/config/env.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../data/mock/mock_data.dart';
import '../../data/models/catalog.dart';
import '../../data/repositories/catalog_repository.dart';
import '../../state/address_controller.dart';
import '../../widgets/brand_header.dart';
import '../../widgets/market_card.dart';
import 'widgets/common.dart';

/// Confirmação da localização com radar de proximidade dos mercados.
class CustomerLocationScreen extends StatefulWidget {
  const CustomerLocationScreen({super.key});

  @override
  State<CustomerLocationScreen> createState() => _CustomerLocationScreenState();
}

class _CustomerLocationScreenState extends State<CustomerLocationScreen> {
  List<Market>? _markets;

  @override
  void initState() {
    super.initState();
    final a = context.read<AddressController>().current;
    context
        .read<CatalogRepository>()
        .markets(lat: a?.lat, lng: a?.lng)
        .then(
          (m) {
            if (mounted) setState(() => _markets = m);
          },
          onError: (_) {
            if (mounted) setState(() => _markets = const []);
          },
        );
  }

  @override
  Widget build(BuildContext context) {
    final a = context.watch<AddressController>().current;
    final center = a?.lat != null ? (lat: a!.lat!, lng: a.lng!) : (Env.useMock ? MockData.center : null);

    return BrandScaffold(
      showBack: true,
      title: 'Sua localização',
      subtitle: 'Confira o endereço e os mercados que entregam aí.',
      headerExtra: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(12)),
                child: const Icon(Icons.location_on_rounded, color: AppColors.accent),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      a?.line1 ?? 'Nenhum endereço definido',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15.5, color: AppColors.ink),
                    ),
                    if (a != null)
                      Text(
                        a.line2,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 13, color: AppColors.inkMuted),
                      ),
                  ],
                ),
              ),
              TextButton(onPressed: () => context.push('/endereco'), child: const Text('Alterar')),
            ],
          ),
        ),
      ),
      bottom: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: FilledButton.icon(
            onPressed: () => context.canPop() ? context.pop() : context.go('/cliente'),
            icon: const Icon(Icons.check_rounded),
            label: const Text('Confirmar esta localização'),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.success,
              minimumSize: const Size.fromHeight(54),
              textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
          ),
        ),
      ),
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: center == null
                ? const LightEmpty(
                    icon: Icons.map_outlined,
                    title: 'Mapa indisponível para este endereço',
                    message:
                        'Use "Alterar" e escolha "Usar minha localização atual" para ver a distância dos mercados.',
                  )
                : Column(
                    children: [
                      _Radar(markets: _markets ?? const [], center: center),
                      const SizedBox(height: 8),
                      const Wrap(
                        alignment: WrapAlignment.center,
                        spacing: 14,
                        runSpacing: 4,
                        children: [
                          _Legend(color: AppColors.info, text: 'Você'),
                          _Legend(color: AppColors.success, text: 'Aberto'),
                          _Legend(color: AppColors.inkMuted, text: 'Fechado'),
                          Text(
                            'Toque no pino para ver o nome',
                            style: TextStyle(fontSize: 11.5, color: AppColors.inkMuted),
                          ),
                        ],
                      ),
                    ],
                  ),
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: 8)),
        SliverList.separated(
          itemCount: _markets?.length ?? 0,
          separatorBuilder: (_, _) => const SizedBox(height: 10),
          itemBuilder: (_, i) => Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: MarketCard(
              market: _markets![i],
              width: double.infinity,
              onTap: () => context.push('/cliente/mercado/${_markets![i].id}'),
            ),
          ),
        ),
      ],
    );
  }
}

class _Radar extends StatefulWidget {
  const _Radar({required this.markets, required this.center});

  final List<Market> markets;
  final ({double lat, double lng}) center;

  @override
  State<_Radar> createState() => _RadarState();
}

class _RadarState extends State<_Radar> with SingleTickerProviderStateMixin {
  late final _pulse = AnimationController(vsync: this, duration: const Duration(seconds: 2))..repeat();

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  /// Posição em km (x = leste, y = norte) em relação ao centro.
  Offset _km(Market m) {
    final c = widget.center;
    final x = (m.lng! - c.lng) * 111.32 * math.cos(c.lat * math.pi / 180);
    final y = (m.lat! - c.lat) * 110.57;
    return Offset(x, y);
  }

  @override
  Widget build(BuildContext context) {
    final placed = widget.markets.where((m) => m.lat != null && m.lng != null).toList();
    final maxKm = placed.fold<double>(1, (s, m) => math.max(s, _km(m).distance));
    final rangeKm = (maxKm * 1.15).ceilToDouble().clamp(1.0, 15.0);

    return Semantics(
      label: 'Mapa de proximidade: ${placed.length} mercados em até ${rangeKm.toStringAsFixed(0)} km',
      child: AspectRatio(
        aspectRatio: 1.15,
        child: LayoutBuilder(
          builder: (context, box) {
            final size = box.biggest;
            final radius = math.min(size.width, size.height) / 2 - 8;
            final center = Offset(size.width / 2, size.height / 2);
            Offset toPx(Offset km) => center + Offset(km.dx, -km.dy) * (radius / rangeKm);

            return ClipRRect(
              borderRadius: BorderRadius.circular(22),
              child: Stack(
                children: [
                  Positioned.fill(
                    child: AnimatedBuilder(
                      animation: _pulse,
                      builder: (_, _) => CustomPaint(
                        painter: _RadarPainter(rangeKm: rangeKm, pulse: _pulse.value),
                      ),
                    ),
                  ),
                  for (final m in placed) _Pin(market: m, at: toPx(_km(m))),
                  Positioned(
                    left: center.dx - 11,
                    top: center.dy - 11,
                    child: Container(
                      width: 22,
                      height: 22,
                      decoration: BoxDecoration(
                        color: AppColors.info,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 4),
                        boxShadow: const [BoxShadow(color: Color(0x552563EB), blurRadius: 10)],
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _Pin extends StatelessWidget {
  const _Pin({required this.market, required this.at});

  final Market market;
  final Offset at;

  @override
  Widget build(BuildContext context) {
    final color = market.isOpen ? AppColors.success : AppColors.inkMuted;
    final label = '${market.name}${market.distanceKm != null ? ' · ${distance(market.distanceKm!)}' : ''}';
    return Positioned(
      left: at.dx - 18,
      top: at.dy - 42,
      child: Tooltip(
        message: label,
        triggerMode: TooltipTriggerMode.tap,
        preferBelow: false,
        child: Semantics(
          label: label,
          child: Column(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: color,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 3),
                  boxShadow: const [BoxShadow(color: Color(0x33000000), blurRadius: 6, offset: Offset(0, 2))],
                ),
                child: const Icon(Icons.shopping_cart_rounded, color: Colors.white, size: 18),
              ),
              Container(width: 3, height: 6, color: color),
            ],
          ),
        ),
      ),
    );
  }
}

class _RadarPainter extends CustomPainter {
  _RadarPainter({required this.rangeKm, required this.pulse});

  final double rangeKm;
  final double pulse;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = math.min(size.width, size.height) / 2 - 8;
    canvas.drawRect(Offset.zero & size, Paint()..color = const Color(0xFFE9EEF9));

    // Malha de "quarteirões" discreta.
    final grid = Paint()
      ..color = Colors.white
      ..strokeWidth = 6;
    for (var x = -size.width; x < size.width * 2; x += 46) {
      canvas.drawLine(Offset(x, 0), Offset(x + size.height * .35, size.height), grid);
    }
    for (var y = 0.0; y < size.height; y += 52) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y - size.width * .12), grid..strokeWidth = 4);
    }

    // Anéis de distância.
    final step = rangeKm <= 2 ? .5 : (rangeKm <= 6 ? 1.0 : 2.0);
    final ring = Paint()
      ..style = PaintingStyle.stroke
      ..color = AppColors.info.withValues(alpha: .35)
      ..strokeWidth = 1.2;
    for (var k = step; k <= rangeKm + .001; k += step) {
      final rr = r * k / rangeKm;
      canvas.drawCircle(c, rr, ring);
      final tp = TextPainter(
        text: TextSpan(
          text: k < 1 ? '${(k * 1000).round()} m' : '${k.toStringAsFixed(k % 1 == 0 ? 0 : 1).replaceAll('.', ',')} km',
          style: const TextStyle(fontSize: 10, color: AppColors.info, fontWeight: FontWeight.w600),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, c + Offset(4, -rr - tp.height));
    }

    // Área de entrega e pulso da posição atual.
    canvas.drawCircle(c, r * .38, Paint()..color = AppColors.info.withValues(alpha: .10));
    canvas.drawCircle(c, 12 + 40 * pulse, Paint()..color = AppColors.info.withValues(alpha: .25 * (1 - pulse)));
  }

  @override
  bool shouldRepaint(_RadarPainter old) => old.pulse != pulse || old.rangeKm != rangeKm;
}

class _Legend extends StatelessWidget {
  const _Legend({required this.color, required this.text});

  final Color color;
  final String text;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      ),
      const SizedBox(width: 4),
      Text(text, style: const TextStyle(fontSize: 12, color: AppColors.ink)),
    ],
  );
}
