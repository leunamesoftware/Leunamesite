import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';
import '../core/utils/format.dart';
import '../data/models/catalog.dart';
import 'app_image.dart';
import 'category_icon.dart';

/// Card de produto: foto, desconto, preço "de/por", mercado e botão de adicionar.
class ProductCard extends StatelessWidget {
  const ProductCard({
    super.key,
    required this.product,
    this.onTap,
    this.onAdd,
    this.quantity = 0,
    this.width = 158,
    this.showMarket = true,
  });

  final Product product;
  final VoidCallback? onTap;
  final VoidCallback? onAdd;
  final int quantity;
  final double width;
  final bool showMarket;

  @override
  Widget build(BuildContext context) => LayoutBuilder(builder: (context, box) => _build(box.hasBoundedHeight));

  Widget _build(bool fill) {
    final p = product;
    return Semantics(
      label:
          '${p.name}, ${p.detail}, ${money(p.finalPriceCents)}${p.onSale ? ', de ${money(p.priceCents)}' : ''}'
          '${p.marketName != null ? ', ${p.marketName}' : ''}${p.inStock ? '' : ', indisponível'}',
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          width: width,
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.line),
            boxShadow: const [BoxShadow(color: Color(0x0F1A0B33), blurRadius: 12, offset: Offset(0, 4))],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AspectRatio(
                aspectRatio: 1.25,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: ColoredBox(
                        color: const Color(0xFFF7F7FA),
                        child: Opacity(
                          opacity: p.inStock ? 1 : .45,
                          child: AppImage(
                            p.imageUrl,
                            fit: BoxFit.contain,
                            fallback: Center(
                              child: Icon(
                                categoryIcon(p.categoryId),
                                size: 40,
                                color: AppColors.primaryLight.withValues(alpha: .55),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                    if (p.onSale)
                      Positioned(
                        top: 4,
                        right: 4,
                        child: _Pill(text: '-${p.discountPct}%', color: AppColors.discount),
                      ),
                    if (!p.inStock)
                      const Positioned(
                        left: 4,
                        bottom: 4,
                        child: _Pill(text: 'Esgotado', color: AppColors.inkMuted),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              Text(
                p.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontFamily: 'Montserrat',
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                  color: AppColors.ink,
                ),
              ),
              Text(
                p.detail,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12.5, color: AppColors.inkMuted),
              ),
              const SizedBox(height: 4),
              if (fill) const Spacer(),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (p.onSale)
                          Text(
                            money(p.priceCents),
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.inkMuted,
                              decoration: TextDecoration.lineThrough,
                              decorationColor: AppColors.inkMuted,
                            ),
                          ),
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Text(
                            money(p.finalPriceCents),
                            style: TextStyle(
                              fontFamily: 'Montserrat',
                              fontWeight: FontWeight.w800,
                              fontSize: 17,
                              color: p.onSale ? AppColors.discount : AppColors.ink,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  _AddButton(enabled: p.inStock && onAdd != null, quantity: quantity, onTap: onAdd, name: p.name),
                ],
              ),
              if (showMarket && p.marketName != null) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: AppColors.sheet, borderRadius: BorderRadius.circular(8)),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.storefront_rounded, size: 13, color: AppColors.primaryLight),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          p.marketName!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: AppColors.ink),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.text, required this.color});

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
    decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(20)),
    child: Text(
      text,
      style: const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w800),
    ),
  );
}

class _AddButton extends StatelessWidget {
  const _AddButton({required this.enabled, required this.quantity, required this.onTap, required this.name});

  final bool enabled;
  final int quantity;
  final VoidCallback? onTap;
  final String name;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: 'Adicionar $name ao carrinho',
    excludeSemantics: true,
    child: Material(
      color: enabled ? AppColors.success : AppColors.line,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: enabled ? onTap : null,
        child: SizedBox(
          width: 38,
          height: 38,
          child: Center(
            child: quantity > 0
                ? Text(
                    '$quantity',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15),
                  )
                : Icon(Icons.add_rounded, color: enabled ? Colors.white : AppColors.inkMuted, size: 24),
          ),
        ),
      ),
    ),
  );
}
