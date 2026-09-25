import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';
import '../data/models/catalog.dart';

IconData categoryIcon(String key) => switch (key) {
  'hortifruti' || 'eco' => Icons.eco_rounded,
  'carnes' || 'meat' => Icons.kebab_dining_rounded,
  'laticinios' || 'egg' => Icons.water_drop_rounded,
  'padaria' || 'bakery' => Icons.bakery_dining_rounded,
  'mercearia' || 'grocery' => Icons.shopping_basket_rounded,
  'bebidas' || 'drink' => Icons.local_drink_rounded,
  'higiene' || 'hygiene' => Icons.soap_rounded,
  'limpeza' || 'clean' => Icons.cleaning_services_rounded,
  'congelados' || 'frozen' => Icons.ac_unit_rounded,
  'saudaveis' || 'leaf' => Icons.spa_rounded,
  'bebe' || 'baby' => Icons.child_friendly_rounded,
  'pet' => Icons.pets_rounded,
  'casa' || 'home' => Icons.home_rounded,
  'mais' || 'more' => Icons.more_horiz_rounded,
  _ => Icons.category_rounded,
};

/// Ícone colorido de categoria (estilo "app de delivery").
class CategoryTile extends StatelessWidget {
  const CategoryTile({super.key, required this.category, this.onTap, this.size = 62, this.selected = false});

  final Category category;
  final VoidCallback? onTap;
  final double size;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final c = category.color;
    return Semantics(
      button: true,
      label: category.name,
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: SizedBox(
          width: size + 16,
          child: Column(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: size,
                height: size,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color.lerp(c, Colors.white, .12)!, c],
                  ),
                  borderRadius: BorderRadius.circular(size * .3),
                  border: selected ? Border.all(color: AppColors.primary, width: 3) : null,
                  boxShadow: [BoxShadow(color: c.withValues(alpha: .28), blurRadius: 10, offset: const Offset(0, 4))],
                ),
                child: Icon(categoryIcon(category.id), color: Colors.white, size: size * .48),
              ),
              const SizedBox(height: 6),
              Text(
                category.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                  color: AppColors.ink,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
