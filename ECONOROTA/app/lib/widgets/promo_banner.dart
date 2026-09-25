import 'dart:async';

import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';

class Promo {
  const Promo({
    required this.title,
    required this.highlight,
    required this.text,
    required this.image,
    required this.colors,
    this.onTap,
  });

  final String title;
  final String highlight;
  final String text;
  final String image;
  final List<Color> colors;
  final VoidCallback? onTap;
}

/// Carrossel de destaques com troca automática (pausa ao tocar).
class PromoCarousel extends StatefulWidget {
  const PromoCarousel({super.key, required this.items, this.height = 168});

  final List<Promo> items;
  final double height;

  @override
  State<PromoCarousel> createState() => _PromoCarouselState();
}

class _PromoCarouselState extends State<PromoCarousel> {
  final _page = PageController(viewportFraction: .92);
  Timer? _timer;
  int _index = 0;

  @override
  void initState() {
    super.initState();
    _start();
  }

  void _start() {
    _timer?.cancel();
    if (widget.items.length < 2) return;
    _timer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!_page.hasClients) return;
      final next = (_index + 1) % widget.items.length;
      _page.animateToPage(next, duration: const Duration(milliseconds: 450), curve: Curves.easeOutCubic);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _page.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      SizedBox(
        height: widget.height,
        child: Listener(
          onPointerDown: (_) => _timer?.cancel(),
          onPointerUp: (_) => _start(),
          child: PageView.builder(
            controller: _page,
            itemCount: widget.items.length,
            onPageChanged: (i) => setState(() => _index = i),
            itemBuilder: (_, i) => Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: PromoBanner(promo: widget.items[i]),
            ),
          ),
        ),
      ),
      if (widget.items.length > 1) ...[
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (var i = 0; i < widget.items.length; i++)
              AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: i == _index ? 20 : 7,
                height: 7,
                decoration: BoxDecoration(
                  color: i == _index ? AppColors.accent : Colors.white.withValues(alpha: .35),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
          ],
        ),
      ],
    ],
  );
}

class PromoBanner extends StatelessWidget {
  const PromoBanner({super.key, required this.promo, this.height});

  final Promo promo;
  final double? height;

  @override
  Widget build(BuildContext context) => Semantics(
    button: promo.onTap != null,
    label: '${promo.title} ${promo.highlight}. ${promo.text}',
    excludeSemantics: true,
    child: Material(
      borderRadius: BorderRadius.circular(22),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: promo.onTap,
        child: Container(
          height: height,
          decoration: BoxDecoration(
            gradient: LinearGradient(colors: promo.colors, begin: Alignment.centerLeft, end: Alignment.centerRight),
          ),
          child: Stack(
            children: [
              Positioned(
                right: 0,
                top: 0,
                bottom: 0,
                width: 210,
                child: ShaderMask(
                  blendMode: BlendMode.dstIn,
                  shaderCallback: (r) =>
                      const LinearGradient(colors: [Colors.transparent, Colors.black], stops: [0, .35]).createShader(r),
                  child: Image.asset(promo.image, fit: BoxFit.cover),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 18, 150, 18),
                child: LayoutBuilder(
                  // Reduz o texto proporcionalmente em telas pequenas, sem cortar.
                  builder: (context, box) => FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: SizedBox(
                      width: box.maxWidth,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          FittedBox(
                            fit: BoxFit.scaleDown,
                            alignment: Alignment.centerLeft,
                            child: Text.rich(
                              TextSpan(
                                children: [
                                  TextSpan(text: '${promo.title}\n'),
                                  TextSpan(
                                    text: promo.highlight,
                                    style: const TextStyle(color: AppColors.accent),
                                  ),
                                ],
                              ),
                              style: const TextStyle(
                                fontFamily: 'Montserrat',
                                fontWeight: FontWeight.w800,
                                fontSize: 23,
                                height: 1.1,
                                color: Colors.white,
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            promo.text,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: Colors.white, fontSize: 13.5, height: 1.3),
                          ),
                        ],
                      ),
                    ),
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
